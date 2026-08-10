import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it } from "vitest";
import type { ToolMode } from "../src/config/constants";
import { DisposableSlot } from "../src/utils/disposable";
import { mountToolbar, type ToolbarControl } from "../src/ui/toolbar";

describe("toolbar lifecycle", () => {
  beforeEach(() => {
    Object.assign(globalThis, { Zotero: { locale: "en-US" } });
  });

  it("replaces a detached control through the controller-owned slot", () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
    let mode: ToolMode = "off";
    let clicks = 0;
    const listeners = new Set<(value: ToolMode) => void>();
    const toolbarSlot = new DisposableSlot<ToolbarControl>();
    const controller = {
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

    const first = mountToolbar(event, controller, "resource://temporary-ink/");
    expect(first).not.toBeNull();
    first!.element.click();
    expect(clicks).toBe(1);
    expect(first!.element.dataset.mode).toBe("pen");
    first!.element.remove();
    expect(dom.window.document.querySelector('[data-temporary-ink="toolbar"]')).toBeNull();

    const second = mountToolbar(event, controller, "resource://temporary-ink/");
    expect(second).not.toBeNull();
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
    const control = mountToolbar(event, controller, "resource://temporary-ink/");
    expect(mountToolbar(event, controller, "resource://temporary-ink/")).toBeNull();
    control!.dispose();
  });
});
