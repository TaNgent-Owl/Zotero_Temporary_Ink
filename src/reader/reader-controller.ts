import type { SettingsProvider } from "../config/preferences";
import type { ToolMode } from "../config/constants";
import { InkModel } from "../ink/ink-model";
import { InkRenderer } from "../ink/ink-renderer";
import { InputController, resolveGestureTool } from "../ink/input-controller";
import { CornerBadge } from "../ui/badge";
import { DisposableSlot, DisposableStore, type Disposable } from "../utils/disposable";
import { Logger } from "../utils/logger";
import type { ReaderContext } from "./reader-adapter";

export class ReaderController {
  private readonly model = new InkModel();
  private readonly renderer: InkRenderer;
  private readonly input: InputController;
  private readonly disposables = new DisposableStore();
  private readonly modeListeners = new Set<(mode: ToolMode) => void>();
  private readonly toolbarControl = new DisposableSlot<Disposable>();
  private readonly badge: CornerBadge;
  private readonly modifiers = { altKey: false, ctrlKey: false, shiftKey: false };
  private pointerDown = false;
  private shownTool: "pen" | "rectangle" | null = null;
  private mode: ToolMode = "off";
  private destroyed = false;

  constructor(
    readonly context: ReaderContext,
    private readonly settingsProvider: SettingsProvider,
    private readonly onDestroyed: (controller: ReaderController) => void,
  ) {
    this.renderer = new InkRenderer(
      context.window,
      context.viewerElement,
      this.model,
      settingsProvider,
    );
    this.input = new InputController(
      context.window,
      context.viewerElement,
      this.model,
      this.renderer,
      settingsProvider,
      () => this.mode,
    );
    this.badge = new CornerBadge(context.window, settingsProvider);
  }

  init(): void {
    this.renderer.mount(this.context.overlayHost);
    this.input.init();
    this.badge.mount(this.context.overlayHost);

    this.listenWindow("keydown", this.onKeyDown as EventListener);
    this.listenWindow("keyup", this.onKeyUp as EventListener);
    this.listenWindow("pointerdown", this.onPointerDown as EventListener);
    this.listenWindow("pointerup", this.onPointerUp as EventListener);
    this.listenWindow("pointercancel", this.onPointerCancel as EventListener);

    const clearForViewportChange = () => {
      this.renderer.clear();
      this.hideBadge();
      this.context.window.requestAnimationFrame(() => this.renderer.resize());
    };
    this.disposables.add(this.context.onViewportChange(clearForViewportChange));
    this.disposables.add(this.context.onClose(() => this.destroy()));
    if (this.destroyed) return;

    const handleScroll = () => {
      this.renderer.clear();
      this.hideBadge();
    };
    this.context.viewerElement.addEventListener("scroll", handleScroll, { passive: true });
    this.disposables.add(() => this.context.viewerElement.removeEventListener("scroll", handleScroll));

    const ResizeObserverCtor = this.context.window.ResizeObserver;
    if (ResizeObserverCtor) {
      const observer = new ResizeObserverCtor(() => clearForViewportChange());
      observer.observe(this.context.viewerElement);
      this.disposables.add(() => observer.disconnect());
    }
    Logger.debug("Reader attached; canvas mounted");
  }

  getMode(): ToolMode {
    return this.mode;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  replaceToolbarControl(control: Disposable): void {
    if (this.destroyed) {
      control.dispose();
      return;
    }
    this.toolbarControl.replace(control);
  }

  clearToolbarControl(): void {
    this.toolbarControl.dispose();
  }

  setMode(mode: ToolMode): void {
    if (this.destroyed || mode === this.mode) return;
    this.mode = mode;
    this.input.refresh();
    for (const listener of this.modeListeners) listener(mode);
    this.recompute();
  }

  cycleMode(): void {
    this.setMode(this.mode === "off" ? "pen" : this.mode === "pen" ? "rectangle" : "off");
  }

  subscribeMode(listener: (mode: ToolMode) => void): () => void {
    this.modeListeners.add(listener);
    listener(this.mode);
    return () => this.modeListeners.delete(listener);
  }

  refreshSettings(): void {
    const settings = this.settingsProvider();
    if (!settings.enabled) {
      this.setMode("off");
      this.hideBadge();
    }
    else {
      this.badge.update();
    }
    this.input.refresh();
    this.renderer.invalidate();
  }

  clear(): void {
    this.renderer.clear();
  }

  private recompute(): void {
    const tool = this.computeTool();
    if (tool === this.shownTool) return;
    this.shownTool = tool;
    if (tool) this.badge.show(tool);
    else this.badge.hide();
  }

  private computeTool(): "pen" | "rectangle" | null {
    if (this.mode !== "off") return this.pointerDown ? this.mode : null;
    const resolved = resolveGestureTool(this.settingsProvider(), this.mode, this.modifiers);
    return resolved === "off" ? null : resolved;
  }

  private hideBadge(): void {
    this.shownTool = null;
    this.badge.hide();
  }

  private isInsideViewer(event: PointerEvent): boolean {
    const rect = this.context.viewerElement.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      this.hideBadge();
      return;
    }
    this.modifiers.altKey = event.altKey;
    this.modifiers.ctrlKey = event.ctrlKey;
    this.modifiers.shiftKey = event.shiftKey;
    this.recompute();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.modifiers.altKey = event.altKey;
    this.modifiers.ctrlKey = event.ctrlKey;
    this.modifiers.shiftKey = event.shiftKey;
    this.recompute();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.isPrimary && event.button === 0 && this.isInsideViewer(event)) {
      this.pointerDown = true;
      this.recompute();
    }
  };

  private readonly onPointerUp = (): void => {
    this.pointerDown = false;
    this.recompute();
  };

  private readonly onPointerCancel = (): void => {
    this.pointerDown = false;
    this.recompute();
  };

  private listenWindow(type: string, handler: EventListener): void {
    const options: AddEventListenerOptions = { capture: true, passive: true };
    this.context.window.addEventListener(type, handler, options);
    this.disposables.add(() => this.context.window.removeEventListener(type, handler, options));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.toolbarControl.dispose();
    this.modeListeners.clear();
    this.disposables.dispose();
    this.input.destroy();
    this.renderer.destroy();
    this.badge.dispose();
    this.context.dispose();
    this.onDestroyed(this);
    Logger.debug("Reader destroyed");
  }
}
