declare const Zotero: {
  debug(message: string | Error, level?: number): void;
  locale?: string;
  initializationPromise: Promise<void>;
  uiReadyPromise: Promise<void>;
  Reader: {
    _readers?: unknown[];
    registerEventListener(
      type: "renderToolbar",
      handler: (event: ZoteroReaderEvent) => void,
      pluginID?: string,
    ): void;
  };
  Prefs: {
    get(key: string, global?: boolean): unknown;
    set(key: string, value: string | number | boolean, global?: boolean): void;
    registerObserver(key: string, handler: () => void, global?: boolean): number;
    unregisterObserver(id: number): void;
  };
  PreferencePanes?: {
    register(options: {
      pluginID: string;
      src: string;
      label: string;
      image?: string;
      scripts?: string[];
      stylesheets?: string[];
    }): Promise<string>;
    unregister?(id: string): void;
  };
};

interface ZoteroReaderEvent {
  type: "renderToolbar";
  reader: unknown;
  doc: Document;
  params: Record<string, unknown>;
  append(...elements: Element[]): void;
}
