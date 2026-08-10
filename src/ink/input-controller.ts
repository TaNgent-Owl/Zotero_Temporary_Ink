import type { SettingsProvider } from "../config/preferences";
import type { ToolMode } from "../config/constants";
import { DisposableStore } from "../utils/disposable";
import { Logger } from "../utils/logger";
import { InkModel } from "./ink-model";
import { InkRenderer } from "./ink-renderer";

export function resolveGestureTool(
  settings: ReturnType<SettingsProvider>,
  mode: ToolMode,
  event: Pick<PointerEvent, "altKey" | "ctrlKey" | "shiftKey">,
): ToolMode {
  if (!settings.enabled) return "off";
  const modifierActive = event.ctrlKey && !event.altKey;
  if (modifierActive) return event.shiftKey ? "rectangle" : "pen";
  return mode;
}

export class InputController {
  private readonly disposables = new DisposableStore();
  private pointerID: number | null = null;
  private captureTarget: Element | null = null;
  private gestureTool: Exclude<ToolMode, "off"> | null = null;
  private modifierPressed = false;
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
    this.listen("blur", this.onBlur as EventListener, true);
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
    try {
      this.captureTarget?.setPointerCapture?.(event.pointerId);
    }
    catch {
      // Window-level capture listeners still guarantee a safe fallback.
    }

    const point = this.renderer.pointFromClient(event.clientX, event.clientY, event.timeStamp);
    if (tool === "pen") this.model.startPen(point);
    else this.model.startRectangle(point);
    this.consume(event);
    this.renderer.invalidate();
    Logger.debug(`Gesture start: ${tool}`);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerID || !this.gestureTool) {
      if (this.modeProvider() === "off") this.updateCursor(event);
      return;
    }
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
    this.updateCursor(event);
  };

  private readonly onModifierChange = (event: KeyboardEvent): void => this.updateCursor(event);
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

  private updateCursor(event?: Pick<KeyboardEvent | PointerEvent, "altKey" | "ctrlKey">): void {
    const settings = this.settingsProvider();
    const modeActive = settings.enabled && this.modeProvider() !== "off";
    if (event) {
      this.modifierPressed = event.ctrlKey && !event.altKey;
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
    this.updateCursor();
  }

  private cancelGesture(): void {
    this.model.cancelActive(this.window.performance.now());
    this.finishGesture();
  }

  private listen(type: string, handler: EventListener, options: boolean | AddEventListenerOptions): void {
    this.window.addEventListener(type, handler, options);
    this.disposables.add(() => this.window.removeEventListener(type, handler, options));
  }
}
