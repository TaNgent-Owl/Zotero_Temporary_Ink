import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolMode } from "../src/config/constants";
import { DisposableSlot } from "../src/utils/disposable";
import { mountToolbar, type ToolbarControl } from "../src/ui/toolbar";

describe("toolbar lifecycle", () => {
  beforeEach(() => {
    Object.assign(globalThis, {
      Zotero: {
        locale: "en-US",
        Prefs: {
          get(key: string) {
            return key === "extensions.temporary-ink.penColor" ? "#FF4D4F" : undefined;
          },
          set() {},
        },
      },
    });
  });

  it("replaces a detached control through the controller-owned slot", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
    let mode: ToolMode = "off";
    let clicks = 0;
    const listeners = new Set<(value: ToolMode) => void>();
    const toolbarSlot = new DisposableSlot<ToolbarControl>();
    const controller = {
      setMode(nextMode: ToolMode) {
        mode = nextMode;
        for (const listener of listeners) listener(mode);
      },
      cycleMode() {
        clicks++;
        mode = mode === "off" ? "pen" : mode === "pen" ? "rectangle" : "off";
        for (const listener of listeners) listener(mode);
      },
      subscribeMode(listener: (value: ToolMode) => void) {
        listeners.add(listener);
        listener(mode);
        return () => listeners.delete(listener);
      },
      replaceToolbarControl(control: ToolbarControl) {
        toolbarSlot.replace(control);
      },
      clearToolbarControl() {
        toolbarSlot.dispose();
      },
    };
    const event = {
      doc: dom.window.document,
      append: (...elements: Element[]) => dom.window.document.body.append(...elements),
    } as unknown as ZoteroReaderEvent;

    const first = mountToolbar(event);
    expect(first).not.toBeNull();
    expect(first!.element.disabled).toBe(false);
    expect(first!.element.getAttribute("aria-busy")).toBe("true");
    first!.element.click();
    expect(first!.element.dataset.mode).toBe("pen");
    expect(clicks).toBe(0);
    first!.bind(controller);
    expect(first!.element.disabled).toBe(false);
    expect(first!.element.hasAttribute("aria-busy")).toBe(false);
    expect(mode).toBe("pen");
    expect(first!.element.querySelector('svg[viewBox="0 0 20 20"]')).not.toBeNull();
    expect(first!.element.querySelectorAll('svg [fill="currentColor"]').length).toBe(1);
    first!.element.click();
    expect(clicks).toBe(1);
    expect(first!.element.dataset.mode).toBe("rectangle");
    expect(first!.element.classList.contains("active")).toBe(true);
    first!.element.remove();
    expect(dom.window.document.querySelector('[data-temporary-ink="toolbar"]')).toBeNull();

    const second = mountToolbar(event);
    expect(second).not.toBeNull();
    second!.bind(controller);
    expect(listeners.size).toBe(1);
    expect(second!.element).not.toBe(first!.element);
    first!.element.click();
    expect(clicks).toBe(1);
    second!.element.click();
    expect(clicks).toBe(2);
    toolbarSlot.dispose();
    expect(listeners.size).toBe(0);
    expect(dom.window.document.querySelector('[data-temporary-ink="toolbar"]')).toBeNull();
    expect(dom.window.document.querySelector('[data-temporary-ink="localization"]')).toBeNull();
  });

  it("is idempotent while a control is mounted", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
    const controller = {
      cycleMode() {},
      setMode() {},
      subscribeMode(listener: (value: ToolMode) => void) {
        listener("off");
        return () => {};
      },
      clearToolbarControl() {},
      replaceToolbarControl() {},
    };
    const event = {
      doc: dom.window.document,
      append: (...elements: Element[]) => dom.window.document.body.append(...elements),
    } as unknown as ZoteroReaderEvent;
    const control = mountToolbar(event);
    control!.bind(controller);
    expect(mountToolbar(event)).toBeNull();
    control!.dispose();
  });

  it("calls Zotero's append hook synchronously before controller binding", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
    let callbackActive = true;
    let appended = false;
    const event = {
      doc: dom.window.document,
      append: (...elements: Element[]) => {
        expect(callbackActive).toBe(true);
        appended = true;
        dom.window.document.body.append(...elements);
      },
    } as unknown as ZoteroReaderEvent;

    const control = mountToolbar(event);
    callbackActive = false;

    expect(appended).toBe(true);
    expect(control!.element.disabled).toBe(false);
    expect(control!.element.getAttribute("aria-busy")).toBe("true");
    control!.dispose();
  });

  it("swaps the SVG icon per mode and restores the OFF icon", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
    let mode: ToolMode = "off";
    const listeners = new Set<(value: ToolMode) => void>();
    const controller = {
      setMode(nextMode: ToolMode) {
        mode = nextMode;
        for (const listener of listeners) listener(mode);
      },
      cycleMode() {
        mode = mode === "off" ? "pen" : mode === "pen" ? "rectangle" : "off";
        for (const listener of listeners) listener(mode);
      },
      subscribeMode(listener: (value: ToolMode) => void) {
        listeners.add(listener);
        listener(mode);
        return () => listeners.delete(listener);
      },
      replaceToolbarControl() {},
    };
    const event = {
      doc: dom.window.document,
      append: (...elements: Element[]) => dom.window.document.body.append(...elements),
    } as unknown as ZoteroReaderEvent;

    const control = mountToolbar(event);
    const button = control!.element;
    const fillCount = () => button.querySelectorAll('svg [fill="currentColor"]').length;

    expect(fillCount()).toBe(3); // OFF: pen nib + two fade dots
    button.click();
    expect(button.dataset.mode).toBe("pen");
    expect(fillCount()).toBe(1); // PEN: single filled brush tip

    control!.bind(controller);
    expect(fillCount()).toBe(1);

    button.click();
    expect(button.dataset.mode).toBe("rectangle");
    expect(fillCount()).toBe(0); // RECTANGLE: stroked outline only

    button.click();
    expect(button.dataset.mode).toBe("off");
    expect(fillCount()).toBe(3); // OFF restored
    expect(button.classList.contains("active")).toBe(false);

    control!.dispose();
  });

  it("opens the palette on a long press without cycling the mode", () => {
    vi.useFakeTimers();
    try {
      const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
      let mode: ToolMode = "off";
      const listeners = new Set<(value: ToolMode) => void>();
      const controller = {
        setMode(nextMode: ToolMode) {
          mode = nextMode;
          for (const listener of listeners) listener(mode);
        },
        cycleMode() {
          mode = mode === "off" ? "pen" : mode === "pen" ? "rectangle" : "off";
          for (const listener of listeners) listener(mode);
        },
        subscribeMode(listener: (value: ToolMode) => void) {
          listeners.add(listener);
          listener(mode);
          return () => listeners.delete(listener);
        },
        replaceToolbarControl() {},
      };
      const event = {
        doc: dom.window.document,
        append: (...elements: Element[]) => dom.window.document.body.append(...elements),
      } as unknown as ZoteroReaderEvent;

      const control = mountToolbar(event)!;
      control.bind(controller);
      const button = control.element;

      button.dispatchEvent(new dom.window.MouseEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 10,
        clientY: 10,
      }));
      vi.advanceTimersByTime(500);

      expect(dom.window.document.querySelector('[data-temporary-ink="palette"]')).not.toBeNull();
      expect(mode).toBe("off");

      button.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, cancelable: true }));
      button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(mode).toBe("off"); // the suppressed click must not cycle the mode

      control.dispose();
      expect(dom.window.document.querySelector('[data-temporary-ink="palette"]')).toBeNull();
    }
    finally {
      vi.useRealTimers();
    }
  });
});
