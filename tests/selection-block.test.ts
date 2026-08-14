import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type InkSettings } from "../src/config/constants";
import { InputController } from "../src/ink/input-controller";
import { InkModel } from "../src/ink/ink-model";
import type { InkRenderer } from "../src/ink/ink-renderer";

describe("selection blocking during claimed gestures", () => {
  function harness(settings: InkSettings = { ...DEFAULT_SETTINGS }) {
    Object.assign(globalThis, { Zotero: { debug() {} } });
    const dom = new JSDOM(
      '<!doctype html><html><head></head><body><div id="viewerContainer"><span id="text">selectable text</span></div></body></html>',
      { pretendToBeVisual: true },
    );
    const viewer = dom.window.document.getElementById("viewerContainer")!;
    Object.defineProperty(viewer, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 }),
    });
    const model = new InkModel();
    const renderer = {
      pointFromClient: (x: number, y: number, t: number) => ({ x, y, t }),
      invalidate: vi.fn(),
      clear: vi.fn(() => model.clear()),
    } as unknown as InkRenderer;
    const input = new InputController(
      dom.window as never,
      viewer as unknown as HTMLElement,
      model,
      renderer,
      () => settings,
      () => "off",
    );
    input.init();

    const pointer = (type: string, pointerId: number, ctrlKey = false) => {
      const event = new dom.window.MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 10,
        clientY: 20,
        ctrlKey,
      });
      Object.defineProperties(event, {
        pointerId: { value: pointerId },
        pointerType: { value: "mouse" },
        isPrimary: { value: true },
      });
      return event;
    };
    const selectStart = () => new dom.window.Event("selectstart", {
      bubbles: true,
      cancelable: true,
    });
    const styleElement = () => dom.window.document.querySelector(
      '[data-temporary-ink="selection-block"]',
    );
    const rootClassed = () => dom.window.document.documentElement.classList
      .contains("temporary-ink-selection-blocked");
    const refreshWith = (next: InkSettings) => {
      Object.assign(settings, next);
      input.refresh();
    };

    return { dom, viewer, model, input, pointer, selectStart, styleElement, rootClassed, refreshWith };
  }

  it("blocks selection with CSS and cancels selectstart while a gesture is active", () => {
    const h = harness();

    h.viewer.dispatchEvent(h.pointer("pointerdown", 1, true));
    expect(h.rootClassed()).toBe(true);
    const style = h.styleElement();
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain("user-select: none");
    expect(style!.textContent).toContain("!important");

    const select = h.selectStart();
    h.viewer.dispatchEvent(select);
    expect(select.defaultPrevented).toBe(true);

    h.viewer.dispatchEvent(h.pointer("pointerup", 1, true));
    expect(h.rootClassed()).toBe(false);
    expect(h.styleElement()).toBeNull();
    h.input.destroy();
  });

  it("leaves unclaimed drags selectable and only cancels selectstart during a gesture", () => {
    const h = harness();

    h.viewer.dispatchEvent(h.pointer("pointerdown", 1));
    expect(h.rootClassed()).toBe(false);
    expect(h.styleElement()).toBeNull();

    const idle = h.selectStart();
    h.viewer.dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);

    h.viewer.dispatchEvent(h.pointer("pointerup", 1));
    h.input.destroy();
  });

  it("releases the block on pointercancel, Escape, blur, and disable refresh", () => {
    for (const ending of ["pointercancel", "escape", "blur", "refresh"] as const) {
      const h = harness();
      h.viewer.dispatchEvent(h.pointer("pointerdown", 1, true));
      expect(h.rootClassed()).toBe(true);

      if (ending === "pointercancel") {
        h.viewer.dispatchEvent(h.pointer("pointercancel", 1, true));
      }
      else if (ending === "escape") {
        h.dom.window.dispatchEvent(new h.dom.window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }));
      }
      else if (ending === "blur") {
        h.dom.window.dispatchEvent(new h.dom.window.Event("blur"));
      }
      else {
        h.refreshWith({ ...DEFAULT_SETTINGS, enabled: false });
      }

      expect(h.rootClassed()).toBe(false);
      expect(h.styleElement()).toBeNull();
      h.input.destroy();
    }
  });

  it("cleans up the style and class when destroyed mid-gesture", () => {
    const h = harness();
    h.viewer.dispatchEvent(h.pointer("pointerdown", 1, true));
    expect(h.rootClassed()).toBe(true);
    expect(h.styleElement()).not.toBeNull();

    h.input.destroy();
    expect(h.rootClassed()).toBe(false);
    expect(h.styleElement()).toBeNull();

    // A new gesture after destroy is unclaimed: the controller is inert.
    const after = h.pointer("pointerdown", 2, true);
    h.viewer.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
    expect(h.rootClassed()).toBe(false);
  });

  it("reinjects a single style element across repeated gestures", () => {
    const h = harness();
    for (let gesture = 1; gesture <= 3; gesture++) {
      h.viewer.dispatchEvent(h.pointer("pointerdown", gesture, true));
      expect(h.dom.window.document.querySelectorAll(
        '[data-temporary-ink="selection-block"]',
      ).length).toBe(1);
      h.viewer.dispatchEvent(h.pointer("pointerup", gesture, true));
      expect(h.styleElement()).toBeNull();
    }
    h.input.destroy();
  });

  it("clears a programmatically created selection while a gesture is active", () => {
    const h = harness();
    const removeAllRanges = vi.fn();
    Object.defineProperty(h.dom.window, "getSelection", {
      value: () => ({ rangeCount: 1, removeAllRanges }),
    });

    h.viewer.dispatchEvent(h.pointer("pointerdown", 1, true));
    h.dom.window.document.dispatchEvent(new h.dom.window.Event("selectionchange"));
    expect(removeAllRanges).toHaveBeenCalledTimes(1);

    h.viewer.dispatchEvent(h.pointer("pointerup", 1, true));
    h.dom.window.document.dispatchEvent(new h.dom.window.Event("selectionchange"));
    expect(removeAllRanges).toHaveBeenCalledTimes(1);
    h.input.destroy();
  });

  it("leaves selectionchange alone without a claimed gesture", () => {
    const h = harness();
    const removeAllRanges = vi.fn();
    Object.defineProperty(h.dom.window, "getSelection", {
      value: () => ({ rangeCount: 1, removeAllRanges }),
    });

    h.dom.window.document.dispatchEvent(new h.dom.window.Event("selectionchange"));
    expect(removeAllRanges).not.toHaveBeenCalled();
    h.input.destroy();
  });
});
