import { adjustPenWidth, setPenColor, type SettingsProvider } from "../config/preferences";
import { PALETTE_COLORS, type ModifierOption, type ToolMode } from "../config/constants";
import { DisposableStore } from "../utils/disposable";
import { Logger } from "../utils/logger";
import { InkModel } from "./ink-model";
import { InkRenderer } from "./ink-renderer";

type ModifierEvent = Pick<KeyboardEvent | PointerEvent, "altKey" | "ctrlKey">;

export function matchesModifier(modifier: ModifierOption, event: ModifierEvent): boolean {
  switch (modifier) {
    case "alt":
      return event.altKey && !event.ctrlKey;
    case "ctrl-alt":
      return event.ctrlKey && event.altKey;
    case "ctrl":
    default:
      return event.ctrlKey && !event.altKey;
  }
}

export function resolveGestureTool(
  settings: ReturnType<SettingsProvider>,
  mode: ToolMode,
  event: Pick<PointerEvent, "altKey" | "ctrlKey" | "shiftKey">,
): ToolMode {
  if (!settings.enabled) return "off";
  // Pen uses the configured modifier without Shift; rectangle uses its own
  // configured modifier together with Shift.
  if (matchesModifier(settings.modifier, event) && !event.shiftKey) return "pen";
  if (matchesModifier(settings.rectangleModifier, event) && event.shiftKey) return "rectangle";
  return mode;
}

export class InputController {
  private readonly disposables = new DisposableStore();
  private pointerID: number | null = null;
  private captureTarget: Element | null = null;
  private gestureTool: Exclude<ToolMode, "off"> | null = null;
  private modifierPressed = false;
  private lastModifierBits: string | null = null;
  private selectionBlocked = false;
  private selectionBlockStyle: HTMLStyleElement | null = null;
  private captureEngaged = false;
  private captureTimerID: number | null = null;
  private destroyed = false;

  constructor(
    private readonly window: Window & typeof globalThis,
    private readonly viewerElement: HTMLElement,
    private readonly model: InkModel,
    private readonly renderer: InkRenderer,
    private readonly settingsProvider: SettingsProvider,
    private readonly modeProvider: () => ToolMode,
  ) {}

  init(): void {
    const options: AddEventListenerOptions = { capture: true, passive: false };
    this.listen("pointerdown", this.onPointerDown as EventListener, options);
    this.listen("pointermove", this.onPointerMove as EventListener, options);
    this.listen("pointerup", this.onPointerUp as EventListener, options);
    this.listen("pointercancel", this.onPointerCancel as EventListener, options);
    this.listen("keydown", this.onKeyDown as EventListener, options);
    this.listen("keyup", this.onModifierChange as EventListener, options);
    this.listen("selectstart", this.onSelectStart as EventListener, true);
    this.listen("blur", this.onBlur as EventListener, true);
    this.window.document.addEventListener("selectionchange", this.onSelectionChange, true);
    this.disposables.add(() => this.window.document.removeEventListener("selectionchange", this.onSelectionChange, true));
    this.window.document.addEventListener("visibilitychange", this.onVisibilityChange, true);
    this.disposables.add(() => this.window.document.removeEventListener("visibilitychange", this.onVisibilityChange, true));
    this.updateCursor();
  }

  refresh(): void {
    if (!this.settingsProvider().enabled) {
      this.cancelGesture();
      this.renderer.clear();
    }
    this.updateCursor();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelGesture();
    this.viewerElement.style.removeProperty("cursor");
    this.disposables.dispose();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    // Zotero 9.0.6 deliberately handles mouse input in its compatibility
    // `mousedown` listener. Cancelling mouse `pointerdown` suppresses that event.
    // Pen support needs a separately verified arbitration path before v0.2.
    if (event.pointerType !== "mouse"
      || this.pointerID !== null
      || event.button !== 0
      || !event.isPrimary) return;
    const settings = this.settingsProvider();
    if (!settings.enabled || !this.isInsideViewer(event)) return;
    const tool = this.resolveTool(event);
    if (tool === "off") return;

    this.pointerID = event.pointerId;
    this.gestureTool = tool;
    this.updateCursor(event);
    this.captureTarget = event.target instanceof this.window.Element ? event.target : null;
    // Cancel the default actions first. Deferring pointer capture past the
    // mousedown dispatch is what keeps this cancellation effective: capture
    // set during pointerdown disables the suppression of the compatibility
    // 'mousedown', and Zotero's selection handling runs on that mousedown.
    this.consume(event);
    this.captureEngaged = false;
    this.captureTimerID = this.window.setTimeout(() => {
      this.captureTimerID = null;
      this.engagePointerCapture();
    }, 0);
    // A claimed gesture must not select the PDF text under the pointer.
    this.setSelectionBlocked(true);

    const point = this.renderer.pointFromClient(event.clientX, event.clientY, event.timeStamp);
    if (tool === "pen") this.model.startPen(point);
    else this.model.startRectangle(point);
    this.renderer.invalidate();
    Logger.debug(`Gesture start: ${tool}`);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerID || !this.gestureTool) {
      if (this.modeProvider() === "off") this.updateCursor(event);
      return;
    }
    // The compatibility mousedown has already been dispatched by now, so
    // engaging capture here no longer undoes its suppression.
    this.engagePointerCapture();
    const events = typeof event.getCoalescedEvents === "function"
      ? event.getCoalescedEvents()
      : [event];
    let changed = false;
    for (const sample of events) {
      const point = this.renderer.pointFromClient(sample.clientX, sample.clientY, sample.timeStamp);
      changed = this.gestureTool === "pen"
        ? this.model.addPenPoint(point) || changed
        : this.model.updateRectangle(point) || changed;
    }
    this.consume(event);
    if (changed) this.renderer.invalidate();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerID) return;
    const point = this.renderer.pointFromClient(event.clientX, event.clientY, event.timeStamp);
    if (this.gestureTool === "pen") this.model.addPenPoint(point);
    else if (this.gestureTool === "rectangle") this.model.updateRectangle(point);
    this.model.releaseActive(this.window.performance.now());
    this.consume(event);
    this.finishGesture();
    this.renderer.invalidate();
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerID) return;
    this.consume(event);
    this.cancelGesture();
    this.renderer.invalidate();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.model.hasVisibleStrokes) {
      this.cancelGesture();
      this.renderer.clear();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.handleShortcutKey(event);
    this.updateCursor(event);
  };

  private readonly onModifierChange = (event: KeyboardEvent): void => this.updateCursor(event);

  private handleShortcutKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!this.settingsProvider().enabled) return;
    if (this.isEditableTarget(event)) return;

    if (event.key >= "1" && event.key <= "6") {
      const color = PALETTE_COLORS[Number(event.key) - 1];
      if (color) setPenColor(color);
      return;
    }
    if (event.key === "[") {
      adjustPenWidth(-1);
      return;
    }
    if (event.key === "]") {
      adjustPenWidth(1);
    }
  }

  private isEditableTarget(event: KeyboardEvent): boolean {
    const target = event.target;
    if (!(target instanceof this.window.HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || target.isContentEditable;
  }

  private readonly onSelectStart = (event: Event): void => {
    // A claimed ink gesture must never begin a text selection in the viewer.
    // Unclaimed gestures fall through untouched so OFF-mode selection works.
    if (this.gestureTool === null) return;
    this.consume(event);
  };
  private readonly onSelectionChange = (): void => {
    // Programmatic selection (Zotero's own mousedown-driven selection path)
    // bypasses both user-select CSS and selectstart. Clear any selection the
    // viewer establishes while a claimed gesture is active.
    if (this.gestureTool === null) return;
    const selection = this.window.getSelection();
    if (selection && selection.rangeCount > 0) selection.removeAllRanges();
  };
  private readonly onBlur = (): void => {
    this.modifierPressed = false;
    this.cancelGesture();
    this.renderer.clear();
  };
  private readonly onVisibilityChange = (): void => {
    if (this.window.document.hidden) this.onBlur();
  };

  private resolveTool(event: Pick<PointerEvent, "altKey" | "ctrlKey" | "shiftKey">): ToolMode {
    return resolveGestureTool(this.settingsProvider(), this.modeProvider(), event);
  }

  private updateCursor(
    event?: Pick<KeyboardEvent | PointerEvent, "altKey" | "ctrlKey" | "shiftKey">,
  ): void {
    // Pointer moves fire at 125-240 Hz; recompute only when the modifier state
    // actually changes, so hovering in OFF mode does not re-read all preferences
    // on every move. Callers without an event always recompute.
    const bits = event ? event.ctrlKey + "|" + event.altKey + "|" + event.shiftKey : null;
    if (bits !== null && bits === this.lastModifierBits) return;
    if (bits !== null) this.lastModifierBits = bits;
    const settings = this.settingsProvider();
    const modeActive = settings.enabled && this.modeProvider() !== "off";
    if (event) {
      this.modifierPressed = matchesModifier(settings.modifier, event)
        || (matchesModifier(settings.rectangleModifier, event) && event.shiftKey);
    }
    this.viewerElement.style.cursor = modeActive || (settings.enabled && this.modifierPressed)
      ? "crosshair"
      : "";
  }

  private isInsideViewer(event: PointerEvent): boolean {
    const target = event.target;
    if (!(target instanceof this.window.Node) || !this.viewerElement.contains(target)) return false;
    const rect = this.viewerElement.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  private consume(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  private finishGesture(): void {
    if (this.pointerID !== null) {
      try {
        this.captureTarget?.releasePointerCapture?.(this.pointerID);
      }
      catch {
        // Capture may already have been released by Firefox.
      }
    }
    this.pointerID = null;
    this.captureTarget = null;
    this.gestureTool = null;
    this.captureEngaged = false;
    if (this.captureTimerID !== null) {
      this.window.clearTimeout(this.captureTimerID);
      this.captureTimerID = null;
    }
    this.setSelectionBlocked(false);
    this.updateCursor();
  }

  private cancelGesture(): void {
    this.model.cancelActive(this.window.performance.now());
    this.finishGesture();
  }

  /**
   * Engages pointer capture exactly once per gesture, after the compatibility
   * mousedown has been dispatched. During pointerdown, active capture would
   * disable preventDefault()'s suppression of that mousedown; deferring keeps
   * Zotero's selection/annotation handling out of claimed gestures while still
   * letting edge drags release cleanly.
   */
  private engagePointerCapture(): void {
    if (this.captureEngaged || this.pointerID === null) return;
    this.captureEngaged = true;
    if (this.captureTimerID !== null) {
      this.window.clearTimeout(this.captureTimerID);
      this.captureTimerID = null;
    }
    try {
      this.captureTarget?.setPointerCapture?.(this.pointerID);
    }
    catch {
      // Window-level capture listeners still guarantee a safe fallback.
    }
  }

  /**
   * Blocks text selection in the nested viewer document for the duration of a
   * claimed gesture. The suppression is pure CSS (a scoped stylesheet toggled by
   * a class on the document root) plus a capture-phase 'selectstart' cancel, so
   * it cannot disturb pointer events, ink rendering, or the viewer itself.
   */
  private setSelectionBlocked(blocked: boolean): void {
    if (this.selectionBlocked === blocked) return;
    this.selectionBlocked = blocked;
    const document = this.viewerElement.ownerDocument;
    const root = document.documentElement;
    if (!root) return;
    if (blocked) {
      this.ensureSelectionBlockStyle(document);
      root.classList.add("temporary-ink-selection-blocked");
    }
    else {
      root.classList.remove("temporary-ink-selection-blocked");
      this.selectionBlockStyle?.remove();
      this.selectionBlockStyle = null;
    }
  }

  private ensureSelectionBlockStyle(document: Document): void {
    document.querySelector('[data-temporary-ink="selection-block"]')?.remove();
    const style = document.createElement("style");
    style.dataset.temporaryInk = "selection-block";
    // '!important' beats any stylesheet (and non-important inline) user-select
    // rule, including PDF.js's '.textLayer { user-select: text }'.
    style.textContent = [
      "html.temporary-ink-selection-blocked,",
      "html.temporary-ink-selection-blocked * {",
      "  user-select: none !important;",
      "  -webkit-user-select: none !important;",
      "  -moz-user-select: none !important;",
      "}",
    ].join("\n");
    (document.head ?? document.documentElement).append(style);
    this.selectionBlockStyle = style;
  }

  private listen(type: string, handler: EventListener, options: boolean | AddEventListenerOptions): void {
    this.window.addEventListener(type, handler, options);
    this.disposables.add(() => this.window.removeEventListener(type, handler, options));
  }
}
