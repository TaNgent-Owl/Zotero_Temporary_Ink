# Zotero 9.0.6 Reader Investigation

## Scope and sources

The integration was checked against the official `zotero/zotero` tag `9.0.6`. That tag pins the official `zotero/reader` submodule to commit `9643fac7a4e86c8d7ff9548af0191e9df63aa998`. The relevant host source is `chrome/content/zotero/xpcom/reader.js`; the nested PDF implementation is `src/pdf/pdf-view.js` in the pinned Reader commit.

## Confirmed lifecycle API

`Zotero.Reader.registerEventListener("renderToolbar", handler, pluginID)` is the supported toolbar entry point. The handler receives one event object:

```ts
{ reader, doc, params, append }
```

`doc` is the outer Reader UI document and `append(...elements)` inserts controls into the supported toolbar location. `reader.type` distinguishes `pdf`, `epub`, and `snapshot` readers.

Zotero 9.0.6's `unregisterEventListener(type, handler)` implementation has an inverted filter: it retains the matching listener and removes unrelated listeners. Temporary Ink therefore **does not call it**. It supplies `temporary-ink@local` at registration; Zotero's `Zotero.Plugins` shutdown observer calls `_unregisterEventListenerByPluginID(pluginID)`, whose implementation correctly removes this plugin's listeners.

## Viewer document access

- Public API: no API exposes pointer events from the PDF content viewport.
- Outer Reader window: `reader._iframeWindow` contains the Reader application and toolbar, not the PDF.js page document.
- Actual PDF document: `reader._internalReader._primaryView._iframeWindow.document`.
- Actual scroll/content viewport: `#viewerContainer` in that nested document.
- PDFView creates a nested `pdf/web/viewer.html` iframe, appends it to the primary-view container, and installs its own pointer listeners on that nested window.

This private chain and the verified selector exist only in `src/reader/reader-adapter.ts`. Attachment calls `_waitForInternalReader()` before access and fails closed if the chain or viewport is absent. Risk is medium: a future Zotero Reader refactor should require changes only to the adapter.

## Lifecycle findings

The nested PDF document is destroyed when its view is closed or reloaded. Temporary Ink observes `pagehide`/`unload`, and its controller removes the canvas, pointer/keyboard/scroll listeners, ResizeObserver, PDF.js event-bus handlers, cursor state, and animation frame. The registry uses a WeakMap per Reader plus a live set solely for deterministic plugin shutdown.

## View changes

`#viewerContainer` emits scroll events. PDF.js's event bus emits `scalechanging`, `rotationchanging`, and `pagesinit`. Temporary Ink clears on all of these and resizes on the next animation frame. No PDF-page coordinate state is maintained.

## Mouse event arbitration

The pinned `PDFView` registers both capture `pointerdown` and capture `mousedown`. Its pointer handler immediately returns when `event.pointerType === "mouse"`; the compatibility `mousedown` performs native selection/annotation handling. Temporary Ink therefore claims only primary mouse `pointerdown` and calls `preventDefault()` after confirming its mode/modifier. Per Pointer Events compatibility behavior, this suppresses the following `mousedown`, so a claimed temporary gesture cannot also start a native annotation. An unclaimed OFF-mode pointerdown is untouched, so native text selection and tools receive their normal mouse event. Stylus input is deliberately not claimed in v0.1.0 because Zotero handles pen pointerdown directly.

## Sources

- <https://github.com/zotero/zotero/blob/9.0.6/chrome/content/zotero/xpcom/reader.js>
- <https://github.com/zotero/reader/tree/9643fac7a4e86c8d7ff9548af0191e9df63aa998>
- <https://github.com/zotero/reader/blob/9643fac7a4e86c8d7ff9548af0191e9df63aa998/src/pdf/pdf-view.js>
