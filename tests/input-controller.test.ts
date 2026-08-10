import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/constants";
import { InputController, resolveGestureTool } from "../src/ink/input-controller";
import { InkModel } from "../src/ink/ink-model";
import type { InkRenderer } from "../src/ink/ink-renderer";

describe("gesture claiming", () => {
  const keys = (ctrlKey = false, shiftKey = false, altKey = false) => ({
    altKey,
    shiftKey,
    ctrlKey,
  });

  it("leaves a plain drag unclaimed while the toolbar is off", () => {
    expect(resolveGestureTool({ ...DEFAULT_SETTINGS }, "off", keys())).toBe("off");
  });

  it("allows toolbar modes to claim plain drags", () => {
    expect(resolveGestureTool({ ...DEFAULT_SETTINGS }, "pen", keys())).toBe("pen");
    expect(resolveGestureTool({ ...DEFAULT_SETTINGS }, "rectangle", keys())).toBe("rectangle");
  });

  it("uses Ctrl as an off-mode override", () => {
    expect(resolveGestureTool({ ...DEFAULT_SETTINGS }, "off", keys(true))).toBe("pen");
    expect(resolveGestureTool({ ...DEFAULT_SETTINGS }, "off", keys(true, true))).toBe("rectangle");
  });

  it("does not claim Alt or Ctrl+Alt and respects disablement", () => {
    expect(resolveGestureTool({ ...DEFAULT_SETTINGS }, "off", keys(false, false, true))).toBe("off");
    expect(resolveGestureTool({ ...DEFAULT_SETTINGS }, "off", keys(true, false, true))).toBe("off");
    expect(resolveGestureTool({ ...DEFAULT_SETTINGS, enabled: false }, "pen", keys(true))).toBe("off");
  });

  it("honors a configured Alt modifier", () => {
    const settings = { ...DEFAULT_SETTINGS, modifier: "alt" as const };
    expect(resolveGestureTool(settings, "off", keys(false, false, true))).toBe("pen");
    expect(resolveGestureTool(settings, "off", keys(false, true, true))).toBe("off");
    expect(resolveGestureTool(settings, "off", keys(true))).toBe("off");
    expect(resolveGestureTool(settings, "off", keys(true, false, true))).toBe("off");
  });

  it("honors a configured Ctrl+Alt modifier", () => {
    const settings = { ...DEFAULT_SETTINGS, modifier: "ctrl-alt" as const };
    expect(resolveGestureTool(settings, "off", keys(true, false, true))).toBe("pen");
    expect(resolveGestureTool(settings, "off", keys(true, true, true))).toBe("off");
    expect(resolveGestureTool(settings, "off", keys(true))).toBe("off");
    expect(resolveGestureTool(settings, "off", keys(false, false, true))).toBe("off");
  });

  it("keeps the default Ctrl modifier while Alt+Shift drives a rectangle", () => {
    const settings = { ...DEFAULT_SETTINGS, rectangleModifier: "alt" as const };
    expect(resolveGestureTool(settings, "off", keys(true))).toBe("pen");
    expect(resolveGestureTool(settings, "off", keys(true, true))).toBe("off");
    expect(resolveGestureTool(settings, "off", keys(false, true, true))).toBe("rectangle");
    expect(resolveGestureTool(settings, "off", keys(false, false, true))).toBe("off");
  });

  it("supports a Ctrl+Alt rectangle modifier alongside a plain Ctrl pen", () => {
    const settings = { ...DEFAULT_SETTINGS, rectangleModifier: "ctrl-alt" as const };
    expect(resolveGestureTool(settings, "off", keys(true))).toBe("pen");
    expect(resolveGestureTool(settings, "off", keys(true, true, true))).toBe("rectangle");
    expect(resolveGestureTool(settings, "off", keys(true, false, true))).toBe("off");
  });

  it("leaves ordinary and Alt DOM drags untouched and fully owns only a Ctrl gesture", () => {
    Object.assign(globalThis, { Zotero: { debug() {} } });
    const dom = new JSDOM(
      "<!doctype html><html><body><div id=\"viewerContainer\"></div></body></html>",
      { pretendToBeVisual: true },
    );
    const viewer = dom.window.document.getElementById("viewerContainer")!;
    Object.defineProperty(viewer, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 }),
    });
    const model = new InkModel();
    const invalidate = vi.fn();
    const clear = vi.fn(() => model.clear());
    const renderer = {
      pointFromClient: (x: number, y: number, t: number) => ({ x, y, t }),
      invalidate,
      clear,
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

    const pointer = (type: string, pointerId: number, ctrlKey = false, altKey = false) => {
      const event = new dom.window.MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 10,
        clientY: 20,
        ctrlKey,
        altKey,
      });
      Object.defineProperties(event, {
        pointerId: { value: pointerId },
        pointerType: { value: "mouse" },
        isPrimary: { value: true },
      });
      return event;
    };

    const ordinary = pointer("pointerdown", 1);
    viewer.dispatchEvent(ordinary);
    expect(ordinary.defaultPrevented).toBe(false);
    expect(model.hasVisibleStrokes).toBe(false);

    const alt = pointer("pointerdown", 2, false, true);
    viewer.dispatchEvent(alt);
    expect(alt.defaultPrevented).toBe(false);
    expect(model.hasActiveStroke).toBe(false);

    const down = pointer("pointerdown", 3, true);
    viewer.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(model.hasActiveStroke).toBe(true);
    expect(viewer.style.cursor).toBe("crosshair");
    const up = pointer("pointerup", 3, true);
    viewer.dispatchEvent(up);
    expect(up.defaultPrevented).toBe(true);
    expect(model.hasActiveStroke).toBe(false);
    expect(model.hasVisibleStrokes).toBe(true);
    expect(viewer.style.cursor).toBe("crosshair");

    const escape = new dom.window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    dom.window.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(model.hasVisibleStrokes).toBe(false);
    const idleEscape = new dom.window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    dom.window.dispatchEvent(idleEscape);
    expect(idleEscape.defaultPrevented).toBe(false);

    input.destroy();
    expect(viewer.style.cursor).toBe("");
    const afterDestroy = pointer("pointerdown", 4, true);
    viewer.dispatchEvent(afterDestroy);
    expect(afterDestroy.defaultPrevented).toBe(false);
    expect(invalidate).toHaveBeenCalled();
    expect(clear).toHaveBeenCalled();
  });
});
