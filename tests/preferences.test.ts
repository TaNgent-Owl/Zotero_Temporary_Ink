import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("../preferences/preferences.js", import.meta.url));
const panePath = fileURLToPath(new URL("../preferences/preferences.xhtml", import.meta.url));

// Mirrors Zotero 9's _parseXHTMLToFragment(): the pane markup is embedded in a
// wrapper <div> and parsed with a XML DOMParser; any 'parsererror' document
// aborts pane loading and leaves the preferences pane unopenable.
function parseAsZotero(xhtml: string): Document {
  const dom = new JSDOM("", { runScripts: "outside-only" });
  const parser = new dom.window.DOMParser();
  return parser.parseFromString(
    `<div xmlns="http://www.w3.org/1999/xhtml" `
      + `xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">\n${xhtml}\n</div>`,
    "application/xml",
  );
}

function runScript(dom: JSDOM, script: string): void {
  // Run in the jsdom window global context so the script sees `document` and
  // `MutationObserver`, like Zotero's Cu.Sandbox(window) pane scope.
  vm.runInContext(script, dom.getInternalVMContext());
}

function createWindow(stored: Map<string, unknown>): JSDOM {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
  });
  Object.assign(dom.window, {
    Zotero: {
      Prefs: {
        get: (key: string) => stored.get(key),
        set: (key: string, value: unknown) => {
          stored.set(key, value);
        },
      },
    },
  });
  return dom;
}

const storedPrefs = () => new Map<string, unknown>([
  ["extensions.temporary-ink.enabled", true],
  ["extensions.temporary-ink.modifier", "ctrl"],
  ["extensions.temporary-ink.rectangleModifier", "ctrl"],
  ["extensions.temporary-ink.penColor", "#FF4D4F"],
  ["extensions.temporary-ink.penWidth", "3"],
  ["extensions.temporary-ink.penOpacity", "0.85"],
  ["extensions.temporary-ink.fadeDelay", 300],
  ["extensions.temporary-ink.fadeDuration", 500],
]);

describe("preferences pane script", () => {
  it("waits for the pane markup and then binds and writes back controls", async () => {
    const stored = storedPrefs();
    const dom = createWindow(stored);
    const script = readFileSync(scriptPath, "utf8");

    // Zotero 9 executes pane scripts before the pane markup is inserted.
    runScript(dom, script);
    expect(dom.window.document.getElementById("temporary-ink-enabled")).toBeNull();

    const body = dom.window.document.body;
    body.innerHTML = `
      <div id="temporary-ink-preferences">
        <input id="temporary-ink-enabled" type="checkbox"/>
        <menulist id="temporary-ink-modifier">
          <menupopup>
            <menuitem value="ctrl" label="Ctrl"/>
            <menuitem value="alt" label="Alt"/>
            <menuitem value="ctrl-alt" label="Ctrl+Alt"/>
          </menupopup>
        </menulist>
        <menulist id="temporary-ink-rectangle-modifier">
          <menupopup>
            <menuitem value="ctrl" label="Ctrl + Shift"/>
            <menuitem value="alt" label="Alt + Shift"/>
            <menuitem value="ctrl-alt" label="Ctrl+Alt + Shift"/>
          </menupopup>
        </menulist>
        <input id="temporary-ink-pen-color" type="color"/>
        <input id="temporary-ink-pen-width" type="number"/>
        <input id="temporary-ink-pen-opacity" type="number"/>
        <input id="temporary-ink-fade-delay" type="number"/>
        <input id="temporary-ink-fade-duration" type="number"/>
      </div>`;
    await new Promise((resolve) => setTimeout(resolve, 0));

    const doc = dom.window.document;
    const enabled = doc.getElementById("temporary-ink-enabled") as HTMLInputElement;
    const modifier = doc.getElementById("temporary-ink-modifier") as HTMLElement & {
      value: string;
    };
    const rectangleModifier = doc.getElementById("temporary-ink-rectangle-modifier") as HTMLElement & {
      value: string;
    };
    const penColor = doc.getElementById("temporary-ink-pen-color") as HTMLInputElement;
    const penWidth = doc.getElementById("temporary-ink-pen-width") as HTMLInputElement;
    const fadeDelay = doc.getElementById("temporary-ink-fade-delay") as HTMLInputElement;

    expect(enabled.checked).toBe(true);
    expect(modifier.value).toBe("ctrl");
    expect(rectangleModifier.value).toBe("ctrl");
    expect(penColor.value.toLowerCase()).toBe("#ff4d4f");
    expect(penWidth.valueAsNumber).toBe(3);
    expect(fadeDelay.valueAsNumber).toBe(300);

    modifier.value = "alt";
    modifier.dispatchEvent(new dom.window.Event("command"));
    expect(stored.get("extensions.temporary-ink.modifier")).toBe("alt");

    rectangleModifier.value = "ctrl-alt";
    rectangleModifier.dispatchEvent(new dom.window.Event("command"));
    expect(stored.get("extensions.temporary-ink.rectangleModifier")).toBe("ctrl-alt");

    penWidth.valueAsNumber = 5;
    penWidth.dispatchEvent(new dom.window.Event("change"));
    expect(stored.get("extensions.temporary-ink.penWidth")).toBe("5");

    fadeDelay.valueAsNumber = 450;
    fadeDelay.dispatchEvent(new dom.window.Event("change"));
    expect(stored.get("extensions.temporary-ink.fadeDelay")).toBe(450);
  });

  it("parses as well-formed XHTML under Zotero's fragment parser", () => {
    const xhtml = readFileSync(panePath, "utf8");
    const doc = parseAsZotero(xhtml);
    expect(doc.documentElement.localName).not.toBe("parsererror");
    // The XML declaration would be illegal mid-document inside Zotero's
    // wrapper <div> and turn the parse into parsererror.
    expect(/^\s*<\?xml/.test(xhtml)).toBe(false);
  });

  it("does not throw when the pane content never appears", () => {
    const dom = createWindow(new Map());
    const script = readFileSync(scriptPath, "utf8");
    expect(() => runScript(dom, script)).not.toThrow();
  });
});
