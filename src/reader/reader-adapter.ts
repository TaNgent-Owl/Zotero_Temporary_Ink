import { DisposableStore, type Dispose } from "../utils/disposable";
import { Logger } from "../utils/logger";

interface ZoteroReaderInternal {
  type?: string;
  _type?: string;
  _waitForInternalReader?: () => Promise<boolean>;
  _internalReader?: {
    _primaryView?: {
      _iframeWindow?: Window & typeof globalThis & {
        PDFViewerApplication?: {
          eventBus?: {
            on(type: string, handler: () => void): void;
            off(type: string, handler: () => void): void;
          };
        };
      };
    };
  };
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

  getOpenReaders(): readonly unknown[] {
    // Zotero 9.0.6 has no public enumeration API. This fallback is confined here.
    return Array.isArray(Zotero.Reader._readers) ? Zotero.Reader._readers : [];
  }

  async attach(reader: unknown, _eventDocument?: Document): Promise<ReaderContext | null> {
    if (!reader || typeof reader !== "object") return null;
    const existing = this.contexts.get(reader);
    if (existing) return existing;

    const internal = reader as ZoteroReaderInternal;
    if ((internal.type ?? internal._type) !== "pdf") return null;

    try {
      // This Zotero 9.0.6 method waits for _internalReader._primaryView initialization.
      const ready = await internal._waitForInternalReader?.();
      if (ready === false) {
        Logger.warn("PDF Reader closed before its internal view became ready");
        return null;
      }

      // Private dependency, Zotero 9.0.6 only. Do not move this chain outside ReaderAdapter.
      const viewerWindow = internal._internalReader?._primaryView?._iframeWindow;
      const viewerDocument = viewerWindow?.document;
      // #viewerContainer is the PDF.js scroll viewport at the pinned Reader commit.
      const viewerElement = viewerDocument?.getElementById("viewerContainer");
      if (!viewerWindow || !viewerDocument || !(viewerElement instanceof viewerWindow.HTMLElement)) {
        Logger.warn("Unable to locate PDF viewer in Zotero 9.0.6");
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
  }
}
