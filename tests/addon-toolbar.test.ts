import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it } from "vitest";
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
});
