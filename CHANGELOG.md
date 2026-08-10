# Changelog

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
