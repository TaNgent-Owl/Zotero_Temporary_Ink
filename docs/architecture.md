# Architecture

Temporary Ink is a viewport-only overlay. It never calls Zotero annotation, item, attachment, database, sync, undo, or PDF-writing APIs.

```text
Zotero renderToolbar
        |
        v
 ReaderAdapter ---- private Zotero/PDF.js boundary
        |
        v
 ReaderController ---- toolbar mode: off / pen / rectangle
      /   \
     v     v
InputController --> InkModel --> InkRenderer --> DPR Canvas
```

## Boundaries

- `ReaderAdapter` identifies PDF readers, waits for the nested view, locates `#viewerContainer`, subscribes to PDF.js view changes, and reports document teardown. All Zotero private fields live here.
- `ReaderRegistry` gives each Reader object one controller. A pending WeakMap prevents duplicate async initialization when `renderToolbar` fires repeatedly.
- `InputController` uses capture-phase Pointer Events but consumes an event only after an enabled toolbar mode or configured modifier claims a primary mouse gesture. Cancelling that pointerdown suppresses Zotero's compatibility mousedown; OFF-mode plain drag is untouched. Pen arbitration remains a v0.2 extension point.
- `InkModel` owns point sampling, overlapping strokes, release time, fade state, and deletion.
- `InkRenderer` owns the pointer-transparent fixed canvas, client-to-local coordinates, DPR backing size, midpoint smoothing, and demand-driven animation.
- `Toolbar` only cycles controller mode. Preferences are read through `Zotero.Prefs` and observers refresh active controllers.

## Cleanup invariant

`destroy()` is idempotent at every stateful boundary. Reader close and plugin shutdown release capture, clear strokes, cancel animation and the single fade wake-up timer, reset cursor, disconnect observers, remove listeners and event-bus subscriptions, remove toolbar/canvas DOM, and evict the controller. The renderer sleeps during the hold delay and requests frames only while drawing changes or a stroke is actively fading.

## Deliberate limitations

Strokes are viewport coordinates. Scroll, resize, zoom, rotation, and document reload clear them instead of transforming them. Only the primary PDF view and mouse-first interaction are targeted in v0.1.0.
