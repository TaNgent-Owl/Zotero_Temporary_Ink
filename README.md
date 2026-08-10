# Zotero Temporary Ink

**English** | [简体中文](README.zh-CN.md)

Temporary Ink adds a transient overlay to the Zotero 9 PDF Reader: draw a line, circle a phrase, or frame a paragraph, and the mark fades out on its own shortly after you finish. It is built for the moments when you want to point at something in a PDF without keeping it.

The plugin never writes back to Zotero or the PDF — no annotations, no attachment changes, nothing added to sync.

## Install

1. Download `zotero-temporary-ink-0.1.13.xpi` from the [latest release](https://github.com/TaNgent-Owl/Zotero_Temporary_Ink/releases/latest).
2. In Zotero, open **Tools → Add-ons**.
3. Open the gear menu, choose **Install Add-on From File**, and select the XPI.
4. Restart Zotero if prompted.

The current build targets Zotero 9.0–9.0.x and is verified on 9.0.6. v0.1.9 remains available as the previous stable release if you need to roll back.

## Drawing

- Hold `Ctrl` and drag with the left mouse button to draw with the pen.
- Hold `Ctrl+Shift` and drag to draw a rectangle.
- Click the toolbar button to cycle through OFF, PEN, and RECTANGLE. In PEN or RECTANGLE mode, a plain left-drag draws continuously.
- Press `Esc` to clear the current drawing; when no ink is visible the plugin leaves `Esc` alone.

Strokes drawn close together are grouped into a single sketch. Starting another stroke restores every mark that is still visible and pauses the fade timer. Once the last stroke ends, the whole sketch holds for 300 ms and then fades over 500 ms.

Keep the toolbar mode OFF when you want Zotero's normal text selection. `Alt` and `Ctrl+Alt` are not used by this plugin.

## Preferences

Open **Zotero Settings → Temporary Ink** to adjust pen color, width, opacity, hold time, or fade duration, or to disable the plugin entirely.

Settings are stored with `Zotero.Prefs` under `extensions.temporary-ink.*`; the plugin does not use browser local storage.

## Current limitations

The most visible issue is text selection: while you draw, Zotero/PDF.js may select the embedded text under the pointer. Blocking that selection was tried, but the same interception could stop ink from rendering and, in one case, prevented a test PDF from opening. v0.1.13 therefore keeps Zotero's selection behavior. The selection is harmless — it creates no annotation and modifies nothing.

Other limitations:

- PDF only; mouse input is the tested path.
- In Zotero split view, only the primary view is supported.
- Ink uses viewport coordinates, not PDF-page coordinates.
- Scrolling, zooming, rotating, or resizing clears the current drawing.
- Stress checks for annotation counts, Windows scaling, multiple concurrent Readers, and repeated enable/disable cycles are not yet complete.

## Development

Requires Node.js 22.13 or newer.

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run package
npm run verify:package
```

`npm run package` writes the XPI to `dist/`. `npm run dev` watches the TypeScript sources and rebuilds the unpacked plugin in `build/`.

For a Windows extension proxy:

1. In Zotero, open **Help → Troubleshooting Information → Profile Directory**.
2. Create a plain-text file named `temporary-ink@local` (no extension) in the profile's `extensions` directory.
3. On its only line, put the absolute path to this repository's `build` directory, e.g. `D:\PPs\Zotero_Temporary_Ink[plugin]\build`.
4. Run `npm run dev`, then restart Zotero once. After later rebuilds, disable and re-enable the add-on; reopen PDF tabs when testing Reader lifecycle changes.

Delete the proxy file to unload the development build. The private Zotero Reader APIs used here are documented in [`docs/zotero-reader-investigation.md`](docs/zotero-reader-investigation.md) and stay isolated in `src/reader/reader-adapter.ts`.

## Verification status

The v0.1.13 XPI installs and draws pen strokes and rectangles in Zotero 9.0.6. Toolbar modes, `Ctrl` shortcuts, and the shared multi-stroke fade were confirmed by the user. TypeScript checking, all 37 automated tests, the build, and the package verifier also pass.
