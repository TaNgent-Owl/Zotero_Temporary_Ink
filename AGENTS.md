# Repository Guidelines

## Project Structure & Module Organization

This repository is specification-first: `DevDoc.md` defines the MVP and remains authoritative until implementation. Follow its proposed layout: TypeScript in `src/`, unit tests in `tests/`, localization in `locale/`, preference UI in `preferences/`, static files in `assets/`, and investigation and manual-test records in `docs/`. Build artifacts belong in `dist/` and should not be committed.

Keep responsibilities separated. `src/reader/reader-adapter.ts` owns all Zotero Reader DOM and internal-API knowledge; `InputController` handles pointer gestures; `InkModel` owns stroke state and timing; `InkRenderer` owns Canvas drawing, DPR scaling, and fading. Do not collapse these into a single reader module.

## Build, Test, and Development Commands

The package scaffold is not present yet. Once `package.json` is added, provide and document these scripts:

- `npm install` — install development dependencies.
- `npm run build` — compile the plugin.
- `npm test` — run automated unit tests.
- `npm run package` — create `dist/zotero-temporary-ink-<version>.xpi`.

Install the XPI through Zotero's **Tools → Add-ons → Install Add-on From File**. Keep commands synchronized with `README.md` if the chosen template uses different names.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation, semicolons, and focused modules. Name files in kebab-case (`reader-controller.ts`), classes and types in PascalCase, and functions and variables in camelCase. Centralize constants and preferences under `src/config/`. Route diagnostics through `Logger.debug`, `Logger.warn`, and `Logger.error`; avoid logging every `pointermove`. Brittle selectors and direct `_iframeWindow` access are allowed only inside `ReaderAdapter` and must include a Zotero-version note.

## Testing Guidelines

Name unit tests `*.test.ts`; prioritize geometry and stroke-lifecycle coverage. Record interactive checks in `docs/manual-test.md`. Before merging, verify text selection, pen and rectangle gestures, Escape, scrolling, zoom, Windows scaling, multiple readers, disable/re-enable cleanup, and native Zotero annotation tools. Temporary drawing must create zero annotations and leave no duplicate canvases, listeners, or timers.

## Commit & Pull Request Guidelines

There is no Git history yet. Use small Conventional Commit-style changes such as `feat: render temporary pen strokes`, `fix: harden reader lifecycle cleanup`, and `docs: document Zotero 9 reader architecture`. Pull requests should summarize behavior, link an issue when available, list automated and manual results, note the tested Zotero version, and include screenshots or a short recording for visible UI changes.

## Security & Compatibility

Never modify PDFs, attachments, Zotero's database, installation files, or built-in CSS. Prefer public Reader lifecycle events, isolate unavoidable internals, and fail safely without breaking the Reader.
