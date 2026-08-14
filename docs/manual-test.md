# Zotero 9.0.6 Manual Test Checklist

Record Zotero build, OS, display scaling, PDF, starting annotation count, result, and console errors for each run. Run against an installed `dist/zotero-temporary-ink-0.2.0.xpi`.

| ID | Test | Expected result |
|---|---|---|
| 01 | Toolbar OFF; plain left-drag PDF text | Text selects normally; plugin does not consume the gesture. |
| 02 | `Ctrl` + left-drag | Red pen follows the pointer, holds about 300 ms, fades over about 500 ms. |
| 03 | `Ctrl+Shift` + left-drag | A live rectangle appears and follows the same fade lifecycle. |
| 04 | Draw A, wait until it begins fading, then start B and continue drawing for more than 800 ms | A immediately returns to full opacity and remains visible while B is active; after B ends, A and B hold and fade together. |
| 05 | Draw rapidly for 10 seconds | No stuck gesture, large jump, persistent CPU load, or obvious Reader slowdown. |
| 06 | Drag from a page to the viewport edge and release | Pointer capture ends the gesture; subsequent clicks are normal. |
| 07 | Press Escape during/after drawing | Active and visible ink clears; Escape is untouched when no ink exists. |
| 08 | Scroll while ink is visible | Ink clears immediately; scrolling remains normal. |
| 09 | Zoom and rotate while ink is visible | Ink clears and no offset residue remains. |
| 10 | Test Windows scaling at 100%, 125%, 150%, 200% | Pointer and ink align; line width and sharpness remain stable. |
| 11 | Open PDF A and PDF B; draw in each | Canvases, modes, and strokes are independent. |
| 12 | Close a Reader while a stroke fades | No canvas, animation frame, listener error, or console exception remains. |
| 13 | Disable the plugin with a PDF open | Canvas and cursor disappear and normal Reader input resumes without restart. |
| 14 | Re-enable with the PDF still open | Ctrl drawing works without restart; no duplicate canvas/listener appears. |
| 15 | With plugin OFF, test Highlight, Underline, Note, Text, Area, Ink, Eraser, Pointer, Hand | Every native Zotero tool behaves normally and retains its state. |
| 16 | Cycle toolbar OFF → PEN → RECTANGLE → OFF | Plain drag is claimed only in PEN/RECTANGLE; Ctrl overrides remain available in OFF. |
| 17 | Change every preference while Readers are open | New gestures use new values; disabling clears ink and mode. |
| 18 | Open EPUB and snapshot Readers | No canvas, active toolbar control, or error is produced. |
| 19 | `Ctrl`-drag across a line of PDF text | Ink draws normally; text selection under the pointer is suppressed (at most a small harmless residue); no lingering selection remains after the stroke fades. |
| 20 | `Ctrl+Shift`-drag across text, release over text | Same as 19 for the rectangle gesture. |
| 21 | Plain drag while toolbar is OFF after tests 19-20 | Text selects normally again immediately; no stuck selection block, class, or style element. |
| 22 | With a text selection already active, `Ctrl`-drag elsewhere | The new ink gesture neither extends nor replaces the selection and the plugin leaves the pre-existing selection alone. |
| 23 | While a stroke fades, inspect the nested viewer `<head>` | No `[data-temporary-ink="selection-block"]` style element and no `temporary-ink-selection-blocked` class remain. |
| 24 | Cycle toolbar OFF → PEN → RECTANGLE → OFF while watching the icon | The icon swaps immediately per mode; OFF restores the default icon; no duplicate button appears. |
| 25 | Long-press the toolbar button | The 6-swatch palette opens near the button; the current color is highlighted; releasing does not cycle the mode. |
| 26 | Click a swatch, then draw | Palette closes; the next stroke uses the new color immediately; the preference pane shows the same value. |
| 27 | Press digit keys 1–6 with no modifiers held | Pen color switches to the matching preset; typing in inputs (e.g. page-number field) is unaffected; Zotero shortcuts are untouched. |
| 28 | Press `[` and `]` with no modifiers held | Width steps 1 px within 1–20 and applies to the next stroke; the preference pane reflects it. |
| 29 | Hold `Ctrl` while toolbar is OFF | Corner badge shows tool name, color dot, and width; it disappears on key release or after about 1 s. |
| 30 | Plain left-drag in PEN mode | Badge appears while drawing and disappears on release. |
| 31 | Draw in PEN mode, then press `Esc` | Ink and badge disappear; no badge DOM node remains. |
| 32 | Open the palette, close with `Esc` / outside click, then disable the plugin | Palette closes with no DOM residue; after disabling, no palette or badge nodes remain in the Reader. |

## Zero-pollution gate

1. Record the attachment's annotation count.
2. Draw 100 pen/rectangle gestures.
3. Confirm the annotation count is unchanged, Undo/Redo has no Temporary Ink entry, and no sync activity was caused.
4. Close and reopen the PDF; confirm no Temporary Ink remains.

## Cleanup stress gate

Open, draw in, and close the same PDF 20 times. Inspect the Reader DOM: at most one `[data-temporary-ink="canvas"]`, one `[data-temporary-ink="toolbar"]`, and one `[data-temporary-ink="badge"]` may exist per live Reader, and no `[data-temporary-ink="palette"]` element may remain. Confirm no accumulating controllers, listeners, errors, or stuck cursor.

## Result record

Current evidence:

- v0.2.0 (2026-08-14) built by the plan-builder-evaluator process (two parallel builder agents, planner/evaluator verification). TypeScript typecheck passes with zero errors and all 80 automated tests pass (14 files); `dist/zotero-temporary-ink-0.2.0.xpi` builds and `verify:package` passes (10 files). Rows 24–32 track the new v0.2 interactions; Zotero 9.0.6 desktop confirmation for them is pending the user's manual run.

- The Windows host has Zotero **9.0.6** exactly.
- Zotero rejected the 0.1.0 XPI because its manifest omitted the Zotero-required `applications.zotero.update_url`; 0.1.1 adds the field and a package regression check.
- Version 0.1.1 installed successfully and modifier pen/rectangle gestures rendered, but its toolbar control was absent because `renderToolbar.append()` was called after asynchronous Reader initialization. Version 0.1.2 appends synchronously and binds the controller afterward.
- Version 0.1.2 still missed toolbars restored before the listener was registered. Version 0.1.3 registers before `uiReadyPromise` and uses the verified `.toolbar .end .custom-sections` host for Readers already open when the plugin starts.
- The 0.1.3 toolbar button is confirmed visible. Version 0.1.4 replaces the generic red asset with a 20 px `currentColor` pen-and-fading-stroke icon modeled on Zotero's native toolbar geometry and active-state behavior.
- Some 0.1.4 Readers required disabling and re-enabling the plugin because Zotero's internal five-second readiness wait expired before the PDF view initialized. Version 0.1.5 retries that official wait with bounded backoff and cancels pending work on Reader close or plugin shutdown.
- Version 0.1.6 no longer treats outer toolbar document replacement as Reader closure, keeps the button clickable while controller attachment is pending, and fixes shortcuts to Ctrl/Ctrl+Shift. Alt and Ctrl+Alt remain unclaimed.
- Version 0.1.7 checks the verified PDF viewer DOM before consulting Zotero's private readiness Promise, so a stalled Promise cannot leave the toolbar permanently unbound while the PDF is already usable.
- Version 0.1.8 appends the plugin version to the bundled script URL so Zotero cannot reuse stale compiled code during an in-process XPI upgrade. It also constructs a fresh ReaderAdapter and ReaderRegistry for every startup.
- Version 0.1.9 replaces the browser-global `AbortController` with an internal cancellation primitive. Zotero's bootstrap script scope does not guarantee DOM globals; the old synchronous constructor failure left the visible toolbar unbound and prevented all drawing.
- Offline gates pass: TypeScript typecheck, 30 automated tests, XPI build, and package verification.
- A fresh isolated Zotero 9.0.6 profile recognized the 0.1.1 XPI as `temporary-ink@local`, version `0.1.1`, with `appDisabled: false` and the expected `9.0` through `9.0.*` target range. Because it was copied directly into the profile, Zotero marked the foreign sideload `userDisabled: true` pending user confirmation.
- User validation confirms that 0.1.9 installs and that the toolbar, Ctrl pen, and Ctrl+Shift rectangle functions work in Zotero 9.0.6. Annotation-count, scaling, multi-Reader, and cleanup stress tests remain incomplete.
- Text selection during drawing (the former top limitation) is largely suppressed. First-round CSS/`selectstart` blocking alone was insufficient on Zotero 9.0.6, where selection is established programmatically from a leaked compatibility `mousedown` (active pointer capture during `pointerdown` disables `preventDefault()`'s mousedown suppression). Deferring `setPointerCapture()` until the first `pointermove` or a zero-delay fallback, plus `user-select: none !important`, `selectstart` cancellation, and `selectionchange` clearing, reduces the residual selection to a small, user-accepted amount; ten automated tests cover the deferral and all guards. Manual rows 19-23 track it on Zotero 9.0.6.
- Broad Zotero process cleanup was rejected as unsafe. Future runtime work must use only the disposable profile and data directory; the normal Zotero profile and library must not be touched.
