/* global Zotero */

// Zotero 9 runs pane scripts (Zotero.PreferencePanes `scripts`) *before* the
// pane markup is read and inserted into the preferences window, so the DOM
// elements are not present when this script executes. Wait for them instead of
// initializing immediately.

(() => {
  const keys = {
    enabled: "extensions.temporary-ink.enabled",
    modifier: "extensions.temporary-ink.modifier",
    rectangleModifier: "extensions.temporary-ink.rectangleModifier",
    penColor: "extensions.temporary-ink.penColor",
    penWidth: "extensions.temporary-ink.penWidth",
    penOpacity: "extensions.temporary-ink.penOpacity",
    fadeDelay: "extensions.temporary-ink.fadeDelay",
    fadeDuration: "extensions.temporary-ink.fadeDuration",
  };
  const fields = {
    enabled: ["temporary-ink-enabled", "checked"],
    modifier: ["temporary-ink-modifier", "value"],
    rectangleModifier: ["temporary-ink-rectangle-modifier", "value"],
    penColor: ["temporary-ink-pen-color", "value"],
    penWidth: ["temporary-ink-pen-width", "valueAsNumber"],
    penOpacity: ["temporary-ink-pen-opacity", "valueAsNumber"],
    fadeDelay: ["temporary-ink-fade-delay", "valueAsNumber"],
    fadeDuration: ["temporary-ink-fade-duration", "valueAsNumber"],
  };

  function initialize() {
    for (const [name, [id, property]] of Object.entries(fields)) {
      const element = document.getElementById(id);
      if (!element) return false;
      element[property] = Zotero.Prefs.get(keys[name], true);
      const eventName = element.tagName.toLowerCase() === "menulist" ? "command" : "change";
      element.addEventListener(eventName, () => {
        const value = name === "penOpacity" || name === "penWidth"
          ? String(element[property])
          : element[property];
        Zotero.Prefs.set(keys[name], value, true);
      });
    }
    return true;
  }

  function waitForPane() {
    if (initialize()) return;
    const observer = new MutationObserver(() => {
      if (initialize()) observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  }

  waitForPane();
})();
