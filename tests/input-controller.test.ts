import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, PALETTE_COLORS, type InkSettings } from "../src/config/constants";
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

describe("shortcut keys", () => {
  function harness(overrides: Partial<InkSettings> = {}) {
    const stored = new Map<string, unknown>([
      ["extensions.temporary-ink.penColor", "#FF4D4F"],
      ["extensions.temporary-ink.penWidth", "3"],
    ]);
    Object.assign(globalThis, {
      Zotero: {
        debug() {},
        Prefs: {
          get: (key: string) => stored.get(key),
          set: (key: string, value: unknown) => {
            stored.set(key, value);
          },
        },
      },
    });
    const dom = new JSDOM(
      '<!doctype html><html><body><div id="viewerContainer"></div></body></html>',
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
    const settings = { ...DEFAULT_SETTINGS, ...overrides };
    const input = new InputController(
      dom.window as never,
      viewer as unknown as HTMLElement,
      model,
      renderer,
      () => settings,
      () => "off",
    );
    input.init();
    const key = (keyName: string, init: KeyboardEventInit = {}) =>
      new dom.window.KeyboardEvent("keydown", {
        key: keyName,
        bubbles: true,
        cancelable: true,
        ...init,
      });
    return { dom, input, stored, key };
  }

  it("writes the palette color for keys 1-6", () => {
    const h = harness();
    const event = h.key("3");
    h.dom.window.dispatchEvent(event);
    expect(h.stored.get("extensions.temporary-ink.penColor")).toBe(PALETTE_COLORS[2]);
    expect(event.defaultPrevented).toBe(false);
    h.input.destroy();
  });

  it("adjusts the pen width with [ and ]", () => {
    const h = harness();
    h.dom.window.dispatchEvent(h.key("["));
    expect(h.stored.get("extensions.temporary-ink.penWidth")).toBe(2);
    h.dom.window.dispatchEvent(h.key("]"));
    expect(h.stored.get("extensions.temporary-ink.penWidth")).toBe(3);
    h.input.destroy();
  });

  it("clamps the pen width at 1 and 20", () => {
    const h = harness();
    h.stored.set("extensions.temporary-ink.penWidth", 1);
    h.dom.window.dispatchEvent(h.key("["));
    expect(h.stored.get("extensions.temporary-ink.penWidth")).toBe(1);

    h.stored.set("extensions.temporary-ink.penWidth", 20);
    h.dom.window.dispatchEvent(h.key("]"));
    expect(h.stored.get("extensions.temporary-ink.penWidth")).toBe(20);
    h.input.destroy();
  });

  it("ignores shortcuts when a modifier key is pressed", () => {
    const h = harness();
    const event = h.key("2", { ctrlKey: true });
    h.dom.window.dispatchEvent(event);
    expect(h.stored.get("extensions.temporary-ink.penColor")).toBe("#FF4D4F");
    expect(event.defaultPrevented).toBe(false);
    h.input.destroy();
  });

  it("ignores shortcuts while disabled", () => {
    const h = harness({ enabled: false });
    h.dom.window.dispatchEvent(h.key("2"));
    expect(h.stored.get("extensions.temporary-ink.penColor")).toBe("#FF4D4F");
    h.input.destroy();
  });

  it("ignores shortcuts while typing in an editable target", () => {
    const h = harness();
    const field = h.dom.window.document.createElement("input");
    h.dom.window.document.body.append(field);
    field.dispatchEvent(h.key("2"));
    expect(h.stored.get("extensions.temporary-ink.penColor")).toBe("#FF4D4F");
    h.input.destroy();
  });
});
