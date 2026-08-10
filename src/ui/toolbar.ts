import type { ToolMode } from "../config/constants";
import type { ReaderController } from "../reader/reader-controller";

interface LocalizedDocument extends Document {
  l10n?: {
    formatValues(requests: Array<{ id: string }>): Promise<string[]>;
  };
}

export interface ToolbarControl {
  readonly element: HTMLButtonElement;
  dispose(): void;
}

const MODE_KEYS: Record<ToolMode, string> = {
  off: "temporary-ink-mode-off",
  pen: "temporary-ink-mode-pen",
  rectangle: "temporary-ink-mode-rectangle",
};

function ensureLocalization(document: Document): HTMLLinkElement | null {
  const existing = document.querySelector<HTMLLinkElement>('[data-temporary-ink="localization"]');
  if (existing) return null;
  const link = document.createElement("link");
  link.rel = "localization";
  link.href = "temporary-ink.ftl";
  link.dataset.temporaryInk = "localization";
  document.head?.append(link);
  return link;
}

export function mountToolbar(
  event: ZoteroReaderEvent,
  controller: Pick<
    ReaderController,
    "cycleMode" | "subscribeMode" | "clearToolbarControl" | "replaceToolbarControl"
  >,
  rootURI: string,
): ToolbarControl | null {
  if (event.doc.querySelector('[data-temporary-ink="toolbar"]')) return null;
  controller.clearToolbarControl();

  const localizationLink = ensureLocalization(event.doc);
  const button = event.doc.createElement("button");
  button.type = "button";
  button.className = "toolbar-button temporary-ink-toolbar-button";
  button.dataset.temporaryInk = "toolbar";
  button.setAttribute("aria-pressed", "false");

  const image = event.doc.createElement("img");
  image.src = `${rootURI}assets/temporary-ink.svg`;
  image.alt = "";
  image.width = 16;
  image.height = 16;
  image.style.pointerEvents = "none";
  button.append(image);

  let disposed = false;
  let updateSequence = 0;
  const update = (mode: ToolMode) => {
    const sequence = ++updateSequence;
    const fallback = `Temporary Ink: ${mode === "off" ? "Off" : mode === "pen" ? "Pen" : "Rectangle"}`;
    button.title = fallback;
    button.setAttribute("aria-label", fallback);
    button.setAttribute("aria-pressed", String(mode !== "off"));
    button.dataset.mode = mode;

    const l10n = (event.doc as LocalizedDocument).l10n;
    if (!l10n) return;
    void l10n.formatValues([
      { id: "temporary-ink-toolbar-title" },
      { id: MODE_KEYS[mode] },
    ]).then(([title, modeLabel]) => {
      if (disposed || sequence !== updateSequence) return;
      const label = `${title}: ${modeLabel}`;
      button.title = label;
      button.setAttribute("aria-label", label);
    }).catch(() => {});
  };
  const handleClick = () => controller.cycleMode();
  const unsubscribe = controller.subscribeMode(update);
  button.addEventListener("click", handleClick);
  event.append(button);

  const control: ToolbarControl = {
    element: button,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      updateSequence++;
      button.removeEventListener("click", handleClick);
      unsubscribe();
      button.remove();
      localizationLink?.remove();
    },
  };
  controller.replaceToolbarControl(control);
  return control;
}
