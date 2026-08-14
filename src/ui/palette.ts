import { PALETTE_COLORS } from "../config/constants";
import { PREF_KEYS, setPenColor } from "../config/preferences";

interface LocalizedDocument extends Document {
  l10n?: {
    formatValues(requests: Array<{ id: string }>): Promise<string[]>;
  };
}

const POPOVER_Z_INDEX = "2147483001";
const SWATCH_SIZE = "24px";

export class PalettePopover {
  private element: HTMLDivElement | null = null;
  private disposed = false;
  private removeDocumentPointerDown: (() => void) | null = null;
  private removeDocumentKeyDown: (() => void) | null = null;

  constructor(private readonly doc: Document) {}

  get isOpen(): boolean {
    return this.element !== null;
  }

  open(anchor: HTMLElement): void {
    if (this.disposed) return;
    if (this.element) {
      this.position(anchor);
      this.refreshHighlight();
      return;
    }
    if (!this.doc.body) return;

    const element = this.doc.createElement("div");
    element.dataset.temporaryInk = "palette";
    element.setAttribute("role", "group");
    Object.assign(element.style, {
      position: "fixed",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px",
      zIndex: POPOVER_Z_INDEX,
      background: "#ffffff",
      border: "1px solid rgba(0, 0, 0, 0.25)",
      borderRadius: "8px",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
    });

    for (const color of PALETTE_COLORS) {
      const swatch = this.doc.createElement("button");
      swatch.type = "button";
      swatch.dataset.temporaryInk = "palette-swatch";
      swatch.dataset.color = color;
      swatch.setAttribute("aria-label", color);
      swatch.setAttribute("aria-pressed", "false");
      Object.assign(swatch.style, {
        width: SWATCH_SIZE,
        height: SWATCH_SIZE,
        padding: "0",
        border: "2px solid transparent",
        borderRadius: "50%",
        background: color,
        cursor: "pointer",
        flex: "0 0 auto",
      });
      swatch.addEventListener("click", () => {
        setPenColor(color);
        this.close();
      });
      element.append(swatch);
    }

    this.element = element;
    this.applyLocalizedTitle(element);
    this.refreshHighlight();
    this.doc.body.append(element);
    this.position(anchor);

    const win = this.doc.defaultView;
    const onPointerDown = (event: Event): void => {
      const target = event.target;
      if (win && target instanceof win.Node && element.contains(target)) return;
      this.close();
    };
    const onKeyDown = (event: Event): void => {
      if ((event as KeyboardEvent).key === "Escape") this.close();
    };
    this.doc.addEventListener("pointerdown", onPointerDown, true);
    this.doc.addEventListener("keydown", onKeyDown, true);
    this.removeDocumentPointerDown = () => this.doc.removeEventListener("pointerdown", onPointerDown, true);
    this.removeDocumentKeyDown = () => this.doc.removeEventListener("keydown", onKeyDown, true);
  }

  close(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    this.removeDocumentPointerDown?.();
    this.removeDocumentPointerDown = null;
    this.removeDocumentKeyDown?.();
    this.removeDocumentKeyDown = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.close();
  }

  private position(anchor: HTMLElement): void {
    const element = this.element;
    if (!element) return;
    const rect = anchor.getBoundingClientRect();
    element.style.left = `${Math.round(rect.left)}px`;
    element.style.top = `${Math.round(rect.bottom + 6)}px`;
  }

  private refreshHighlight(): void {
    const element = this.element;
    if (!element) return;
    const current = Zotero.Prefs.get(PREF_KEYS.penColor, true);
    const swatches = element.querySelectorAll<HTMLButtonElement>('[data-temporary-ink="palette-swatch"]');
    for (const swatch of swatches) {
      const selected = swatch.dataset.color?.toLowerCase() === String(current).toLowerCase();
      swatch.setAttribute("aria-pressed", String(selected));
      swatch.style.outline = selected ? "2px solid #1677FF" : "";
    }
  }

  private applyLocalizedTitle(element: HTMLDivElement): void {
    const l10n = (this.doc as LocalizedDocument).l10n;
    if (!l10n) return;
    void l10n.formatValues([
      { id: "temporary-ink-palette-title" },
      { id: "temporary-ink-palette-current" },
    ]).then(([title, current]) => {
      if (this.element !== element) return;
      element.setAttribute("aria-label", title);
      element.dataset.currentColorLabel = current;
    }).catch(() => {});
  }
}
