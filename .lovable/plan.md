# Toolzy — Site-Wide Improvement Plan

Covers all 10 tools (JSON Formatter, Encoding Hub, Crypto Suite, JWT Hub, Color Converter, API Diff, Fake Data Generator, Env Generator, Date & Time, Regex Playground) across four areas: UI/UX, performance, SEO/AEO/GEO, and new features.

## 1. UI/UX polish

- **Consistent page shell**: create a shared `ToolPageLayout` (title + privacy badge + toolbar slot + content) so every tool has identical spacing, heading hierarchy, and toolbar density.
- **Mobile responsiveness audit**: fix overflow in wide toolbars (wrap/scroll), make resizable split panels stack vertically on small screens, ensure tables (API Diff, color batch) scroll horizontally.
- **Hardcoded color cleanup**: replace remaining hardcoded color utilities (e.g. `text-yellow-400`, `text-green-400`, `bg-yellow-500/40` in JsonTreeNode and similar in other tools) with semantic tokens so theming stays consistent.
- **Keyboard & focus**: visible focus rings, `Esc` clears dialogs, consistent `Cmd/Ctrl+Enter` "run" shortcut across tools that have a primary action.
- **Empty states**: friendly placeholder art/text in every output panel instead of blank boxes.

## 2. Performance

- **Route-based code splitting**: `React.lazy` + `Suspense` for every tool page in `App.tsx` so the homepage loads fast and each tool's bundle loads on demand (biggest win: ColorConverter 29KB, CryptoSuite 46KB, JwtHub 36KB, ApiDiff 22KB).
- **Debounced heavy work**: verify all live-processing inputs (regex, JSON parse, color convert) use 300ms debounce; add where missing.
- **Memoization**: wrap expensive derived data (tree rendering, diff computation, palette generation) in `useMemo`/`useCallback` consistently.
- **Large-input guards**: JSON tree virtualization or node-count cap with "expand on demand" for very large payloads.

## 3. SEO / AEO / GEO

- **Per-page meta audit**: ensure every tool page has a unique title, description, canonical, and keywords via `ToolSEO`; fix any duplicates.
- **Structured data completeness**: every tool gets `WebApplication` + `HowTo` schema; homepage keeps `WebSite`/`Organization`/`SoftwareApplication`.
- **FAQ content expansion**: add 3–5 real Q&As per tool page (visible on page + FAQPage-style content) targeting common search queries.
- **sitemap.xml refresh**: confirm all 10 routes + homepage present with correct lastmod dates.
- **llms.txt update**: reflect the merged hubs (Encoding Hub, JWT Hub, Crypto Suite) so AI engines describe the site accurately.
- **Note**: per-route meta is client-side (react-helmet-async); crawlers that don't run JS see only index.html. Full per-route SSR meta would require the TanStack Start migration — optional, not included here.

## 4. New tool features

- **JSON Formatter**: syntax highlighting in text output view; JSON diff mode (reuse diff engine from API Diff).
- **Encoding Hub**: "copy as data URI" quick action in the toolbar; paste-from-clipboard button.
- **Crypto Suite**: password strength meter alongside hash generator; HMAC quick-verify.
- **JWT Hub**: "generate sample token" one-click button for instant demo.
- **Color Converter**: eyedropper input via `EyeDropper` API where supported.
- **Date & Time**: date-difference calculator (days between two dates).
- **Regex Playground**: shareable link with pattern + test string encoded in URL.
- **Homepage**: search box to filter tools by name/keyword.

## Technical details

- New shared component: `src/components/ToolPageLayout.tsx`.
- `App.tsx`: convert page imports to `lazy()` with a loading fallback.
- New design tokens in `index.css` for syntax-highlight colors (`--syntax-string`, `--syntax-number`, etc.) replacing hardcoded colors.
- No new npm dependencies; no backend; everything stays 100% client-side.
- Files touched: `App.tsx`, `index.css`, all 10 tool pages, `public/sitemap.xml`, `public/llms.txt`, plus the new layout component.

## Order of work

1. Route code-splitting + ToolPageLayout (foundation)
2. UI/UX polish pass on all tools
3. Performance fixes (debounce, memoization, large-input guards)
4. New features per tool
5. SEO/AEO/GEO audit + content expansion
6. Final build verification
