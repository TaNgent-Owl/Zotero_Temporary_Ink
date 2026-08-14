# Zotero Temporary Ink

**English** | [简体中文](README.zh-CN.md)

Temporary Ink adds a transient overlay to the Zotero 9 PDF Reader: draw a line, circle a phrase, or frame a paragraph, and the mark fades out on its own shortly after you finish. It is built for the moments when you want to point at something in a PDF without keeping it.

The plugin never writes back to Zotero or the PDF — no annotations, no attachment changes, nothing added to sync.

## Install

1. Download `zotero-temporary-ink-0.2.0.xpi` from the [latest release](https://github.com/TaNgent-Owl/Zotero_Temporary_Ink/releases/latest).
2. In Zotero, open **Tools → Add-ons**.
3. Open the gear menu, choose **Install Add-on From File**, and select the XPI.
4. Restart Zotero if prompted.

The current build targets Zotero 9.0–9.0.x and is verified on 9.0.6. v0.1.13 remains available as the previous stable release if you need to roll back.

## Drawing

- Hold `Ctrl` and drag with the left mouse button to draw with the pen.
- Hold `Ctrl+Shift` and drag to draw a rectangle.
- Click the toolbar button to cycle through OFF, PEN, and RECTANGLE. In PEN or RECTANGLE mode, a plain left-drag draws continuously.
- Press `Esc` to clear the current drawing; when no ink is visible the plugin leaves `Esc` alone.
- The toolbar icon follows the current mode (OFF / PEN / RECTANGLE); hovering it shows the mode in the tooltip.
- Long-press the toolbar button to open the quick palette: six preset colors, click one to switch the pen color immediately. The palette highlights the current color, closes on `Esc` or a click outside, and only writes the plugin's own preference — never Zotero data.
- Press the digit keys `1`–`6` to switch between the six preset colors, and `[` / `]` to decrease / increase the pen width by 1 px (1–20). Both respond only when no modifier is held and nothing editable is focused, so Zotero's own shortcuts are untouched.
- While you hold the drawing modifier in OFF mode, or while you draw in PEN/RECTANGLE mode, a small badge in the reader corner shows the active tool, its color dot, and the current width. It disappears on key release or after about one second, and it never intercepts any input.

Strokes drawn close together are grouped into a single sketch. Starting another stroke restores every mark that is still visible and pauses the fade timer. Once the last stroke ends, the whole sketch holds for 300 ms and then fades over 500 ms.

Keep the toolbar mode OFF when you want Zotero's normal text selection. The pen and rectangle shortcuts default to `Ctrl` and `Ctrl+Shift`; they can be changed to `Alt` or `Ctrl+Alt` in the preferences.

## Preferences

Open **Zotero Settings → Temporary Ink** to adjust pen color, width, opacity, hold time, or fade duration, or to disable the plugin entirely.

Settings are stored with `Zotero.Prefs` under `extensions.temporary-ink.*`; the plugin does not use browser local storage.

## Current limitations

Drawing now substantially suppresses the text selection that used to follow the pointer. While a gesture is claimed, the plugin defers pointer capture so `preventDefault()` can suppress the compatibility `mousedown`, and additionally blocks selection inside the nested viewer with a scoped `user-select: none` stylesheet, a `selectstart` cancel, and a `selectionchange` clear. A small residual selection can still appear in some cases; it is harmless — no annotation is created and the PDF is never modified. Keep the toolbar mode OFF when you want Zotero's normal text selection. No mouse-event interception is added, so ink rendering and PDF loading are unaffected.

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

Delete the proxy file to unload the development build. The private Zotero Reader APIs used here are documented in [`docs/zotero-reader-investigation.md`](docs/zotero-reader-investigation.md) and stay isolated in `src/reader/reader-adapter.ts`. Planned functional work is tracked in [`docs/roadmap.md`](docs/roadmap.md).

## Verification status

The v0.2.0 build adds mode-visible toolbar icons, a quick color palette (long-press or digits `1`–`6`), `[` / `]` width stepping, and a corner hint badge, all documented above. The v0.1.13 XPI verified pen strokes, rectangles, toolbar modes, `Ctrl` shortcuts, and the shared multi-stroke fade in Zotero 9.0.6. TypeScript typechecking and all 80 automated tests pass; the v0.2 manual checks are rows 24–32 of `docs/manual-test.md`.
