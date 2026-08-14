import type { SettingsProvider } from "../config/preferences";

export type BadgeTool = "pen" | "rectangle";

interface LocalizedDocument extends Document {
  l10n?: {
    formatValues(requests: Array<{ id: string }>): Promise<string[]>;
  };
}

const TOOL_KEYS: Record<BadgeTool, string> = {
  pen: "temporary-ink-mode-pen",
  rectangle: "temporary-ink-mode-rectangle",
};

const FALLBACK_LABELS: Record<BadgeTool, { zh: string; en: string }> = {
  pen: { zh: "画笔", en: "Pen" },
  rectangle: { zh: "框选", en: "Rectangle" },
};

/**
 * A transient, non-interactive hint shown in a corner of the PDF viewer while a
 * gesture tool is about to draw. It is pure display: every listener is passive,
 * the element never receives pointer events, and nothing it does can consume an
 * event or throw out of the Reader.
 */
export class CornerBadge {
  private readonly element: HTMLDivElement;
  private readonly dot: HTMLSpanElement;
  private readonly label: HTMLSpanElement;
  private readonly localizedNames = new Map<BadgeTool, string>();
  private timerID: number | null = null;
  private currentTool: BadgeTool | null = null;
  private disposed = false;

  constructor(
    private readonly window: Window & typeof globalThis,
    private readonly settingsProvider: SettingsProvider,
  ) {
    const document = this.window.document;
    this.element = document.createElement("div");
    this.element.dataset.temporaryInk = "badge";
    this.element.setAttribute("aria-hidden", "true");
    Object.assign(this.element.style, {
      position: "fixed",
      pointerEvents: "none",
      zIndex: "2147482999",
      bottom: "16px",
      right: "16px",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 10px",
      background: "rgba(255, 255, 255, 0.92)",
      color: "rgba(0, 0, 0, 0.85)",
      borderRadius: "999px",
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      lineHeight: "1",
    });
    this.element.style.display = "none";

    this.dot = document.createElement("span");
    this.dot.className = "temporary-ink-badge-dot";
    this.dot.setAttribute("aria-hidden", "true");
    Object.assign(this.dot.style, {
      display: "block",
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      backgroundColor: "transparent",
    });

    this.label = document.createElement("span");
    this.label.className = "temporary-ink-badge-label";

    this.element.append(this.dot, this.label);
  }

  mount(host: HTMLElement): void {
    host.querySelector('[data-temporary-ink="badge"]')?.remove();
    host.append(this.element);
  }

  show(tool: BadgeTool): void {
    if (this.disposed) return;
    this.currentTool = tool;
    this.element.style.display = "flex";
    this.renderContent();
    this.resetTimer();
    this.localize(tool);
  }

  hide(): void {
    if (this.disposed) return;
    this.currentTool = null;
    this.element.style.display = "none";
    this.clearTimer();
  }

  update(): void {
    if (this.disposed || this.currentTool === null) return;
    this.renderContent();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearTimer();
    this.currentTool = null;
    this.localizedNames.clear();
    this.element.remove();
  }

  private renderContent(): void {
    const tool = this.currentTool;
    if (!tool) return;
    const settings = this.settingsProvider();
    this.dot.style.backgroundColor = settings.penColor;
    this.label.textContent = `${this.labelFor(tool)} · ${settings.penWidth} px`;
  }

  private labelFor(tool: BadgeTool): string {
    return this.localizedNames.get(tool) ?? this.fallbackLabel(tool);
  }

  private fallbackLabel(tool: BadgeTool): string {
    const locale = (globalThis as { Zotero?: { locale?: unknown } }).Zotero?.locale;
    const value = typeof locale === "string" ? locale : "";
    return value.startsWith("zh") ? FALLBACK_LABELS[tool].zh : FALLBACK_LABELS[tool].en;
  }

  private localize(tool: BadgeTool): void {
    const l10n = (this.window.document as LocalizedDocument).l10n;
    if (!l10n || typeof l10n.formatValues !== "function") return;
    void l10n.formatValues([{ id: TOOL_KEYS[tool] }])
      .then(([name]) => {
        if (typeof name === "string" && name.length > 0) this.localizedNames.set(tool, name);
        if (this.disposed || this.currentTool !== tool) return;
        this.renderContent();
      })
      .catch(() => {});
  }

  private resetTimer(): void {
    this.clearTimer();
    this.timerID = this.window.setTimeout(() => {
      this.timerID = null;
      this.hide();
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerID !== null) {
      this.window.clearTimeout(this.timerID);
      this.timerID = null;
    }
  }
}
