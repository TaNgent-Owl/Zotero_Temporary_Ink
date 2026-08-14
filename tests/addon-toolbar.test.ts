import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAddon } from "../src/addon";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("add-on toolbar integration", () => {
  let renderToolbar: ((event: ZoteroReaderEvent) => void) | undefined;

  beforeEach(() => {
    renderToolbar = undefined;
    let observerID = 0;
    Object.assign(globalThis, {
      Zotero: {
        debug() {},
        uiReadyPromise: Promise.resolve(),
        Reader: {
          _readers: [],
          registerEventListener(_type: string, handler: (event: ZoteroReaderEvent) => void) {
            renderToolbar = handler;
          },
        },
        Prefs: {
          get() { return undefined; },
          set() {},
          registerObserver() { return ++observerID; },
          unregisterObserver() {},
        },
      },
    });
  });

  it("registers the toolbar listener before Zotero UI restoration completes", async () => {
    const uiReady = deferred<void>();
    Zotero.uiReadyPromise = uiReady.promise;
    const addon = createAddon();

    const starting = addon.startup("resource://temporary-ink/");
    expect(renderToolbar).toBeTypeOf("function");

    uiReady.resolve();
    await starting;
    await addon.shutdown();
  });

  it("uses renderToolbar.append before asynchronous Reader attachment", async () => {
    const addon = createAddon();
    await addon.startup("resource://temporary-ink/");
    const ready = deferred<boolean>();
    const reader = {
      type: "pdf",
      _waitForInternalReader: () => ready.promise,
    };
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
    let callbackActive = true;
    let appended = false;

    renderToolbar!({
      type: "renderToolbar",
      reader,
      doc: dom.window.document,
      params: {},
      append: (...elements: Element[]) => {
        expect(callbackActive).toBe(true);
        appended = true;
        dom.window.document.body.append(...elements);
      },
    });
    callbackActive = false;

    expect(appended).toBe(true);
    expect(dom.window.document.querySelector<HTMLButtonElement>('[data-temporary-ink="toolbar"]')?.disabled)
      .toBe(false);
    expect(dom.window.document.querySelector<HTMLButtonElement>('[data-temporary-ink="toolbar"]')?.getAttribute("aria-busy"))
      .toBe("true");

    await addon.shutdown();
    ready.resolve(false);
    await Promise.resolve();
    expect(dom.window.document.querySelector('[data-temporary-ink="toolbar"]')).toBeNull();
  });

  it("keeps the plugin running when the preference pane fails to register", async () => {
    Zotero.debug = vi.fn();
    Object.assign(Zotero, {
      PreferencePanes: {
        register: () => Promise.reject(new Error("pane boom")),
        unregister: () => {},
      },
    });
    const addon = createAddon();

    // startup must resolve and the plugin must remain usable.
    await addon.startup("resource://temporary-ink/");
    expect(Zotero.debug).toHaveBeenCalled();

    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
    renderToolbar!({
      type: "renderToolbar",
      reader: { type: "pdf", _waitForInternalReader: () => new Promise<boolean>(() => {}) },
      doc: dom.window.document,
      params: {},
      append: (...elements: Element[]) => dom.window.document.body.append(...elements),
    });
    expect(dom.window.document.querySelector('[data-temporary-ink="toolbar"]')).not.toBeNull();
    await addon.shutdown();
  });

  it("mounts synthetic toolbars for already-open readers without awaiting readiness", async () => {
    const dom = new JSDOM(
      '<!doctype html><html><head></head><body>' +
      '<div class="toolbar"><div class="end"><div class="custom-sections"></div><button class="find"></button></div></div>' +
      '</body></html>',
    );
    const neverReady = deferred<boolean>();
    const reader = {
      type: "pdf",
      _waitForInternalReader: () => neverReady.promise,
      _iframeWindow: dom.window,
    };
    Zotero.Reader._readers = [reader];
    const addon = createAddon();

    // Attachment of this reader can never complete, but startup must not wait
    // for it: the toolbar is mounted synchronously and bound asynchronously.
    await addon.startup("resource://temporary-ink/");
    expect(dom.window.document.querySelector('[data-temporary-ink="toolbar"]')).not.toBeNull();

    await addon.shutdown();
    neverReady.resolve(false);
    await Promise.resolve();
    expect(dom.window.document.querySelector('[data-temporary-ink="toolbar"]')).toBeNull();
  });

  it("never lets a toolbar mount failure break the Reader render loop", async () => {
    Zotero.debug = vi.fn();
    const addon = createAddon();
    await addon.startup("resource://temporary-ink/");

    const maliciousDoc = {
      querySelector() {
        throw new Error("render boom");
      },
    } as unknown as Document;
    expect(() => renderToolbar!({
      type: "renderToolbar",
      reader: { type: "pdf" },
      doc: maliciousDoc,
      params: {},
      append: () => {},
    })).not.toThrow();
    expect(Zotero.debug).toHaveBeenCalled();
    await addon.shutdown();
  });
});
