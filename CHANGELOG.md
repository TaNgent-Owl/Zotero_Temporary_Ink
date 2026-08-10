# Changelog

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
