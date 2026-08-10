# Zotero 9.0.6 Reader Investigation

## Scope and sources

The integration was checked against the official `zotero/zotero` tag `9.0.6`. That tag pins the official `zotero/reader` submodule to commit `9643fac7a4e86c8d7ff9548af0191e9df63aa998`. The relevant host source is `chrome/content/zotero/xpcom/reader.js`; the nested PDF implementation is `src/pdf/pdf-view.js` in the pinned Reader commit.

## Confirmed lifecycle API

`Zotero.Reader.registerEventListener("renderToolbar", handler, pluginID)` is the supported toolbar entry point. The handler receives one event object:

```ts
{ reader, doc, params, append }
```

`doc` is the outer Reader UI document and `append(...elements)` inserts controls into the supported toolbar location. `reader.type` distinguishes `pdf`, `epub`, and `snapshot` readers.

The `append` closure is valid only while the `renderToolbar` callback is running; the Reader custom-section implementation rejects later asynchronous calls. Temporary Ink therefore creates and appends an interactive toolbar button synchronously, queues its selected mode if needed, then binds it to the asynchronously initialized per-Reader controller. Version 0.1.1 violated the synchronous append constraint; later versions correct the ordering without presenting a permanently disabled control.

Session restoration can render a Reader toolbar before a plugin that waits for `uiReadyPromise` registers its listener. Version 0.1.3 registers immediately after Zotero initialization, before waiting for UI readiness. For runtime enablement with an already-open Reader, `ReaderAdapter` uses the source-verified `.toolbar .end .custom-sections` host and reproduces CustomSections' `.section` wrapper. This fallback contains all private DOM knowledge in the adapter and is replaced naturally on the next React toolbar render.

Zotero 9.0.6's `unregisterEventListener(type, handler)` implementation has an inverted filter: it retains the matching listener and removes unrelated listeners. Temporary Ink therefore **does not call it**. It supplies `temporary-ink@local` at registration; Zotero's `Zotero.Plugins` shutdown observer calls `_unregisterEventListenerByPluginID(pluginID)`, whose implementation correctly removes this plugin's listeners.

## Install manifest requirements

Zotero 9.0.6's bundled `Extension.sys.mjs` treats a missing `applications.zotero.update_url` as a manifest error, alongside missing `id` and `strict_max_version`. Version 0.1.0 omitted this field and was rejected at installation even though its `9.0` through `9.0.*` compatibility range included Zotero 9.0.6. Version 0.1.1 supplies an HTTPS URL under the reserved `.invalid` top-level domain because this is a local-only build with no update server. The package verifier now enforces this Zotero-specific requirement.

Static `chrome.manifest` registration is unsupported in Zotero 7 and later. Temporary Ink uses relative resources and automatically registered Fluent files, so the obsolete file is excluded from the XPI.

## Viewer document access

- Public API: no API exposes pointer events from the PDF content viewport.
- Outer Reader window: `reader._iframeWindow` contains the Reader application and toolbar, not the PDF.js page document.
- Actual PDF document: `reader._internalReader._primaryView._iframeWindow.document`.
- Actual scroll/content viewport: `#viewerContainer` in that nested document.
- PDFView creates a nested `pdf/web/viewer.html` iframe, appends it to the primary-view container, and installs its own pointer listeners on that nested window.

This private chain and the verified selector exist only in `src/reader/reader-adapter.ts`. Attachment checks the actual viewer DOM first and polls it with bounded backoff. `_waitForInternalReader()` is started once as an initialization aid but is never allowed to block an already-usable viewport because its final `initializedPromise` can remain pending. Attachment fails closed if the chain or viewport remains absent. Risk is medium: a future Zotero Reader refactor should require changes only to the adapter.

## Lifecycle findings

The nested PDF document is destroyed when its view is closed or reloaded. Temporary Ink observes `pagehide`/`unload` only after attaching to that nested viewer; the outer toolbar document may be replaced during normal Reader initialization and is not a valid cancellation signal. Plugin shutdown aborts pending attachment through an explicit `AbortSignal`. The controller removes the canvas, pointer/keyboard/scroll listeners, ResizeObserver, PDF.js event-bus handlers, cursor state, and animation frame. The registry uses a WeakMap per Reader plus a live set solely for deterministic plugin shutdown.

## View changes

`#viewerContainer` emits scroll events. PDF.js's event bus emits `scalechanging`, `rotationchanging`, and `pagesinit`. Temporary Ink clears on all of these and resizes on the next animation frame. No PDF-page coordinate state is maintained.

## Mouse event arbitration

The pinned `PDFView` registers both capture `pointerdown` and capture `mousedown`. Its pointer handler immediately returns when `event.pointerType === "mouse"`; the compatibility `mousedown` performs native selection/annotation handling. Temporary Ink therefore claims only primary mouse `pointerdown` and calls `preventDefault()` after confirming its toolbar mode or Ctrl override. Per Pointer Events compatibility behavior, this suppresses the following `mousedown`, so a claimed temporary gesture cannot also start a native annotation. An unclaimed OFF-mode pointerdown, Alt, and Ctrl+Alt are untouched, so native text selection and tools receive their normal mouse event. Stylus input is deliberately not claimed in v0.1.0 because Zotero handles pen pointerdown directly.

## Sources

- <https://github.com/zotero/zotero/blob/9.0.6/chrome/content/zotero/xpcom/reader.js>
- <https://github.com/zotero/reader/tree/9643fac7a4e86c8d7ff9548af0191e9df63aa998>
- <https://github.com/zotero/reader/blob/9643fac7a4e86c8d7ff9548af0191e9df63aa998/src/pdf/pdf-view.js>
