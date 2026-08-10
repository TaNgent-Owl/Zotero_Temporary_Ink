import type { SettingsProvider } from "../config/preferences";
import type { ToolMode } from "../config/constants";
import { InkModel } from "../ink/ink-model";
import { InkRenderer } from "../ink/ink-renderer";
import { InputController } from "../ink/input-controller";
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
  }

  init(): void {
    this.renderer.mount(this.context.overlayHost);
    this.input.init();
    const clearForViewportChange = () => {
      this.renderer.clear();
      this.context.window.requestAnimationFrame(() => this.renderer.resize());
    };
    this.disposables.add(this.context.onViewportChange(clearForViewportChange));
    this.disposables.add(this.context.onClose(() => this.destroy()));
    if (this.destroyed) return;

    const handleScroll = () => this.renderer.clear();
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
    if (!this.settingsProvider().enabled) this.setMode("off");
    this.input.refresh();
    this.renderer.invalidate();
  }

  clear(): void {
    this.renderer.clear();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.toolbarControl.dispose();
    this.modeListeners.clear();
    this.disposables.dispose();
    this.input.destroy();
    this.renderer.destroy();
    this.context.dispose();
    this.onDestroyed(this);
    Logger.debug("Reader destroyed");
  }
}
