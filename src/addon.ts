import { PLUGIN_ID } from "./config/constants";
import { PREF_KEYS, readSettings } from "./config/preferences";
import { ReaderAdapter } from "./reader/reader-adapter";
import { ReaderRegistry } from "./reader/reader-registry";
import { mountToolbar } from "./ui/toolbar";
import { registerPreferencePane, unregisterPreferencePane } from "./ui/preferences";
import { Logger } from "./utils/logger";

class TemporaryInkAddon {
  private readonly adapter = new ReaderAdapter();
  private readonly registry = new ReaderRegistry(this.adapter, readSettings);
  private readonly preferenceObserverIDs: number[] = [];
  private rootURI = "";
  private preferencePaneID: string | null = null;
  private active = false;

  async startup(rootURI: string): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.rootURI = rootURI;
    this.preferencePaneID = await registerPreferencePane(rootURI);

    Zotero.Reader.registerEventListener("renderToolbar", this.handleRenderToolbar, PLUGIN_ID);
    for (const key of Object.values(PREF_KEYS)) {
      this.preferenceObserverIDs.push(
        Zotero.Prefs.registerObserver(key, () => this.registry.refreshSettings(), true),
      );
    }

    // Supports enable-without-restart for already-open PDF readers. Their toolbar
    // appears on the next normal toolbar render; modifier drawing works immediately.
    await Promise.all(this.adapter.getOpenReaders().map((reader) => this.registry.ensure(reader)));
    Logger.debug("Plugin started");
  }

  async shutdown(): Promise<void> {
    if (!this.active) return;
    this.active = false;
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
    void this.registry.ensure(event.reader, event.doc)
      .then((controller) => {
        if (this.active && controller) {
          mountToolbar(event, controller, this.rootURI);
        }
      })
      .catch((error) => Logger.error(error));
  };
}

export function createAddon(): TemporaryInkAddon {
  return new TemporaryInkAddon();
}
