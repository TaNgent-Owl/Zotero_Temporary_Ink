# Repository Guidelines

## Project structure

The plugin source lives in `src/`. Keep Zotero Reader internals inside `src/reader/reader-adapter.ts`; controllers coordinate lifecycle and input, while `src/ink/` owns geometry, stroke state, Canvas rendering, and pointer handling. Toolbar and preference code belongs in `src/ui/` and shared settings in `src/config/`.

Static extension files are kept at the repository root and in `assets/`, `locale/`, and `preferences/`. Automated tests live in `tests/`; investigation notes, architecture decisions, the manual checklist, and code audit reports live in `docs/`. Save each audit as `docs/audit-<version>.md` and read the latest audit before starting a new one. Generated output goes to `build/` and `dist/` and must not be committed.

## Build and test commands

Use Node.js 22.13 or newer.

- `npm install` installs development dependencies.
- `npm run typecheck` checks TypeScript without emitting files.
- `npm test` runs the Vitest suite.
- `npm run build` creates the unpacked extension in `build/`.
- `npm run package` builds `dist/zotero-temporary-ink-<version>.xpi`.
- `npm run verify:package` checks the XPI layout and manifest metadata.

Install test builds through Zotero's **Tools → Add-ons → Install Add-on From File**.

## Code style

Use TypeScript with two-space indentation and semicolons. Name files in kebab-case, classes and types in PascalCase, and functions and variables in camelCase. Keep modules focused. Route diagnostics through `Logger`; do not log high-frequency pointer movement. Direct `_iframeWindow` access and verified Reader selectors belong only in `ReaderAdapter`.

## Testing

Name tests `*.test.ts`. Add automated coverage for model, geometry, input arbitration, and cleanup changes. Record Zotero Desktop checks in `docs/manual-test.md`. Drawing must never create annotations or leave duplicate canvases, listeners, timers, or toolbar controls.

## Commits and pull requests

Use concise Conventional Commit messages such as `fix: restart grouped fade timer` or `docs: update installation guide`. Pull requests should describe visible behavior, list automated and manual results, name the tested Zotero version, and include a screenshot or recording when the UI changes.

## Safety and compatibility

Do not modify PDFs, attachments, Zotero's database, built-in CSS, or installation files. Isolate unavoidable private APIs, clean up every listener and DOM node on shutdown, and fail without breaking the Reader.
