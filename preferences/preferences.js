/* global Zotero */

(() => {
  const keys = {
    enabled: "extensions.temporary-ink.enabled",
    penColor: "extensions.temporary-ink.penColor",
    penWidth: "extensions.temporary-ink.penWidth",
    penOpacity: "extensions.temporary-ink.penOpacity",
    fadeDelay: "extensions.temporary-ink.fadeDelay",
    fadeDuration: "extensions.temporary-ink.fadeDuration",
  };
  const fields = {
    enabled: ["temporary-ink-enabled", "checked"],
    penColor: ["temporary-ink-pen-color", "value"],
    penWidth: ["temporary-ink-pen-width", "valueAsNumber"],
    penOpacity: ["temporary-ink-pen-opacity", "valueAsNumber"],
    fadeDelay: ["temporary-ink-fade-delay", "valueAsNumber"],
    fadeDuration: ["temporary-ink-fade-duration", "valueAsNumber"],
  };

  function initialize() {
    for (const [name, [id, property]] of Object.entries(fields)) {
      const element = document.getElementById(id);
      element[property] = Zotero.Prefs.get(keys[name], true);
      element.addEventListener("change", () => {
        const value = name === "penOpacity" || name === "penWidth"
          ? String(element[property])
          : element[property];
        Zotero.Prefs.set(keys[name], value, true);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  }
  else {
    initialize();
  }
})();
