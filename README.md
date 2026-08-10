# Zotero Temporary Ink

**English** | [简体中文](README.zh-CN.md)

Temporary Ink is for the moments when you want to point at something in a PDF without keeping it. Draw a line, circle a phrase, or frame a paragraph; the mark disappears shortly after you finish.

Nothing is written back to Zotero or the PDF. The plugin does not create annotations, change attachments, or add anything to sync.

## Install

1. Download `zotero-temporary-ink-0.1.10.xpi` from the [latest release](https://github.com/TaNgent-Owl/Zotero_Temporary_Ink/releases/latest).
2. In Zotero, open **Tools → Add-ons**.
3. Open the gear menu, choose **Install Add-on From File**, and select the XPI.
4. Restart Zotero if it asks you to.

The current build supports Zotero 9.0–9.0.x and has been tested with Zotero 9.0.6. If you need to roll back, v0.1.9 remains available as the previous stable release.

## Drawing

- Hold `Ctrl` and drag with the left mouse button for the pen.
- Hold `Ctrl+Shift` and drag for a rectangle.
- Click the toolbar button to cycle through OFF, PEN, and RECTANGLE. In PEN or RECTANGLE mode, plain left-drag draws repeatedly.
- Press `Esc` to clear the current drawing. When no ink is visible, the plugin leaves `Esc` alone.

Marks drawn close together are treated as one sketch. Starting another stroke restores every mark that is still visible and pauses the fade timer. Once the last stroke ends, the whole sketch stays for 300 ms and then fades over 500 ms.

Keep the toolbar mode OFF when you want Zotero's usual text selection. `Alt` and `Ctrl+Alt` are not used by this plugin.

## Preferences

Open **Zotero Settings → Temporary Ink** to change the pen color, width, opacity, hold time, or fade duration. You can also disable the plugin from this pane.

Settings are stored with `Zotero.Prefs` under `extensions.temporary-ink.*`. The plugin does not use browser local storage.

## Screenshot

There is no runtime screenshot yet. The marks are deliberately brief, so a useful capture needs to show the pointer and active stroke together. A verified Zotero 9.0.6 capture will be added after the remaining manual checks.

## Current limitations

The most noticeable issue is text selection. While you draw, Zotero/PDF.js may also select embedded text under the pointer. We tried blocking that selection, but the same interception could stop ink from rendering and, in one case, prevent a test PDF from opening. v0.1.10 therefore keeps Zotero's selection behavior. The selection is harmless: it does not create an annotation or modify the PDF.

Other limits are straightforward:

- PDF only; mouse input is the tested path.
- In Zotero split view, only the primary view is supported.
- Ink uses viewport coordinates rather than PDF-page coordinates.
- Scrolling, zooming, rotating, or resizing clears the current drawing.
- Annotation-count, Windows scaling, multi-Reader, and repeated enable/disable stress checks are not yet complete.

## Development

Node.js 22.13 or newer is required.

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
2. Create a plain-text file named `temporary-ink@local` (with no extension) inside the profile's `extensions` directory.
3. Put the absolute path to this repository's `build` directory on the only line, for example `D:\PPs\Zotero_Temporary_Ink[plugin]\build`.
4. Run `npm run dev`, then restart Zotero once. After later rebuilds, disable and re-enable the add-on; reopen PDF tabs when testing Reader lifecycle changes.

Delete the proxy file to unload the development build. Private Zotero Reader dependencies are documented in [`docs/zotero-reader-investigation.md`](docs/zotero-reader-investigation.md) and must stay isolated in `src/reader/reader-adapter.ts`.

## What has been checked

The v0.1.10 XPI installs and draws pen strokes and rectangles in Zotero 9.0.6. Toolbar modes, `Ctrl` shortcuts, and the shared multi-stroke fade have been tested by the user. TypeScript checking, all 30 automated tests, the build, and the package verifier also pass.
