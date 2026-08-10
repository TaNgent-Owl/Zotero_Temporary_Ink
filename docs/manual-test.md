# Zotero 9.0.6 Manual Test Checklist

Record Zotero build, OS, display scaling, PDF, starting annotation count, result, and console errors for each run. Run against an installed `dist/zotero-temporary-ink-0.1.10.xpi`.

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

## Zero-pollution gate

1. Record the attachment's annotation count.
2. Draw 100 pen/rectangle gestures.
3. Confirm the annotation count is unchanged, Undo/Redo has no Temporary Ink entry, and no sync activity was caused.
4. Close and reopen the PDF; confirm no Temporary Ink remains.

## Cleanup stress gate

Open, draw in, and close the same PDF 20 times. Inspect the Reader DOM: at most one `[data-temporary-ink="canvas"]` and one `[data-temporary-ink="toolbar"]` may exist per live Reader. Confirm no accumulating controllers, listeners, errors, or stuck cursor.

## Result record

Current evidence:

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
- Broad Zotero process cleanup was rejected as unsafe. Future runtime work must use only the disposable profile and data directory; the normal Zotero profile and library must not be touched.
