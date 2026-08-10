import type { SettingsProvider } from "../config/preferences";
import { Logger } from "../utils/logger";
import { ReaderAdapter, type ReaderContext } from "./reader-adapter";
import { ReaderController } from "./reader-controller";

type ControllerFactory = (
  context: ReaderContext,
  settingsProvider: SettingsProvider,
  onDestroyed: (controller: ReaderController) => void,
) => ReaderController;

export class ReaderRegistry {
  private readonly controllers = new WeakMap<object, ReaderController>();
  private readonly pending = new WeakMap<object, Promise<ReaderController | null>>();
  private readonly liveControllers = new Set<ReaderController>();
  private disposed = false;

  constructor(
    private readonly adapter: ReaderAdapter,
    private readonly settingsProvider: SettingsProvider,
    private readonly controllerFactory: ControllerFactory = (context, settings, onDestroyed) => (
      new ReaderController(context, settings, onDestroyed)
    ),
  ) {}

  ensure(reader: unknown, eventDocument?: Document): Promise<ReaderController | null> {
    if (this.disposed) return Promise.resolve(null);
    if (!reader || typeof reader !== "object") return Promise.resolve(null);
    const existing = this.controllers.get(reader);
    if (existing) return Promise.resolve(existing);
    const inFlight = this.pending.get(reader);
    if (inFlight) return inFlight;

    const promise = this.create(reader, eventDocument).catch((error) => {
      Logger.error(error);
      return null;
    });
    this.pending.set(reader, promise);
    void promise.then(
      () => this.pending.delete(reader),
      () => this.pending.delete(reader),
    );
    return promise;
  }

  refreshSettings(): void {
    for (const controller of this.liveControllers) controller.refreshSettings();
  }

  destroyAll(): void {
    this.disposed = true;
    for (const controller of [...this.liveControllers]) controller.destroy();
    this.liveControllers.clear();
  }

  private async create(
    reader: object,
    eventDocument: Document | undefined,
  ): Promise<ReaderController | null> {
    const context = await this.adapter.attach(reader, eventDocument);
    if (!context) return null;
    if (this.disposed) {
      context.dispose();
      return null;
    }

    let controller: ReaderController | null = null;
    try {
      controller = this.controllerFactory(context, this.settingsProvider, (destroyed) => {
        this.liveControllers.delete(destroyed);
        this.controllers.delete(reader);
      });
      controller.init();
      if (controller.isDestroyed || this.disposed) {
        controller.destroy();
        return null;
      }
      this.controllers.set(reader, controller);
      this.liveControllers.add(controller);
      return controller;
    }
    catch (error) {
      if (controller) controller.destroy();
      else context.dispose();
      Logger.error(error);
      return null;
    }
  }
}
