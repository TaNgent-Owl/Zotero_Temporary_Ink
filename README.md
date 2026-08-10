# Zotero Temporary Ink

Temporary Ink adds a short-lived pen and rectangle overlay to the Zotero PDF Reader. It is meant for pointing, underlining, circling, and framing while reading. **Temporary Ink does not create Zotero annotations, modify PDFs, touch attachments, or participate in sync.**

## Features

- `Alt` + left-drag: transient pen
- `Alt+Shift` + left-drag: transient rectangle
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
3. Select `dist/zotero-temporary-ink-0.1.0.xpi`.

The manifest supports Zotero 9.0 through 9.0.x. The Windows test host has Zotero 9.0.6 exactly, but add-on installation and Reader interaction are not yet verified.

## Usage and shortcuts

Keep the toolbar mode OFF for normal selection and occasional modifier drawing. Select PEN or RECTANGLE to let plain left-drag draw repeatedly. The configured modifier always works in OFF mode. Escape is consumed only while Temporary Ink has an active or visible stroke.

If Windows Alt handling conflicts with your setup, select **Ctrl + Alt** in Preferences. Shift adds rectangle behavior to either modifier.

## Preferences

Zotero Preferences → Temporary Ink configures enablement, color, width, opacity, fade delay, fade duration, and modifier. Values use `Zotero.Prefs` under `extensions.temporary-ink.*`; local/session storage is not used.

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
- Offline typecheck, 20 tests, XPI build, and package verification pass
- An isolated `-datadir profile` run created a separate data directory, but XPI/proxy sideloading did not register the add-on (`extensions.json` remained empty)
- No PDF interaction test has completed; installation success is not claimed
- Runtime testing must remain inside the disposable profile and data directory. Do not touch the normal Zotero profile or library
