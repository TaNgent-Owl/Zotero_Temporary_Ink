import { DisposableStore, type Dispose } from "../utils/disposable";
import type { CancellationSignal } from "../utils/cancellation";
import { Logger } from "../utils/logger";

type ViewerWindow = Window & typeof globalThis & {
  PDFViewerApplication?: {
    eventBus?: {
      on(type: string, handler: () => void): void;
      off(type: string, handler: () => void): void;
    };
  };
};

interface ZoteroReaderInternal {
  type?: string;
  _type?: string;
  _iframeWindow?: Window & typeof globalThis;
  _waitForInternalReader?: () => Promise<boolean>;
  _internalReader?: {
    _primaryView?: {
      _iframeWindow?: ViewerWindow;
    };
  };
}

interface LocatedViewer {
  window: ViewerWindow;
  document: Document;
  element: HTMLElement;
}

function locateViewer(internal: ZoteroReaderInternal): LocatedViewer | null {
  const window = internal._internalReader?._primaryView?._iframeWindow;
  const document = window?.document;
  const element = document?.getElementById("viewerContainer") ?? null;
  if (!window || !document || !(element instanceof window.HTMLElement)) return null;
  return { window, document, element };
}

export interface ReaderContext {
  readonly reader: unknown;
  readonly window: Window & typeof globalThis;
  readonly document: Document;
  readonly viewerElement: HTMLElement;
  readonly overlayHost: HTMLElement;
  readonly isPDF: true;
  onViewportChange(handler: () => void): Dispose;
  onClose(handler: () => void): Dispose;
  dispose(): void;
}

/**
 * The only module allowed to know Zotero Reader private fields and PDF.js DOM.
 * Verified against Zotero 9.0.6 and zotero/reader commit 9643fac7.
 */
export class ReaderAdapter {
  private readonly contexts = new WeakMap<object, ReaderContext>();

  constructor(
    private readonly readinessRetryDelays: readonly number[] = [0, 250, 750, 1500, 3000, 5000],
  ) {}

  getOpenReaders(): readonly unknown[] {
    // Zotero 9.0.6 has no public enumeration API. This fallback is confined here.
    return Array.isArray(Zotero.Reader._readers) ? Zotero.Reader._readers : [];
  }

  /**
   * Recreates the official renderToolbar append contract for a Reader whose
   * toolbar rendered before this plugin registered its listener.
   */
  createExistingToolbarEvent(reader: unknown): ZoteroReaderEvent | null {
    if (!reader || typeof reader !== "object") return null;
    const internal = reader as ZoteroReaderInternal;
    if ((internal.type ?? internal._type) !== "pdf") return null;
    const toolbarWindow = internal._iframeWindow;
    const document = toolbarWindow?.document;
    // Verified against Zotero 9.0.6 / reader 9643fac: CustomSections is the
    // final child of .toolbar .end, immediately before the Find button.
    const host = document?.querySelector(".toolbar .end .custom-sections");
    if (!document || !toolbarWindow || !(host instanceof toolbarWindow.HTMLElement)) {
      Logger.warn("Unable to locate the existing Zotero 9.0.6 Reader toolbar");
      return null;
    }

    return {
      type: "renderToolbar",
      reader,
      doc: document,
      params: {},
      append: (...elements: Element[]) => {
        const section = document.createElement("div");
        section.className = "section";
        section.append(...elements);
        host.append(section);
      },
    };
  }

  async attach(
    reader: unknown,
    _eventDocument?: Document,
    signal?: CancellationSignal,
  ): Promise<ReaderContext | null> {
    if (!reader || typeof reader !== "object") return null;
    const existing = this.contexts.get(reader);
    if (existing) return existing;

    const internal = reader as ZoteroReaderInternal;
    if ((internal.type ?? internal._type) !== "pdf") return null;

    let unavailable = signal?.aborted === true;
    let resolveUnavailable!: () => void;
    const unavailablePromise = new Promise<void>((resolve) => {
      resolveUnavailable = resolve;
      if (unavailable) resolve();
    });
    const markUnavailable = () => {
      if (unavailable) return;
      unavailable = true;
      resolveUnavailable();
    };
    signal?.addEventListener("abort", markUnavailable, { once: true });

    try {
      let viewerWindow: ViewerWindow | undefined;
      let viewerDocument: Document | undefined;
      let viewerElement: HTMLElement | null = null;
      let readinessStarted = false;

      for (const delay of this.readinessRetryDelays) {
        if (unavailable) return null;
        if (delay > 0) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const elapsed = new Promise<"elapsed">((resolve) => {
            timer = setTimeout(() => resolve("elapsed"), delay);
          });
          const outcome = await Promise.race([
            elapsed,
            unavailablePromise.then(() => "unavailable" as const),
          ]);
          if (outcome === "unavailable") {
            if (timer !== undefined) clearTimeout(timer);
            return null;
          }
        }

        // Check the verified DOM first. Zotero's private readiness promise can
        // remain pending after the usable PDF iframe and viewport already exist.
        // Awaiting it here would leave the toolbar permanently unbound.
        const located = locateViewer(internal);
        if (located) {
          viewerWindow = located.window;
          viewerDocument = located.document;
          viewerElement = located.element;
          break;
        }

        // Start Zotero's official waiter once as an initialization aid, but use
        // bounded DOM polling as the attachment signal so a stale promise cannot
        // deadlock this Reader.
        if (!readinessStarted && typeof internal._waitForInternalReader === "function") {
          readinessStarted = true;
          void internal._waitForInternalReader().catch((error) => Logger.error(error));
        }
      }

      if (!viewerWindow || !viewerDocument || !viewerElement) {
        Logger.warn("PDF Reader did not become ready within the attachment window");
        return null;
      }

      const disposables = new DisposableStore();
      const closeHandlers = new Set<() => void>();
      let closed = false;
      const handleClose = () => {
        if (closed) return;
        closed = true;
        for (const handler of [...closeHandlers]) handler();
      };
      viewerWindow.addEventListener("pagehide", handleClose, { once: true });
      viewerWindow.addEventListener("unload", handleClose, { once: true });
      disposables.add(() => viewerWindow.removeEventListener("pagehide", handleClose));
      disposables.add(() => viewerWindow.removeEventListener("unload", handleClose));

      const context: ReaderContext = {
        reader,
        window: viewerWindow,
        document: viewerDocument,
        viewerElement,
        overlayHost: viewerDocument.body,
        isPDF: true,
        onViewportChange(handler): Dispose {
          const eventBus = viewerWindow.PDFViewerApplication?.eventBus;
          const events = ["scalechanging", "rotationchanging", "pagesinit"];
          for (const type of events) eventBus?.on(type, handler);
          return () => {
            for (const type of events) eventBus?.off(type, handler);
          };
        },
        onClose(handler): Dispose {
          if (closed) {
            handler();
            return () => {};
          }
          closeHandlers.add(handler);
          return () => closeHandlers.delete(handler);
        },
        dispose(): void {},
      } as ReaderContext;

      // Replace dispose to retain lexical access to the adapter WeakMap.
      context.dispose = () => {
        closeHandlers.clear();
        disposables.dispose();
        this.contexts.delete(reader);
      };
      this.contexts.set(reader, context);
      return context;
    }
    catch (error) {
      Logger.error(error);
      Logger.warn("Temporary Ink is disabled for this Reader");
      return null;
    }
    finally {
      signal?.removeEventListener("abort", markUnavailable);
    }
  }
}
