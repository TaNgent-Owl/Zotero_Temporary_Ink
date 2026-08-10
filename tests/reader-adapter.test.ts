import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it } from "vitest";
import { ReaderAdapter } from "../src/reader/reader-adapter";

describe("ReaderAdapter close lifecycle", () => {
  beforeEach(() => {
    Object.assign(globalThis, {
      Zotero: {
        Reader: { _readers: [] },
        debug() {},
      },
    });
  });

  it("notifies a subscriber added after the viewer already closed", async () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><div id=\"viewerContainer\"></div></body></html>",
      { pretendToBeVisual: true },
    );
    const reader = {
      type: "pdf",
      _waitForInternalReader: async () => true,
      _internalReader: {
        _primaryView: { _iframeWindow: dom.window },
      },
    };
    const adapter = new ReaderAdapter();
    const context = await adapter.attach(reader);
    expect(context).not.toBeNull();
    dom.window.dispatchEvent(new dom.window.PageTransitionEvent("pagehide"));

    let calls = 0;
    const unsubscribe = context!.onClose(() => calls++);
    expect(calls).toBe(1);
    unsubscribe();
    context!.dispose();
  });
});
