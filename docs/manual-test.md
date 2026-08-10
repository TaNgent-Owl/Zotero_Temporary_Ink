# Zotero 9.0.6 Manual Test Checklist

Record Zotero build, OS, display scaling, PDF, starting annotation count, result, and console errors for each run. Run against an installed `dist/zotero-temporary-ink-0.1.0.xpi`.

| ID | Test | Expected result |
|---|---|---|
| 01 | Toolbar OFF; plain left-drag PDF text | Text selects normally; plugin does not consume the gesture. |
| 02 | `Alt` + left-drag | Red pen follows the pointer, holds about 300 ms, fades over about 500 ms. |
| 03 | `Alt+Shift` + left-drag | A live rectangle appears and follows the same fade lifecycle. |
| 04 | Draw A, B, C rapidly | All three coexist and expire independently. |
| 05 | Draw rapidly for 10 seconds | No stuck gesture, large jump, persistent CPU load, or obvious Reader slowdown. |
| 06 | Drag from a page to the viewport edge and release | Pointer capture ends the gesture; subsequent clicks are normal. |
| 07 | Press Escape during/after drawing | Active and visible ink clears; Escape is untouched when no ink exists. |
| 08 | Scroll while ink is visible | Ink clears immediately; scrolling remains normal. |
| 09 | Zoom and rotate while ink is visible | Ink clears and no offset residue remains. |
| 10 | Test Windows scaling at 100%, 125%, 150%, 200% | Pointer and ink align; line width and sharpness remain stable. |
| 11 | Open PDF A and PDF B; draw in each | Canvases, modes, and strokes are independent. |
| 12 | Close a Reader while a stroke fades | No canvas, animation frame, listener error, or console exception remains. |
| 13 | Disable the plugin with a PDF open | Canvas and cursor disappear and normal Reader input resumes without restart. |
| 14 | Re-enable with the PDF still open | Modifier drawing works without restart; no duplicate canvas/listener appears. |
| 15 | With plugin OFF, test Highlight, Underline, Note, Text, Area, Ink, Eraser, Pointer, Hand | Every native Zotero tool behaves normally and retains its state. |
| 16 | Cycle toolbar OFF → PEN → RECTANGLE → OFF | Plain drag is claimed only in PEN/RECTANGLE; modifier overrides remain available in OFF. |
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

Runtime verification has not been performed in this source environment. Do not mark the Zotero 9.0.6 acceptance items PASS until these checks are executed in Zotero Desktop.
