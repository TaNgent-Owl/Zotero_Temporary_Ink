import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it } from "vitest";
import { PALETTE_COLORS } from "../src/config/constants";
import { PalettePopover } from "../src/ui/palette";

describe("PalettePopover", () => {
  let dom: JSDOM;
  let stored: Map<string, unknown>;
  let anchor: HTMLButtonElement;

  beforeEach(() => {
    dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
    stored = new Map<string, unknown>([["extensions.temporary-ink.penColor", "#FF4D4F"]]);
    Object.assign(globalThis, {
      Zotero: {
        Prefs: {
          get: (key: string) => stored.get(key),
          set: (key: string, value: unknown) => {
            stored.set(key, value);
          },
        },
      },
    });
    anchor = dom.window.document.createElement("button");
    dom.window.document.body.append(anchor);
  });

  it("opens six swatches and highlights the current color", () => {
    const popover = new PalettePopover(dom.window.document);
    popover.open(anchor);

    const panel = dom.window.document.querySelector('[data-temporary-ink="palette"]');
    expect(panel).not.toBeNull();
    const swatches = dom.window.document.querySelectorAll('[data-temporary-ink="palette-swatch"]');
    expect(swatches.length).toBe(6);
    expect([...swatches].map((swatch) => swatch.getAttribute("data-color"))).toEqual([...PALETTE_COLORS]);

    const current = [...swatches].find((swatch) => swatch.getAttribute("aria-pressed") === "true");
    expect(current).not.toBeUndefined();
    expect(current!.getAttribute("data-color")).toBe("#FF4D4F");

    popover.dispose();
  });

  it("is idempotent: repeated open leaves a single panel", () => {
    const popover = new PalettePopover(dom.window.document);
    popover.open(anchor);
    popover.open(anchor);
    expect(dom.window.document.querySelectorAll('[data-temporary-ink="palette"]').length).toBe(1);
    popover.dispose();
  });

  it("selects a swatch by writing the pref and closes", () => {
    const popover = new PalettePopover(dom.window.document);
    popover.open(anchor);
    const swatch = dom.window.document.querySelector(
      '[data-color="#1677FF"]',
    ) as HTMLButtonElement;
    swatch.click();
    expect(stored.get("extensions.temporary-ink.penColor")).toBe("#1677FF");
    expect(dom.window.document.querySelector('[data-temporary-ink="palette"]')).toBeNull();
    popover.dispose();
  });

  it("closes on an outside pointerdown and on Escape", () => {
    const popover = new PalettePopover(dom.window.document);
    popover.open(anchor);
    expect(popover.isOpen).toBe(true);

    const outside = dom.window.document.createElement("div");
    dom.window.document.body.append(outside);
    outside.dispatchEvent(new dom.window.MouseEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
    }));
    expect(popover.isOpen).toBe(false);
    expect(dom.window.document.querySelector('[data-temporary-ink="palette"]')).toBeNull();

    popover.open(anchor);
    expect(popover.isOpen).toBe(true);
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    }));
    expect(popover.isOpen).toBe(false);

    popover.dispose();
  });

  it("keeps the panel open when the pointerdown lands inside a swatch", () => {
    const popover = new PalettePopover(dom.window.document);
    popover.open(anchor);
    const swatch = dom.window.document.querySelector(
      '[data-color="#722ED1"]',
    ) as HTMLButtonElement;
    swatch.dispatchEvent(new dom.window.MouseEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
    }));
    expect(popover.isOpen).toBe(true);
    popover.dispose();
  });

  it("cleans up element and listeners on dispose with no residue", () => {
    const popover = new PalettePopover(dom.window.document);
    popover.open(anchor);
    expect(dom.window.document.querySelector('[data-temporary-ink="palette"]')).not.toBeNull();

    popover.dispose();
    expect(dom.window.document.querySelector('[data-temporary-ink="palette"]')).toBeNull();

    // dispose is idempotent and a disposed popover never reopens.
    popover.dispose();
    popover.open(anchor);
    expect(dom.window.document.querySelector('[data-temporary-ink="palette"]')).toBeNull();
  });
});
