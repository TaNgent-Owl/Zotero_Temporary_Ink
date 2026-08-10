import { PLUGIN_ID } from "./config/constants";
import { PREF_KEYS, readSettings } from "./config/preferences";
import { ReaderAdapter } from "./reader/reader-adapter";
import { ReaderRegistry } from "./reader/reader-registry";
import { mountToolbar, type ToolbarControl } from "./ui/toolbar";
import { registerPreferencePane, unregisterPreferencePane } from "./ui/preferences";
import { Logger } from "./utils/logger";

class TemporaryInkAddon {
  private adapter = new ReaderAdapter();
  private registry = new ReaderRegistry(this.adapter, readSettings);
  private readonly preferenceObserverIDs: number[] = [];
  private readonly toolbarControls = new Map<Document, ToolbarControl>();
  private rootURI = "";
  private preferencePaneID: string | null = null;
  private active = false;

  async startup(rootURI: string): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.rootURI = rootURI;
    // A bootstrapped add-on can be restarted in the same script global during
    // update/re-enable. Never reuse a registry permanently disposed by shutdown.
    this.adapter = new ReaderAdapter();
    this.registry = new ReaderRegistry(this.adapter, readSettings);

    // Register before uiReady so session-restored Readers cannot render their
    // toolbar before the plugin starts listening.
    Zotero.Reader.registerEventListener("renderToolbar", this.handleRenderToolbar, PLUGIN_ID);
    await Zotero.uiReadyPromise;
    if (!this.active) return;

    this.preferencePaneID = await registerPreferencePane(rootURI);
    for (const key of Object.values(PREF_KEYS)) {
      this.preferenceObserverIDs.push(
        Zotero.Prefs.registerObserver(key, () => this.registry.refreshSettings(), true),
      );
    }

    // Supports enable-without-restart for already-open PDF readers. The adapter
    // recreates Zotero's section wrapper only when the official render event was
    // missed; a later normal render replaces it through the same control lifecycle.
    await Promise.all(this.adapter.getOpenReaders().map(async (reader) => {
      const controller = await this.registry.ensure(reader);
      if (!this.active || !controller) return;
      const event = this.adapter.createExistingToolbarEvent(reader);
      if (event) this.handleRenderToolbar(event);
    }));
    Logger.debug("Plugin started");
  }

  async shutdown(): Promise<void> {
    if (!this.active) return;
    this.active = false;
    for (const control of this.toolbarControls.values()) control.dispose();
    this.toolbarControls.clear();
    this.registry.destroyAll();
    for (const id of this.preferenceObserverIDs.splice(0)) {
      Zotero.Prefs.unregisterObserver(id);
    }
    unregisterPreferencePane(this.preferencePaneID);
    this.preferencePaneID = null;
    // Zotero 9.0.6 unregisterEventListener has an inverted filter bug. Do not call
    // it: Zotero.Reader removes listeners registered with PLUGIN_ID in its plugin
    // shutdown observer. The active guard makes any interim callback inert.
    Logger.debug("Plugin stopped");
  }

  private readonly handleRenderToolbar = (event: ZoteroReaderEvent): void => {
    if (!this.active) return;
    if (!event.reader || typeof event.reader !== "object") return;
    const readerType = (event.reader as { type?: unknown; _type?: unknown }).type
      ?? (event.reader as { _type?: unknown })._type;
    if (readerType !== "pdf") return;

    const previous = this.toolbarControls.get(event.doc);
    if (previous?.element.isConnected) return;
    previous?.dispose();

    // append() is synchronous-only in Zotero's renderToolbar callback.
    let control: ToolbarControl | null = null;
    control = mountToolbar(event, () => {
      if (control && this.toolbarControls.get(event.doc) === control) {
        this.toolbarControls.delete(event.doc);
      }
    });
    if (!control) return;
    this.toolbarControls.set(event.doc, control);

    void this.registry.ensure(event.reader, event.doc)
      .then((controller) => {
        if (
          this.active
          && controller
          && control.element.isConnected
          && this.toolbarControls.get(event.doc) === control
        ) {
          control.bind(controller);
          return;
        }
        control.dispose();
      })
      .catch((error) => Logger.error(error));
  };
}

export function createAddon(): TemporaryInkAddon {
  return new TemporaryInkAddon();
}
