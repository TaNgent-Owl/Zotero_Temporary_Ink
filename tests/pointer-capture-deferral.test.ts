import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/constants";
import { InputController } from "../src/ink/input-controller";
import { InkModel } from "../src/ink/ink-model";
import type { InkRenderer } from "../src/ink/ink-renderer";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("pointer capture deferral", () => {
  function harness() {
    Object.assign(globalThis, { Zotero: { debug() {} } });
    const dom = new JSDOM(
      '<!doctype html><html><head></head><body><div id="viewerContainer"></div></body></html>',
      { pretendToBeVisual: true },
    );
    const viewer = dom.window.document.getElementById("viewerContainer")!;
    Object.defineProperty(viewer, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 }),
    });
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperty(viewer, "setPointerCapture", { value: setPointerCapture });
    Object.defineProperty(viewer, "releasePointerCapture", { value: releasePointerCapture });
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
      () => ({ ...DEFAULT_SETTINGS }),
      () => "off",
    );
    input.init();

    const pointer = (type: string, pointerId: number, ctrlKey = true) => {
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

    return { dom, viewer, model, input, pointer, setPointerCapture, releasePointerCapture };
  }

  it("does not capture during pointerdown and captures exactly once on pointermove", () => {
    const h = harness();

    h.viewer.dispatchEvent(h.pointer("pointerdown", 1));
    // Capture must not be active while the compatibility mousedown is
    // dispatched, or preventDefault() loses its suppression of that mousedown.
    expect(h.setPointerCapture).not.toHaveBeenCalled();

    h.viewer.dispatchEvent(h.pointer("pointermove", 1));
    expect(h.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(h.setPointerCapture).toHaveBeenCalledWith(1);

    h.viewer.dispatchEvent(h.pointer("pointermove", 1));
    expect(h.setPointerCapture).toHaveBeenCalledTimes(1);

    h.viewer.dispatchEvent(h.pointer("pointerup", 1));
    expect(h.releasePointerCapture).toHaveBeenCalledWith(1);
    h.input.destroy();
  });

  it("engages capture through the zero-delay fallback when the pointer never moves", async () => {
    const h = harness();

    h.viewer.dispatchEvent(h.pointer("pointerdown", 1));
    expect(h.setPointerCapture).not.toHaveBeenCalled();

    await sleep(15);
    expect(h.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(h.setPointerCapture).toHaveBeenCalledWith(1);

    h.viewer.dispatchEvent(h.pointer("pointerup", 1));
    h.input.destroy();
  });

  it("never captures a gesture that ends before any move or timer", async () => {
    const h = harness();

    h.viewer.dispatchEvent(h.pointer("pointerdown", 1));
    h.viewer.dispatchEvent(h.pointer("pointerup", 1));
    expect(h.setPointerCapture).not.toHaveBeenCalled();

    await sleep(15);
    expect(h.setPointerCapture).not.toHaveBeenCalled();
    h.input.destroy();
  });

  it("cancels the deferred capture when the gesture is cancelled", async () => {
    const h = harness();

    h.viewer.dispatchEvent(h.pointer("pointerdown", 1));
    h.viewer.dispatchEvent(h.pointer("pointercancel", 1));
    await sleep(15);
    expect(h.setPointerCapture).not.toHaveBeenCalled();

    h.input.destroy();
    expect(h.setPointerCapture).not.toHaveBeenCalled();
  });
});
