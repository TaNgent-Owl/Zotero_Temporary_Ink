import type { ToolMode } from "../config/constants";
import type { ReaderController } from "../reader/reader-controller";

interface LocalizedDocument extends Document {
  l10n?: {
    formatValues(requests: Array<{ id: string }>): Promise<string[]>;
  };
}

export interface ToolbarControl {
  readonly element: HTMLButtonElement;
  bind(controller: ToolbarController): void;
  dispose(): void;
}

export type ToolbarController = Pick<
  ReaderController,
  "cycleMode" | "setMode" | "subscribeMode" | "replaceToolbarControl"
>;

const MODE_KEYS: Record<ToolMode, string> = {
  off: "temporary-ink-mode-off",
  pen: "temporary-ink-mode-pen",
  rectangle: "temporary-ink-mode-rectangle",
};

const SVG_NS = "http://www.w3.org/2000/svg";
const PEN_PATH = "M15.616 6.5a1.25 1.25 0 0 1 1.768 0L18.5 7.616a1.25 1.25 0 0 1 0 1.768l-7.954 7.954a1.25 1.25 0 0 1-.488.302l-2.86.953-1.186.395.395-1.186.953-2.86a1.25 1.25 0 0 1 .302-.488zM14.5 9.384l-5.954 5.954-.558 1.674 1.674-.558 5.954-5.954zm.884-.884L16.5 9.616 17.616 8.5 16.5 7.384z";

function createToolbarIcon(document: Document): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.style.pointerEvents = "none";

  const pen = document.createElementNS(SVG_NS, "path");
  pen.setAttribute("d", PEN_PATH);
  pen.setAttribute("fill", "currentColor");
  pen.setAttribute("fill-rule", "evenodd");
  pen.setAttribute("clip-rule", "evenodd");
  pen.setAttribute("transform", "translate(0 -4)");

  const stroke = document.createElementNS(SVG_NS, "path");
  stroke.setAttribute("d", "M2 15.8c2.2-2.25 4.25-2.45 6.05-.95 1.25 1.04 2.55 1.2 3.75.55");
  stroke.setAttribute("stroke", "currentColor");
  stroke.setAttribute("stroke-width", "1.25");
  stroke.setAttribute("stroke-linecap", "round");

  const addFadeDot = (cx: string, cy: string, radius: string, opacity: string) => {
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", cx);
    dot.setAttribute("cy", cy);
    dot.setAttribute("r", radius);
    dot.setAttribute("fill", "currentColor");
    dot.setAttribute("opacity", opacity);
    svg.append(dot);
  };

  svg.append(pen, stroke);
  addFadeDot("14.25", "15.65", "0.75", "0.62");
  addFadeDot("16.9", "15.85", "0.5", "0.3");
  return svg;
}

function ensureLocalization(document: Document): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>('[data-temporary-ink="localization"]');
  if (existing) return existing;
  const link = document.createElement("link");
  link.rel = "localization";
  link.href = "temporary-ink.ftl";
  link.dataset.temporaryInk = "localization";
  document.head?.append(link);
  return link;
}

export function mountToolbar(
  event: ZoteroReaderEvent,
  onDispose?: () => void,
): ToolbarControl | null {
  if (event.doc.querySelector('[data-temporary-ink="toolbar"]')) return null;

  const localizationLink = ensureLocalization(event.doc);
  const button = event.doc.createElement("button");
  button.type = "button";
  button.className = "toolbar-button temporary-ink-toolbar-button";
  button.dataset.temporaryInk = "toolbar";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-busy", "true");

  button.append(createToolbarIcon(event.doc));

  let disposed = false;
  let updateSequence = 0;
  let pendingMode: ToolMode = "off";
  let controller: ToolbarController | null = null;
  let unsubscribe: (() => void) | null = null;
  const update = (mode: ToolMode) => {
    pendingMode = mode;
    const sequence = ++updateSequence;
    const fallback = `Temporary Ink: ${mode === "off" ? "Off" : mode === "pen" ? "Pen" : "Rectangle"}`;
    button.title = fallback;
    button.setAttribute("aria-label", fallback);
    button.setAttribute("aria-pressed", String(mode !== "off"));
    button.dataset.mode = mode;
    button.classList.toggle("active", mode !== "off");

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
  const handleClick = () => {
    if (controller) {
      controller.cycleMode();
      return;
    }
    update(pendingMode === "off" ? "pen" : pendingMode === "pen" ? "rectangle" : "off");
  };
  button.addEventListener("click", handleClick);
  update("off");

  // Zotero's renderToolbar append function is valid only during the callback.
  // Append synchronously, then bind the asynchronously initialized Reader.
  event.append(button);

  const control: ToolbarControl = {
    element: button,
    bind(nextController): void {
      if (disposed || controller === nextController) return;
      unsubscribe?.();
      nextController.replaceToolbarControl(control);
      if (disposed) return;
      controller = nextController;
      nextController.setMode(pendingMode);
      unsubscribe = nextController.subscribeMode(update);
      button.removeAttribute("aria-busy");
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      updateSequence++;
      button.removeEventListener("click", handleClick);
      unsubscribe?.();
      unsubscribe = null;
      controller = null;
      button.remove();
      if (!event.doc.querySelector('[data-temporary-ink="toolbar"]')) localizationLink.remove();
      onDispose?.();
    },
  };
  return control;
}
