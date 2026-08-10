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

  it("recreates the verified toolbar section for an already-open Reader", () => {
    const outer = new JSDOM(
      "<!doctype html><html><body><div class=\"toolbar\"><div class=\"end\"><div class=\"custom-sections\"></div><button class=\"find\"></button></div></div></body></html>",
    );
    const reader = {
      type: "pdf",
      _iframeWindow: outer.window,
    };
    const adapter = new ReaderAdapter();
    const event = adapter.createExistingToolbarEvent(reader);
    expect(event).not.toBeNull();

    const button = outer.window.document.createElement("button");
    button.dataset.temporaryInk = "toolbar";
    event!.append(button);

    expect(
      outer.window.document.querySelector(
        '.toolbar .end .custom-sections > .section > [data-temporary-ink="toolbar"]',
      ),
    ).toBe(button);
  });

  it("polls the viewer DOM after Zotero's first readiness result", async () => {
    const outer = new JSDOM("<!doctype html><html><body></body></html>");
    const viewer = new JSDOM(
      "<!doctype html><html><body><div id=\"viewerContainer\"></div></body></html>",
      { pretendToBeVisual: true },
    );
    let attempts = 0;
    const reader = {
      type: "pdf",
      _waitForInternalReader: async () => {
        attempts++;
        setTimeout(() => {
          reader._internalReader = {
            _primaryView: {
              _iframeWindow: viewer.window as unknown as Window & typeof globalThis,
            },
          };
        }, 0);
        return false;
      },
      _internalReader: undefined as { _primaryView: { _iframeWindow: Window } } | undefined,
    };
    const adapter = new ReaderAdapter([0, 5]);

    const context = await adapter.attach(reader, outer.window.document);

    expect(context).not.toBeNull();
    expect(attempts).toBe(1);
    context!.dispose();
  });

  it("does not cancel attachment when Zotero replaces the outer toolbar document", async () => {
    const outer = new JSDOM("<!doctype html><html><body></body></html>");
    const viewer = new JSDOM(
      "<!doctype html><html><body><div id=\"viewerContainer\"></div></body></html>",
      { pretendToBeVisual: true },
    );
    let finishReadiness!: (ready: boolean) => void;
    const readiness = new Promise<boolean>((resolve) => {
      finishReadiness = resolve;
    });
    const reader = {
      type: "pdf",
      _waitForInternalReader: () => readiness,
      _internalReader: {
        _primaryView: {
          _iframeWindow: viewer.window as unknown as Window & typeof globalThis,
        },
      },
    };
    const adapter = new ReaderAdapter([0]);
    const attaching = adapter.attach(reader, outer.window.document);

    outer.window.dispatchEvent(new outer.window.PageTransitionEvent("pagehide"));
    finishReadiness(true);

    const context = await attaching;
    expect(context).not.toBeNull();
    context!.dispose();
  });

  it("attaches when the viewer DOM is ready even if Zotero's readiness promise stalls", async () => {
    const viewer = new JSDOM(
      "<!doctype html><html><body><div id=\"viewerContainer\"></div></body></html>",
      { pretendToBeVisual: true },
    );
    const reader = {
      type: "pdf",
      _waitForInternalReader: () => new Promise<boolean>(() => {}),
      _internalReader: {
        _primaryView: {
          _iframeWindow: viewer.window as unknown as Window & typeof globalThis,
        },
      },
    };
    const adapter = new ReaderAdapter([0]);
    const outcome = await Promise.race([
      adapter.attach(reader),
      new Promise<"timed-out">((resolve) => setTimeout(() => resolve("timed-out"), 25)),
    ]);

    expect(outcome).not.toBe("timed-out");
    expect(outcome).not.toBeNull();
    if (outcome !== "timed-out") outcome!.dispose();
  });
});
