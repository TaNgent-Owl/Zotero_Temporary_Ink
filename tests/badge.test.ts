import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type InkSettings } from "../src/config/constants";
import type { ReaderContext } from "../src/reader/reader-adapter";
import { ReaderController } from "../src/reader/reader-controller";
import { CornerBadge } from "../src/ui/badge";

describe("CornerBadge", () => {
  beforeEach(() => {
    Object.assign(globalThis, { Zotero: { locale: "en-US" } });
  });

  function harness(locale = "en-US") {
    Object.assign(globalThis, { Zotero: { locale } });
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
    const settings = { ...DEFAULT_SETTINGS, penColor: "#123456", penWidth: 7 };
    const badge = new CornerBadge(
      dom.window as unknown as Window & typeof globalThis,
      () => settings,
    );
    const host = dom.window.document.body;
    const element = () => dom.window.document.querySelector(
      '[data-temporary-ink="badge"]',
    ) as HTMLElement;
    return { dom, badge, host, settings, element };
  }

  it("mounts hidden with fixed, non-interactive, lower-than-canvas styles", () => {
    const { dom, badge, host, element } = harness();
    badge.mount(host);
    const el = element();
    expect(el).not.toBeNull();
    expect(el.style.display).toBe("none");
    expect(el.style.position).toBe("fixed");
    expect(el.style.pointerEvents).toBe("none");
    expect(el.style.zIndex).toBe("2147482999");
    expect(dom.window.document.querySelectorAll('[data-temporary-ink="badge"]')).toHaveLength(1);
  });

  it("renders the tool name, width, and color dot on show and hides again", () => {
    const { badge, host, element } = harness();
    badge.mount(host);
    const el = element();

    badge.show("pen");
    expect(el.style.display).toBe("flex");
    expect(el.textContent).toContain("Pen");
    expect(el.textContent).toContain("7 px");
    const dot = el.querySelector(".temporary-ink-badge-dot") as HTMLElement;
    expect(dot.style.backgroundColor).toBe("rgb(18, 52, 86)");

    badge.hide();
    expect(el.style.display).toBe("none");
    badge.dispose();
  });

  it("re-renders content on update only while visible", () => {
    const { badge, host, settings, element } = harness();
    badge.mount(host);
    const el = element();
    const dot = el.querySelector(".temporary-ink-badge-dot") as HTMLElement;

    badge.show("rectangle");
    expect(el.textContent).toContain("Rectangle");
    expect(el.textContent).toContain("7 px");
    expect(dot.style.backgroundColor).toBe("rgb(18, 52, 86)");

    settings.penColor = "#abcdef";
    settings.penWidth = 12;
    badge.update();
    expect(el.textContent).toContain("12 px");
    expect(dot.style.backgroundColor).toBe("rgb(171, 205, 239)");

    badge.hide();
    settings.penColor = "#000000";
    badge.update();
    expect(el.style.display).toBe("none");
    badge.dispose();
  });

  it("auto-hides after one second and re-arms the timer on re-show", () => {
    const { dom, badge, host, element } = harness();
    badge.mount(host);
    const el = element();
    const scheduled: Array<{ callback: () => void; delay: number }> = [];
    dom.window.setTimeout = ((callback: () => void, delay: number) => {
      scheduled.push({ callback, delay });
      return scheduled.length;
    }) as unknown as typeof dom.window.setTimeout;
    dom.window.clearTimeout = (() => {}) as unknown as typeof dom.window.clearTimeout;

    badge.show("pen");
    expect(el.style.display).toBe("flex");
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].delay).toBe(1000);

    scheduled[0].callback();
    expect(el.style.display).toBe("none");

    badge.show("rectangle");
    expect(el.style.display).toBe("flex");
    expect(scheduled).toHaveLength(2);
    scheduled[1].callback();
    expect(el.style.display).toBe("none");
    badge.dispose();
  });

  it("clears its timer and leaves no DOM behind when disposed (idempotent)", () => {
    const { dom, badge, host } = harness();
    badge.mount(host);
    const scheduled: Array<() => void> = [];
    let cleared = 0;
    dom.window.setTimeout = ((callback: () => void) => {
      scheduled.push(callback);
      return scheduled.length;
    }) as unknown as typeof dom.window.setTimeout;
    dom.window.clearTimeout = (() => {
      cleared++;
    }) as unknown as typeof dom.window.clearTimeout;

    badge.show("pen");
    expect(scheduled).toHaveLength(1);
    badge.dispose();
    expect(cleared).toBeGreaterThan(0);
    expect(dom.window.document.querySelector('[data-temporary-ink="badge"]')).toBeNull();
    badge.dispose();
    expect(dom.window.document.querySelector('[data-temporary-ink="badge"]')).toBeNull();
  });

  it("falls back to Chinese for zh locales and English otherwise", () => {
    const zh = harness("zh-CN");
    zh.badge.mount(zh.host);
    zh.badge.show("rectangle");
    expect(zh.element().textContent).toContain("框选");

    const en = harness("en-US");
    en.badge.mount(en.host);
    en.badge.show("pen");
    expect(en.element().textContent).toContain("Pen");

    zh.badge.dispose();
    en.badge.dispose();
  });

  it("prefers the viewer document l10n when available", async () => {
    const { dom, badge, host, element } = harness();
    const formatValues = vi.fn().mockResolvedValue(["画笔"]);
    Object.defineProperty(dom.window.document, "l10n", {
      configurable: true,
      value: { formatValues },
    });
    badge.mount(host);

    badge.show("pen");
    expect(element().textContent).toContain("Pen");

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(formatValues).toHaveBeenCalledWith([{ id: "temporary-ink-mode-pen" }]);
    expect(element().textContent).toContain("画笔");
    badge.dispose();
  });
});

describe("ReaderController badge wiring", () => {
  beforeEach(() => {
    Object.assign(globalThis, { Zotero: { locale: "en-US", debug() {} } });
  });

  function controllerHarness(initial: Partial<InkSettings> = {}) {
    const dom = new JSDOM(
      '<!doctype html><html><head></head><body><div id="viewerContainer"></div></body></html>',
      { pretendToBeVisual: true },
    );
    const viewer = dom.window.document.getElementById("viewerContainer")!;
    Object.defineProperty(viewer, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 }),
    });
    dom.window.HTMLCanvasElement.prototype.getContext = (() => ({
      setTransform() {},
      clearRect() {},
    })) as unknown as typeof dom.window.HTMLCanvasElement.prototype.getContext;

    const settings: InkSettings = { ...DEFAULT_SETTINGS, ...initial };
    const context: ReaderContext = {
      reader: {},
      window: dom.window as unknown as Window & typeof globalThis,
      document: dom.window.document,
      viewerElement: viewer,
      overlayHost: dom.window.document.body,
      isPDF: true,
      onViewportChange() {
        return () => {};
      },
      onClose() {
        return () => {};
      },
      dispose() {},
    };
    const controller = new ReaderController(context, () => settings, () => {});
    controller.init();
    const element = dom.window.document.querySelector(
      '[data-temporary-ink="badge"]',
    ) as HTMLElement;

    const key = (type: string, init: {
      key?: string;
      ctrlKey?: boolean;
      altKey?: boolean;
      shiftKey?: boolean;
    } = {}) => new dom.window.KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });

    const pointer = (type: string, init: {
      button?: number;
      clientX?: number;
      clientY?: number;
    } = {}) => {
      const event = new dom.window.MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: init.button ?? 0,
        clientX: init.clientX ?? 10,
        clientY: init.clientY ?? 20,
      });
      Object.defineProperty(event, "isPrimary", { value: true });
      return event;
    };

    return { dom, settings, controller, element, key, pointer };
  }

  it("shows on a modifier press in OFF mode and hides on release without consuming events", () => {
    const h = controllerHarness();
    expect(h.element.style.display).toBe("none");

    const down = h.key("keydown", { key: "Control", ctrlKey: true });
    h.dom.window.dispatchEvent(down);
    expect(h.element.style.display).toBe("flex");
    expect(h.element.textContent).toContain("Pen");
    expect(down.defaultPrevented).toBe(false);

    h.dom.window.dispatchEvent(h.key("keyup", { key: "Control" }));
    expect(h.element.style.display).toBe("none");
    h.controller.destroy();
  });

  it("shows in PEN mode on pointerdown inside the viewer and hides on pointerup", () => {
    const h = controllerHarness();
    h.controller.setMode("pen");
    h.dom.window.dispatchEvent(h.pointer("pointerdown"));
    expect(h.element.style.display).toBe("flex");
    expect(h.element.textContent).toContain("Pen");

    h.dom.window.dispatchEvent(h.pointer("pointerup"));
    expect(h.element.style.display).toBe("none");
    h.controller.destroy();
  });

  it("ignores a pointerdown outside the viewer rectangle", () => {
    const h = controllerHarness();
    h.controller.setMode("pen");
    h.dom.window.dispatchEvent(h.pointer("pointerdown", { clientX: 600, clientY: 20 }));
    expect(h.element.style.display).toBe("none");
    h.controller.destroy();
  });

  it("hides the badge on Escape", () => {
    const h = controllerHarness();
    h.controller.setMode("pen");
    h.dom.window.dispatchEvent(h.pointer("pointerdown"));
    expect(h.element.style.display).toBe("flex");

    h.dom.window.dispatchEvent(h.key("keydown", { key: "Escape" }));
    expect(h.element.style.display).toBe("none");
    h.controller.destroy();
  });

  it("never shows while disabled and hides on disable via refreshSettings", () => {
    const h = controllerHarness({ enabled: false });
    h.dom.window.dispatchEvent(h.key("keydown", { key: "Control", ctrlKey: true }));
    expect(h.element.style.display).toBe("none");

    h.settings.enabled = true;
    h.dom.window.dispatchEvent(h.key("keydown", { key: "Control", ctrlKey: true }));
    expect(h.element.style.display).toBe("flex");

    h.settings.enabled = false;
    h.controller.refreshSettings();
    expect(h.element.style.display).toBe("none");
    h.controller.destroy();
  });
});
