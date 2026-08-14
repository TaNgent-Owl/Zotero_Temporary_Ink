import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/constants";
import { InputController } from "../src/ink/input-controller";
import { InkModel } from "../src/ink/ink-model";
import type { InkRenderer } from "../src/ink/ink-renderer";

describe("cursor update caching", () => {
  it("re-reads settings on pointer moves only when modifier state changes", () => {
    Object.assign(globalThis, { Zotero: { debug() {} } });
    const dom = new JSDOM(
      '<!doctype html><html><head></head><body><div id="viewerContainer"></div></body></html>',
      { pretendToBeVisual: true },
    );
    const viewer = dom.window.document.getElementById("viewerContainer")!;
    Object.defineProperty(viewer, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 }),
    });
    const reads = vi.fn(() => ({ ...DEFAULT_SETTINGS }));
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
      reads,
      () => "off",
    );
    input.init();
    const afterInit = reads.mock.calls.length;

    const move = (ctrlKey = false, altKey = false, shiftKey = false) => {
      const event = new dom.window.MouseEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 10,
        clientY: 20,
        ctrlKey,
        altKey,
        shiftKey,
      });
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        pointerType: { value: "mouse" },
        isPrimary: { value: true },
      });
      viewer.dispatchEvent(event);
    };

    // First move with plain modifiers re-reads once, then repeated identical
    // moves are cached and must not touch the settings provider again.
    move();
    expect(reads.mock.calls.length).toBe(afterInit + 1);
    move();
    move();
    expect(reads.mock.calls.length).toBe(afterInit + 1);

    // A modifier change re-reads; unchanged moves stay cached again.
    move(true);
    expect(reads.mock.calls.length).toBe(afterInit + 2);
    move(true);
    expect(reads.mock.calls.length).toBe(afterInit + 2);
    move();
    expect(reads.mock.calls.length).toBe(afterInit + 3);
    expect(viewer.style.cursor).toBe("");
    input.destroy();
  });

  it("always recomputes on event-less calls such as mode or settings refresh", () => {
    Object.assign(globalThis, { Zotero: { debug() {} } });
    const dom = new JSDOM(
      '<!doctype html><html><head></head><body><div id="viewerContainer"></div></body></html>',
      { pretendToBeVisual: true },
    );
    const viewer = dom.window.document.getElementById("viewerContainer")!;
    Object.defineProperty(viewer, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 }),
    });
    const settings = { ...DEFAULT_SETTINGS };
    const reads = vi.fn(() => settings);
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
      reads,
      () => "pen",
    );
    input.init();
    expect(viewer.style.cursor).toBe("crosshair");
    const afterInit = reads.mock.calls.length;

    // refresh() checks enabled once and then recomputes the cursor once, so
    // each refresh re-reads exactly twice; the cache must not skip either read.
    input.refresh();
    expect(reads.mock.calls.length).toBe(afterInit + 2);
    input.refresh();
    expect(reads.mock.calls.length).toBe(afterInit + 4);
    input.destroy();
  });
});
