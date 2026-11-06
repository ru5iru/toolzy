# Toolzy Improvement Roadmap

## HTML WYSIWYG Editor
- [x] Add safe local rich-text editing, instant HTML source, formatting, and exports.
- [x] Register tool and update SEO/discovery/documentation.
- [x] Test sanitization and verify editing, download, and mobile layout.

## Markdown Editor
- [x] Add local document utilities, editor suggestions/commands, and safety tests.
- [x] Add full-height workspace, preview/compare, autosave, files, shortcuts, and exports.
- [x] Register route, home/search, navigation, SEO, sitemap, and documentation.
- [x] Verify editing, suggestions, rendering safety, persistence, downloads, themes, and mobile.

- [x] 1. Foundation: route code-splitting (lazy + Suspense), shared ToolPageLayout
- [x] 2. UI/UX: semantic color tokens replace hardcoded classes, consistent shell
- [x] 3. Performance: useDebouncedValue hook; debounced JSON parse + regex eval
- [x] 4. Features: homepage search, regex share links, date-diff calculator, JSON syntax highlighting, JWT sample token, Encoding Hub data-URI copy, Crypto password strength, Color eyedropper
- [x] 5. SEO/AEO: FAQ expansion (3-5 per page), sitemap lastmod refresh, llms.txt covers all 10 tools
- [x] 6. Final verification: production build + preview check

## Image Metadata Viewer
- [x] Add local parser, normalization, privacy analysis, safe exports, and lifecycle tests.
- [x] Add viewer using shared controls, route, listing, navigation, SEO, and documentation.
- [x] Verify synthetic uploads, exports, switching, mobile layout, and existing tools.

## Fake Data Generator
- [x] 1. Engine and tests.
- [x] 2. Template editor, options, JSON generation/copy/download.
- [x] 3. Searchable method browser.
- [x] 4. Synchronized builder.
- [x] 5. NDJSON, CSV, SQL, YAML exports.
- [x] 6. Presets, saved templates, import/export/share.
- [x] 7. Worker, performance, SEO, and end-to-end verification.

## Document Signer
- [x] 1. Shared crypto helpers in `src/lib/crypto` (JWT Hub now imports them) and shared `FileDropzone`.
- [x] 2. Core: keys (PEM/JWK), RSA-PSS and ECDSA sign/verify, manifest, inspector, cancellable worker session; OpenSSL interoperability tests.
- [x] 3. Page with Sign, Verify, Keys and Inspector tabs; route, sidebar, homepage, sitemap, llms.txt, SEO.
- [x] 4a. v2: Ed25519 (feature-detected) and RSA-PSS 4096, with OpenSSL interop tests.
- [x] 4b. v2: encrypted PKCS#8 export/import (PBES2, no library), opt-in IndexedDB storage of non-extractable keys, batch sign/verify with ZIP.
- [x] 5a. Secrets generator tab in Crypto Suite.
- [x] 5b. PS256/384/512 and JWK in JWT Hub; X.509/CSR certificate inspector at `/certificate`.
- [ ] 6. Later: embedded PDF signatures (CMS/PAdES) and X.509 trust chains, only if there is demand.
## Image Metadata Removal
- [x] Lossless JPEG/PNG cleaner, verification report, comparison, safe download, tests, browser check.

## Image Viewer Improvements
- [x] Improve processing status, cancellation/retry, and clean-worker startup handling.
- [x] Add cross-category search and matched-result counts without changing the shared look.
- [x] Run targeted tests and verify inspection, search, cleaning, and downloads in the browser.

## UI/UX upgrade (see DESIGN.md)
- [x] Foundation: tokens, motion, focus; Button/Tabs/Input/Toggle states; `selected` variant.
- [x] Shell: sticky top bar with tool name, responsive padding, sidebar hover.
- [x] `ToolHeader` + `ToolPageLayout`; all pages migrated off hand-written headers; compact "Local only" chip.
- [x] Launcher home page (search focused on load, `/` shortcut, Enter opens first match, tiles are links).
- [ ] Next: light theme, command palette (Ctrl/Cmd+K), shared `ResultPanel` and `CopyButton`, per-tool density pass for JSON, JWT and Fake Data toolbars.

## Capability and UX plan (feat/ui-density-pass follow-up)
Survey result: tools are solid but navigation, copy feedback and a few everyday utilities are missing.
- [x] 1. Command palette (Ctrl/Cmd+K) with tool search, aliases (base64, uuid, hash, jwt, cron…) and a top-bar trigger.
- [x] 2. Shared `CopyButton` created and adopted in Text, Regex, Env and JSON TypeScript. Remaining ad-hoc clipboard call sites (about 24) to migrate.
- [x] 3. New tool: Text Utilities (case converters, slugify, sort/dedupe/trim lines, counts, line numbers) with tested pure helpers.
- [x] 4. Regex Playground: replace mode with `$1` / `$<name>` preview and copy.
- [x] 5. JSON Formatter: JSON to TypeScript interfaces (tested generator).
- [x] 6. Env Generator: strip values into `.env.example`, and convert `.env` to JSON.
- [ ] 7. Verify (unit, e2e, 390 px, 1920 px), update README, DESIGN.md, sitemap, llms.txt.
- Done since: `/html-editor` is routed, listed in the sidebar/home/search, and documented (see the HTML WYSIWYG Editor section above).
