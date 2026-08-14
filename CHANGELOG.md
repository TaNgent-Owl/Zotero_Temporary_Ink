# Changelog

## 0.2.0 - 2026-08-14

### Added

- Mode-visible toolbar: the toolbar icon now switches with the OFF / PEN / RECTANGLE mode (default pen icon, pen, rectangle outline), keeps Zotero's native active state, and the hover tooltip shows the current mode.
- Quick color palette: long-press the toolbar button to open a six-swatch palette; clicking a swatch switches the pen color immediately. Digit keys `1`–`6` switch between the same six presets. The palette highlights the current color, closes on `Esc` or an outside click, and only writes the plugin's own `penColor` preference — never Zotero data. Zotero's own shortcuts and editable fields are never intercepted.
- Quick width adjust: `[` / `]` step the pen width by 1 px within 1–20 and apply to the next stroke; the preference pane keeps the precise value.
- Corner hint badge: holding the drawing modifier in OFF mode, or dragging in PEN/RECTANGLE mode, shows a small badge in the reader corner with the tool name, a color dot, and the current width. It is pure display (`pointer-events: none`), disappears on release or after about one second, and leaves no DOM residue.
- Unified zh-CN / en-US terminology across the locales, README, preference pane, and toolbar tooltips; the README documents every new v0.2 interaction and the modifiers are now correctly described as configurable.

### Fixed

- Suppress PDF text selection while drawing. Pointer capture is now deferred past the compatibility `mousedown` dispatch (first pointermove or a zero-delay fallback), because active capture during `pointerdown` disables `preventDefault()`'s mousedown suppression and lets Zotero's programmatic selection path run. A claimed gesture additionally blocks selection with a scoped `user-select: none !important` stylesheet, cancels `selectstart`, and clears `selectionchange`-visible programmatic selections. All layers are released through the shared `finishGesture()` chokepoint; no mouse-event interception is added, so ink rendering and PDF loading are unaffected. User testing on Zotero 9.0.6 confirms a large reduction; a small residual selection in some cases was accepted as a harmless limitation.
- Isolate startup failures: preference pane registration, per-open-reader toolbar replay, and the `renderToolbar` handler now fail closed with logging; `bootstrap.js` adds a last-line catch with best-effort cleanup, so a startup failure can no longer disable the whole plugin (audit M1, L3).
- Mount synthetic toolbars for already-open readers synchronously instead of awaiting attachment, so slow readers can no longer stall `startup()` (audit L2).
- Cache modifier state in `updateCursor` so OFF-mode pointer moves no longer re-read all eight preferences on every move; event-less calls still recompute (audit L1).

### Verification

- TypeScript typecheck and all 80 automated tests pass; XPI build and package verification pass. Zotero 9.0.6 manual verification for the new interactions is tracked as rows 24–32 of `docs/manual-test.md`; the functional roadmap for future versions lives in `docs/roadmap.md`.

## 0.1.13 - 2026-08-10

### Added

- Add a separate configurable shortcut for the rectangle tool. The pen and rectangle modifiers (Ctrl / Alt / Ctrl+Alt) are now configured independently; Shift still distinguishes pen from rectangle.

### Fixed

- Make the shortcut dropdowns interactive in the Zotero preferences pane by switching from HTML `<select>` elements to native XUL `menulist`s.

### Verification

- TypeScript typecheck, 37 automated tests, XPI build, and package verification pass.

## 0.1.12 - 2026-08-10

### Fixed

- Open the Zotero preferences pane. Two separate Zotero 9 loading constraints previously made the pane unopenable: pane scripts run before the pane markup is inserted (the script now waits for it via a MutationObserver), and the pane XHTML is parsed as an XML fragment embedded in Zotero's own wrapper, so the leading `<?xml version="1.0"?>` declaration was illegal mid-document and aborted the load. The declaration is removed and a regression test mirrors Zotero's fragment parser.

### Verification

- TypeScript typecheck, 34 automated tests, XPI build, and package verification pass.

## 0.1.11 - 2026-08-10

### Added

- Make the drawing shortcut configurable in the preferences pane. You can now choose Ctrl, Alt, or Ctrl+Alt for pen and rectangle gestures; Ctrl remains the default and the Shift combination still selects the rectangle.

### Verification

- TypeScript typecheck, 32 automated tests, XPI build, and package verification pass.

## 0.1.10 - 2026-08-10

### Changed

- Keep all visible strokes fully opaque whenever a new pen or rectangle gesture begins.
- Start one shared hold-and-fade countdown only after the latest gesture ends, so multi-stroke diagrams disappear as a group.
- Restart the shared countdown safely when an in-progress gesture is cancelled.

### Verification

- Added lifecycle coverage for reviving a partially faded stroke, keeping a group visible during a long gesture, synchronized opacity, grouped deletion, and cancellation.

## 0.1.9 - 2026-08-10 (Initial Stable)

### Features

- Add transient pen and rectangle overlays for the Zotero 9 PDF Reader.
- Support toolbar modes plus `Ctrl` and `Ctrl+Shift` drawing shortcuts.
- Provide English and Simplified Chinese localization and Zotero preferences.

### Fixes

- Make toolbar insertion work for newly opened and restored PDF Readers.
- Prevent stale Reader readiness promises and toolbar document replacement from blocking attachment.
- Remove the bootstrap-incompatible browser `AbortController` dependency.
- Version-bust bundled scripts during in-process add-on upgrades.

### Verification

- Confirmed on Zotero 9.0.6 that the add-on installs, the toolbar works, and pen and rectangle drawing render successfully.
- TypeScript typecheck, 30 automated tests, XPI build, and package verification pass.
