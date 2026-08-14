import type { ToolMode } from "../config/constants";
import type { ReaderController } from "../reader/reader-controller";
import { PalettePopover } from "./palette";

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
const PEN_HANDLE_PATH = "M15 5 8 12";
const PEN_TIP_PATH = "M8 12.25c-1.1 0-2 .9-2 2 0 1.45 1.2 2.25 2.5 2.25 1.5 0 2.75-1.25 2.75-2.75 0-1.15-1.6-1.5-3.25-1.5z";
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD = 8;

function createSvgShell(document: Document): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.style.pointerEvents = "none";
  return svg;
}

function createOffIcon(document: Document): SVGSVGElement {
  const svg = createSvgShell(document);

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

function createPenIcon(document: Document): SVGSVGElement {
  const svg = createSvgShell(document);

  const handle = document.createElementNS(SVG_NS, "path");
  handle.setAttribute("d", PEN_HANDLE_PATH);
  handle.setAttribute("stroke", "currentColor");
  handle.setAttribute("stroke-width", "2");
  handle.setAttribute("stroke-linecap", "round");

  const tip = document.createElementNS(SVG_NS, "path");
  tip.setAttribute("d", PEN_TIP_PATH);
  tip.setAttribute("fill", "currentColor");

  svg.append(handle, tip);
  return svg;
}

function createRectangleIcon(document: Document): SVGSVGElement {
  const svg = createSvgShell(document);

  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", "3.5");
  rect.setAttribute("y", "4.5");
  rect.setAttribute("width", "13");
  rect.setAttribute("height", "11");
  rect.setAttribute("rx", "1");
  rect.setAttribute("fill", "none");
  rect.setAttribute("stroke", "currentColor");
  rect.setAttribute("stroke-width", "1.5");

  svg.append(rect);
  return svg;
}

const ICON_BUILDERS: Record<ToolMode, (document: Document) => SVGSVGElement> = {
  off: createOffIcon,
  pen: createPenIcon,
  rectangle: createRectangleIcon,
};

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

  let disposed = false;
  let updateSequence = 0;
  let pendingMode: ToolMode = "off";
  let controller: ToolbarController | null = null;
  let unsubscribe: (() => void) | null = null;
  let modeIcon: SVGSVGElement | null = null;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressStartX = 0;
  let longPressStartY = 0;
  let suppressNextClick = false;
  const popover = new PalettePopover(event.doc);

  const setModeIcon = (mode: ToolMode) => {
    modeIcon?.remove();
    modeIcon = ICON_BUILDERS[mode](event.doc);
    button.append(modeIcon);
  };

  const update = (mode: ToolMode) => {
    pendingMode = mode;
    const sequence = ++updateSequence;
    const fallback = `Temporary Ink: ${mode === "off" ? "Off" : mode === "pen" ? "Pen" : "Rectangle"}`;
    button.title = fallback;
    button.setAttribute("aria-label", fallback);
    button.setAttribute("aria-pressed", String(mode !== "off"));
    button.dataset.mode = mode;
    button.classList.toggle("active", mode !== "off");
    setModeIcon(mode);

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

  const cancelLongPress = (): void => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const onPointerDown = (pointerEvent: PointerEvent): void => {
    suppressNextClick = false;
    cancelLongPress();
    longPressStartX = pointerEvent.clientX;
    longPressStartY = pointerEvent.clientY;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      suppressNextClick = true;
      popover.open(button);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (pointerEvent: PointerEvent): void => {
    if (longPressTimer === null) return;
    const dx = pointerEvent.clientX - longPressStartX;
    const dy = pointerEvent.clientY - longPressStartY;
    if (dx * dx + dy * dy > LONG_PRESS_MOVE_THRESHOLD * LONG_PRESS_MOVE_THRESHOLD) {
      cancelLongPress();
    }
  };

  const onPointerEnd = (): void => {
    cancelLongPress();
  };

  const handleClick = () => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (controller) {
      controller.cycleMode();
      return;
    }
    update(pendingMode === "off" ? "pen" : pendingMode === "pen" ? "rectangle" : "off");
  };

  button.addEventListener("click", handleClick);
  button.addEventListener("pointerdown", onPointerDown);
  button.addEventListener("pointermove", onPointerMove);
  button.addEventListener("pointerup", onPointerEnd);
  button.addEventListener("pointerleave", onPointerEnd);
  button.addEventListener("pointercancel", onPointerEnd);
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
      cancelLongPress();
      button.removeEventListener("click", handleClick);
      button.removeEventListener("pointerdown", onPointerDown);
      button.removeEventListener("pointermove", onPointerMove);
      button.removeEventListener("pointerup", onPointerEnd);
      button.removeEventListener("pointerleave", onPointerEnd);
      button.removeEventListener("pointercancel", onPointerEnd);
      unsubscribe?.();
      unsubscribe = null;
      controller = null;
      popover.dispose();
      button.remove();
      if (!event.doc.querySelector('[data-temporary-ink="toolbar"]')) localizationLink.remove();
      onDispose?.();
    },
  };
  return control;
}
