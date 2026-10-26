# Toolzy — Developer Tools Suite

Toolzy is a fast, privacy-first collection of everyday developer utilities that run **entirely in the browser**. Tool inputs are processed locally, without a processing backend. The website still loads its own static assets. Built as a single-page React application optimized for performance, SEO/AEO/GEO discoverability, and a keyboard-friendly developer UX.

- **Live:** https://toolzy.lovable.app
- **Stack:** React 18 · Vite 5 · TypeScript 5 · Tailwind CSS 3 · shadcn/ui · React Router 6

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Available Scripts](#available-scripts)
3. [Project Structure](#project-structure)
4. [Important Files](#important-files)
5. [Tools — Full Catalog & Capabilities](#tools--full-catalog--capabilities)
6. [Design System](#design-system)
7. [SEO / AEO / GEO](#seo--aeo--geo)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Contributing a New Tool](#contributing-a-new-tool)

---

## Quick Start

### Prerequisites
- **Node.js** ≥ 18 (LTS recommended)
- **bun**, **npm**, **pnpm**, or **yarn** — examples use `npm`

### Install & Run
```bash
# 1. Clone
git clone <your-repo-url>
cd toolzy

# 2. Install dependencies
npm install            # or: bun install

# 3. Start the dev server (Vite, HMR enabled)
npm run dev            # http://localhost:8080

# 4. Production build
npm run build          # outputs to ./dist
npm run preview        # serve the built bundle locally
```

The dev server binds to `::` on port `8080` (see `vite.config.ts`). Vite HMR overlay is disabled to keep the UI clean.

### Environment
No `.env` is required — Toolzy is 100% client-side. There is no backend, no API keys, no database.

---

## Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server on `:8080` with HMR. |
| `npm run build` | Production build to `dist/`. |
| `npm run build:dev` | Build with development mode (source maps, no minify). |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint across the project. |
| `npm run test` | Run Vitest once. |
| `npm run test:watch` | Run Vitest in watch mode. |

---

## Project Structure

```
toolzy/
├── public/                    # Static assets served at site root
│   ├── favicon.ico, favicon-16/32, apple-touch-icon.png
│   ├── android-chrome-192/512.png
│   ├── site.webmanifest       # PWA manifest
│   ├── robots.txt             # Crawler rules + sitemap pointer
│   └── sitemap.xml            # SEO sitemap for all tool routes
├── src/
│   ├── main.tsx               # React entry point
│   ├── App.tsx                # Routes + providers (Router, Query, Helmet, Toasts)
│   ├── index.css              # Tailwind layers + HSL semantic design tokens
│   ├── App.css                # Minor global styles
│   ├── components/
│   │   ├── AppLayout.tsx      # Sidebar shell, page chrome
│   │   ├── AppSidebar.tsx     # Tool navigation + brand
│   │   ├── NavLink.tsx        # React Router NavLink wrapper
│   │   ├── ToolSEO.tsx        # Per-tool meta tags, JSON-LD FAQ/HowTo
│   │   ├── ui/                # shadcn/ui primitives (button, dialog, …)
│   │   ├── encoding-hub/      # (uses base64/ + url-encode/ utilities)
│   │   ├── base64/            # Base64 encode/decode + content detection
│   │   ├── url-encode/        # Percent-encoding, query parsing, batch, diff
│   │   ├── crypto/            # Hashing engine (Web Crypto, HMAC, file streaming) and UUID generation (v1/v3/v4/v5, bulk, export). Workers live in src/workers/.
│   │   ├── color/             # Color parsing, conversion, palettes, WCAG
│   │   ├── json-formatter/    # JSON tree, stats, schema, privacy badge
│   │   ├── jwt/               # JWT Hub utilities (decode/encode/verify) — shared by /jwt
│   │   │                       # (legacy jwt-decoder/ and jwt-encoder/ folders also house reusable helpers)
│   │   └── api-diff/          # Structural diff engine (JSON/XML/HTML/Text)
│   ├── pages/                 # One file per tool route
│   ├── hooks/                 # use-mobile, use-toast
│   ├── lib/utils.ts           # `cn()` tailwind-merge helper
│   └── test/                  # Vitest setup + example test
├── index.html                 # Root HTML, SEO meta, favicons, GSC verification
├── tailwind.config.ts         # Theme tokens, fonts, animations
├── vite.config.ts             # Vite + SWC React, `@/` alias to ./src
├── vitest.config.ts           # Vitest + jsdom env
├── playwright.config.ts       # E2E config (Playwright)
└── tsconfig*.json             # Loose TS config (allowJs, no implicit-any off)
```

---

## Important Files

| File | What it does |
| --- | --- |
| `src/App.tsx` | Wires every route in the app. Add new tools here. Wraps the tree with `HelmetProvider`, `QueryClientProvider`, `TooltipProvider`, both Sonner & shadcn Toasters, and `BrowserRouter` → `AppLayout`. |
| `src/components/AppLayout.tsx` | Persistent sidebar shell, theme container. Every page renders inside it. |
| `src/components/AppSidebar.tsx` | Source of truth for the tools menu — add a `{ title, url, icon }` entry when you ship a new tool. |
| `src/components/ToolSEO.tsx` | Drop-in component every tool page uses. Emits `<title>`, meta description, keywords, canonical URL, FAQ + HowTo JSON-LD for AEO/GEO. |
| `src/index.css` | Defines all design tokens (background, foreground, primary, accent, muted, gradients, shadows) as HSL CSS variables. **Never hardcode colors in components — always use these tokens.** |
| `tailwind.config.ts` | Maps the CSS variables to Tailwind classes (`bg-background`, `text-primary`, etc.), registers `@tailwindcss/typography`, `tailwindcss-animate`, font families. |
| `vite.config.ts` | Dev server on `:8080`, `@/` path alias, lovable-tagger in dev. |
| `index.html` | Root document. Contains `<title>`, Open Graph + Twitter cards, Google Site Verification, manifest link, favicons, theme color. |
| `public/sitemap.xml` | Lists every tool URL for search engines. Update when you add a route. |
| `public/robots.txt` | Allows all crawlers; points to `sitemap.xml`. |
| `public/site.webmanifest` | PWA install metadata (name, theme color, icons). |

---

## Tools — Full Catalog & Capabilities

### Image Metadata Viewer — `/image-metadata`

Inspect JPEG, PNG, and classic TIFF locally with **exifr 7.1.3**. The new route follows the existing short tool URLs and appears in the sidebar and searchable homepage.

- Select one file or drag and drop; signatures, not MIME types or extensions, determine support. Files are bounded to 25 MiB, parsing to 20 seconds, nesting to 12 levels, 5,000 tags, and 100,000 characters per value. A disposable worker keeps parsing off the UI thread and cancels obsolete requests.
- Local JPEG/PNG preview, filename, byte size, detected and declared MIME types, last-modified date, decoded dimensions or available width/height tags. TIFF inspection does not require a native TIFF preview.
- Search within Overview, Camera, Location, Dates, IPTC/XMP, and Other; each extracted field has a human-readable label, parser tag path, value, and copy action. EXIF camera/lens/exposure/ISO/flash/orientation/white-balance/software/serial fields, GPS coordinates/altitude/time/direction, and available IPTC/XMP rights/creator/title/keywords/location fields are displayed only when detected. ICC, JFIF, PNG IHDR and other supported tags are also inspected.
- Evidence-based privacy findings for coordinates, capture timestamps, device identifiers, creator/owner fields, location names, and detectable EXIF thumbnails. No invented score or anonymity guarantee. Original EXIF dates are preserved because timezone information is often absent.
- Copy GPS coordinates without contacting a mapping service. Export all normalized fields and findings as JSON or all field rows as CSV. CSV uses quoted/escaped fields and neutralizes formula prefixes. Export filenames are fixed rather than derived from untrusted input.
- No images, metadata, or coordinates are uploaded or persistently stored. Selected image previews use local object URLs, released on switching/reset/unmount. Downloads release their temporary URLs after starting. Worker results cannot overwrite a newer selection.
- Empty, oversized, unsupported, truncated, parse-failed, and preview-failed files have explicit states. No detected embedded metadata is distinct from failure and does not establish complete coverage. Parser diagnostics are not shown as raw untrusted errors.
- **Limits:** WebP, HEIC/HEIF, AVIF, RAW and BigTIFF are intentionally not enabled. Proprietary maker notes and unsupported thumbnail types are not verified. A damaged file may yield partial metadata; success is not a full file-integrity check. PNG/ICC/XMP coverage depends on what exifr supports, not every possible ancillary field. TIFF dimensions depend on available tags.
- **Create Clean Copy is deferred:** reliable, format-specific removal and re-parsing are needed before shipping it; canvas conversion could lose profiles, transparency, orientation, animation, or quality. Originals are never modified.

Important files: `src/pages/ImageMetadataViewer.tsx` (shared UI/SEO), `src/components/image-metadata/metadataUtils.ts` (signature checks, extraction, normalization, privacy, exports), `inspectionSession.ts` (worker cancellation and object-URL lifecycle), `src/workers/imageMetadataWorker.ts` (local processing), and adjacent `*.test.ts` files (synthetic fixtures and lifecycle tests). Run `bun run test` and `bun run lint`; the normal Vite build also bundles the worker. No environment variables or backend configuration are needed.

**Delivery validation:** `bun run test` passed all 15 tests (14 new, one existing). Targeted ESLint on the new page, utilities, tests, and worker passed. Whole-project `bun run lint` reports 90 existing errors and 13 warnings in unrelated files; those were not refactored. The platform's automated build/type-check reports `build OK`; manual build/type-check commands were not run because the environment manages those checks. Playwright verified discovery through homepage search, `/image-metadata`, tagged JPEG inspection and preview, JSON/CSV downloads read back from disk, metadata-free PNG, unsupported WebP, replacing/resetting files, a 390px layout without horizontal overflow, and the existing JSON route. The inspected flow produced no browser errors and no nonlocal requests or data-bearing requests. The dependency scan reports no exifr advisory but flags existing react-router, recharts/lodash, and zod dependencies; upgrades are outside this feature's scope. Other tools were not exhaustively exercised.

**Changed files:** new page, `src/components/image-metadata/{metadataUtils,inspectionSession}.ts`, their two test files, and `src/workers/imageMetadataWorker.ts`; integration updates in `src/App.tsx`, `src/components/AppSidebar.tsx`, `src/pages/Index.tsx`, `public/sitemap.xml`, `public/llms.txt`, `README.md`, `package.json`, and the Bun lockfile. Architecture and task tracking are recorded in `AGENTS.md` and `roadmap.md`.

Every tool below is **100% client-side** (no network requests for data processing), uses native Web APIs where possible, and ships with SEO/AEO/GEO metadata (FAQ + HowTo JSON-LD).

### 1. JSON Formatter — `/json`
Format, validate, minify, and explore JSON with a developer-grade workbench.

- **Format / Beautify** with configurable indent (2 / 4 / tab).
- **Minify** to a single line for transport.
- **Validate** with precise error location (line + column) and human-readable hints.
- **Resizable split-pane** input/output (drag handle).
- **Interactive tree view** with collapsible nodes, key/value highlighting, copy-path.
- **JSON Statistics**: depth, key count, array/object counts, file size.
- **Schema panel**: auto-infer a JSON Schema skeleton from the input.
- **Privacy badge**: visual reminder that nothing leaves the browser.
- **Copy / Download** as `.json`.
- **Auto-format on paste** with debounce.

### 2. Encoding Hub — `/encode`
Unified encoder/decoder for Base64, URL encoding, and Data URLs with
auto-detect and file support.

**Modes** (segmented pill selector, URL-persisted via `?mode=`):

- **Auto-Detect**: scans input and silently routes to the correct
  encoder/decoder, with a live "Detected: …" explanation.
- **Base64**: encode text or files to Base64; decode to text with
  JSON/image/PDF content previews. UTF-8 safe (TextEncoder/TextDecoder).
- **Base64 URL-safe**: same as Base64 but uses `-` and `_` instead of `+` and `/`,
  no padding — safe for URLs and filenames.
- **URL Encode**: four sub-modes (`encodeURIComponent`, `encodeURI`, form,
  RFC 3986). Query-string table editor, batch mode, character breakdown,
  security scanner, visual diff, local history.
- **Data URL**: builder (text or file → data URI) and decoder with inline
  image/text/JSON previews and file download.

**Shared UX**: resizable split-pane, swap (output → input), copy, download,
character count, async offload for inputs > 50 KB.

Nothing leaves the browser. Old routes `/base64` and `/url-encode` redirect here.

### 3. Color Converter — `/color`
Comprehensive color toolkit for developers and designers.

- **Inputs accepted**: HEX (3/6/8-digit), RGB(A), HSL(A), HSV/HSB, HWB, CSS Color Level 4 (`lab`, `lch`), CSS named colors.
- **Live outputs**: HEX, RGB, HSL, HSV, CMYK, plus CSS / SCSS variable snippets.
- **Interactive HSL & alpha sliders** with live preview on light & dark backgrounds.
- **Palette generator**: Complementary, Analogous, Triadic, Tetradic, Split-complementary, Monochromatic, Shades/Tints.
- **WCAG 2.1 contrast checker**: pass/fail AA & AAA badges for both normal & large text.
- **Gradient builder**: linear & radial, multi-stop, CSS export.
- **Image color extractor**: drop an image, get its dominant palette via Canvas API.
- **Batch converter** via textarea.
- **Favorites & history** in `localStorage`; **URL state** (`?value=#3ecfcf`).

### 4. Crypto Suite — `/crypto`
Browser-native cryptographic hashing and UUID generation in a two-tab workbench, powered entirely by the Web Crypto API. Old routes `/hash` and `/uuid` redirect here.

**Hashing tab**

- Input modes: Text, File (drag-and-drop, up to 500 MB via Web Worker), Hex string
- Algorithms: SHA-1, SHA-256, SHA-384, SHA-512 — computed simultaneously, visibility toggleable per algorithm
- Output formats: hex lowercase, hex uppercase, Base64, Base64 URL-safe
- HMAC mode: HMAC-SHA-256/384/512 with secret key input
- File hashing with progress bar; chunked streaming for files > 50 MB
- Hash comparison with character-level diff highlighting
- Hash history (last 10 inputs, localStorage)
- MD5 and bcrypt intentionally not supported

**UUID Generator tab**

- Versions: v1 (timestamp), v3 (MD5/namespace), v4 (random, `crypto.getRandomValues`), v5 (SHA-1/namespace)
- Bulk generation: 1–10,000 UUIDs; Web Worker for > 1,000; virtualised list for > 500 results
- Formatting toggles: uppercase, no hyphens, `{braces}`, `urn:uuid:` prefix
- Validator: version, variant, well-formedness detection
- v1 decoder: embedded timestamp (ISO 8601), clock sequence, node
- Nil UUID and Max UUID (RFC 9562) quick-copy shortcuts
- UUID comparison: field-by-field breakdown, v1 timestamp delta
- Export: CSV, JSON, SQL `INSERT`, plain TXT
- Code snippets: JavaScript, Python, Go, SQL

### 5. JWT Hub — `/jwt`
Decode, encode, and verify JSON Web Tokens in a unified three-tab workbench.

- **Decode tab**: paste any JWT, inspect syntax-highlighted header and payload, validate standard claims (`exp`, `nbf`, `iat`, `iss`, `aud`, `sub`), restore from 10-token `localStorage` history.
- **Encode tab**: algorithm picker (HS256/384/512, RS256, ES256), JSON header and payload editors, quick claim helpers (`exp`, `nbf`, `iss`, `aud`, `jti`), sign via Web Crypto API.
- **Verify tab**: signature verification with secret or PEM public key, claims checklist, server-side code examples (Node.js, Python, Go, PHP).
- **Shared panel (all tabs)**: colour-coded token preview (header · payload · signature pills) and a live security score card (A–F grade, per-finding severity badges).
- Nothing leaves the browser.

### 6. API Response Diff — `/diff`
Compare two API responses with structural awareness.

- **Format auto-detect**: JSON, XML, HTML, plain text.
- **Structural diff**: detects added, removed, and modified fields, including **type changes** (e.g., `string` → `number`).
- **Ignore rules**: exact paths, wildcards (`items[].id`), or regex.
- **Two views**: hierarchical **Tree** view and a flat **Table** view with path filter.
- **Summary panel**: counts of additions, deletions, modifications.
- **Drag-and-drop** files into either side.
- **Auto-format on paste**.
- **Export** diff as JSON or Markdown report.
- **Resizable split-pane** layout.

### 7. Fake Data Generator — `/fake-data`
Generate realistic mock data for prototypes, tests, and seed scripts. Names, emails, addresses, phone numbers, dates, IDs and more — exportable to JSON, CSV, or SQL.

### 8. Env Generator — `/env`
Build `.env` / `.env.example` files from a structured form. Random secret generation (via Web Crypto), key naming validation, and one-click download.

### 9. Date & Time — `/datetime`
Convert between Unix timestamps (s/ms), ISO 8601, RFC 2822, and human-readable formats. Time-zone aware conversions, "now" snapshot, relative time helpers.

### 10. Regex Playground — `/regex`
Test regular expressions against sample text with live match highlighting, flags toggle (`g`, `i`, `m`, `s`, `u`, `y`), capture-group inspection, and replace preview.

---

## Design System

All styling flows through HSL semantic tokens defined in `src/index.css` and exposed as Tailwind classes via `tailwind.config.ts`.

**Rule:** never write raw colors (`text-white`, `bg-[#fff]`) in components. Use semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `bg-muted`, `border-border`, etc.) so light/dark themes and rebrands "just work."

Custom variants (gradients, shadows, glow effects) are also defined as CSS variables in `index.css` (e.g. `--gradient-primary`, `--shadow-elegant`).

UI primitives come from **shadcn/ui** in `src/components/ui/`. Compose, don't fork — extend via `class-variance-authority` variants.

---

## SEO / AEO / GEO

Toolzy is optimized for traditional search engines (SEO), answer engines (AEO — Google SGE, Bing Copilot), and generative engines (GEO — ChatGPT, Perplexity).

- **Per-page metadata** via `<ToolSEO />` (`src/components/ToolSEO.tsx`): title, description, keywords, canonical URL.
- **Structured data**: each tool emits **FAQPage** + **HowTo** JSON-LD blocks.
- **Sitemap**: `public/sitemap.xml` with `<lastmod>` and `<priority>`.
- **Robots**: `public/robots.txt` allows all and points to the sitemap.
- **Open Graph + Twitter cards** in `index.html`.
- **Web App Manifest** (`public/site.webmanifest`) — installable as a PWA.
- **Google Site Verification** meta tag baked into `index.html`.

When you add a new tool, **always** include a `<ToolSEO />` call at the top of the page with: `title`, `description`, `canonicalPath`, `keywords`, `faq` (Q/A pairs), and `howToSteps`.

---

## Testing

- **Unit tests:** [Vitest](https://vitest.dev) + Testing Library, jsdom environment. Configured in `vitest.config.ts`. Setup file: `src/test/setup.ts`. Example: `src/test/example.test.ts`.
  ```bash
  npm run test           # single run
  npm run test:watch     # watch mode
  ```
- **E2E:** [Playwright](https://playwright.dev) — `playwright.config.ts`, `playwright-fixture.ts`.

---

## Deployment

Toolzy is deployed via Lovable to https://toolzy.lovable.app. Because the app is fully static after `vite build`, it deploys cleanly to any static host:

- **Vercel** — zero-config (`vite` framework preset).
- **Netlify** — `npm run build`, publish `dist/`.
- **Cloudflare Pages**, **GitHub Pages**, **S3 + CloudFront**, etc.

Make sure to enable SPA fallback (redirect all unknown paths to `index.html`) so React Router routes resolve on direct visits.

---

## Contributing a New Tool

1. **Create the page**: `src/pages/MyTool.tsx`. Start with a `<ToolSEO />` block.
2. **Extract logic**: put pure functions / utilities under `src/components/<tool-name>/<tool>Utils.ts`. Keep components thin.
3. **Register the route** in `src/App.tsx`.
4. **Add to the sidebar** in `src/components/AppSidebar.tsx` (`{ title, url, icon }`).
5. **Update SEO**: add the URL to `public/sitemap.xml`.
6. **Use design tokens only** — no hardcoded colors.
7. **Test**: add a unit test under `src/test/` or alongside the utility.
8. **Document**: add an entry under [Tools — Full Catalog & Capabilities](#tools--full-catalog--capabilities).

---

## License

MIT — see `LICENSE` if present, otherwise add one.

## Credits

Built with [Lovable](https://lovable.dev), [shadcn/ui](https://ui.shadcn.com), [Radix UI](https://www.radix-ui.com), and [Lucide](https://lucide.dev) icons.
