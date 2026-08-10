# Zotero Temporary Ink

Temporary Ink adds a short-lived pen and rectangle overlay to the Zotero PDF Reader. It is meant for pointing, underlining, circling, and framing while reading. **Temporary Ink does not create Zotero annotations, modify PDFs, touch attachments, or participate in sync.**

## Features

- `Ctrl` + left-drag: transient pen
- `Ctrl+Shift` + left-drag: transient rectangle
- Toolbar cycle: OFF → PEN → RECTANGLE → OFF
- Multiple overlapping strokes with independent 300 ms hold and 500 ms fade
- Escape clears visible ink; scroll, zoom, rotation, and resize clear stale viewport ink
- HiDPI canvas sizing and isolated per-Reader lifecycle
- English and Simplified Chinese preferences

## Screenshots

The overlay is intentionally absent after about 800 ms. A verified Zotero 9.0.6 runtime capture will be added after completing the manual checklist in `docs/manual-test.md`.

## Installation

1. Run `npm install` and `npm run package`.
2. In Zotero, choose **Tools → Add-ons → Install Add-on From File**.
3. Select `dist/zotero-temporary-ink-0.1.9.xpi`.

The manifest supports Zotero 9.0 through 9.0.x. Version 0.1.1 added the Zotero-required update URL. Versions 0.1.2–0.1.4 fixed toolbar restoration and added the native-style icon. Versions 0.1.5–0.1.7 hardened Reader readiness, and 0.1.8 version-busts bundled scripts during upgrades. Version 0.1.9 removes the bootstrap-incompatible `AbortController` dependency and is the first user-verified stable baseline. The complete manual matrix remains pending.

## Usage and shortcuts

Keep the toolbar mode OFF for normal selection and occasional Ctrl drawing. Select PEN or RECTANGLE to let plain left-drag draw repeatedly. `Ctrl` always selects the pen in OFF mode; add Shift for a rectangle. Escape is consumed only while Temporary Ink has an active or visible stroke.

Alt and Ctrl+Alt are deliberately left to Zotero and Windows and are never claimed by Temporary Ink.

## Preferences

Zotero Preferences → Temporary Ink configures enablement, color, width, opacity, fade delay, and fade duration. Values use `Zotero.Prefs` under `extensions.temporary-ink.*`; local/session storage is not used.

## Development

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run package
npm run verify:package
```

`npm run dev` rebuilds the TypeScript bundle on change. For a Windows extension proxy:

1. Open Zotero's active profile directory from **Help → Troubleshooting Information → Profile Directory**.
2. Under its `extensions` directory, create a plain text file named exactly `temporary-ink@local` (no extension).
3. Put the absolute path to this repository's `build` directory on the file's only line, for example `D:\PPs\Zotero_Temporary_Ink[plugin]\build`.
4. Start `npm run dev`, restart Zotero once to load the proxy, and thereafter disable/re-enable the add-on after bundle changes. Reopen affected Reader tabs when testing document lifecycle code.

The proxy changes only the development profile. Remove that proxy file to unload the source build.

The private Reader dependency and exact pinned sources are documented in `docs/zotero-reader-investigation.md`. All such access must remain in `src/reader/reader-adapter.ts`.

## Known limitations

- PDF only; mouse-first MVP
- Primary view only when Zotero split view is active
- Viewport coordinates are not PDF-page coordinates
- Ink intentionally disappears on scroll, resize, zoom, and rotation
- Offline typecheck, 30 tests, XPI build, and package verification pass
- Zotero 9.0.6 runtime validation confirms that 0.1.9 installs, the toolbar cycles modes, and pen/rectangle drawing works through both toolbar modes and Ctrl shortcuts
- Annotation-count, scaling, multi-Reader, and cleanup stress validation remains pending
- Runtime testing must remain inside the disposable profile and data directory. Do not touch the normal Zotero profile or library
