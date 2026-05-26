# Toolzy — Developer Tools Suite

Toolzy is a fast, privacy-first collection of everyday developer utilities that run **entirely in the browser**. No backend, no tracking, no data ever leaves your machine. Built as a single-page React application optimized for performance, SEO/AEO/GEO discoverability, and a keyboard-friendly developer UX.

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
│   │   ├── uuid/              # UUID v1/v3/v4/v5 helpers
│   │   ├── color/             # Color parsing, conversion, palettes, WCAG
│   │   ├── json-formatter/    # JSON tree, stats, schema, privacy badge
│   │   ├── jwt-decoder/       # Decode/verify/score/compare JWTs
│   │   ├── jwt-encoder/       # Build & sign JWTs
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

### 2. Base64 — `/base64`
Production-grade Base64 encoder/decoder with smart detection.

- **Encode / Decode** for text and files (drag-and-drop or file picker).
- **Auto-detect mode**: input scanned and routed to encode or decode automatically.
- **UTF-8 safe**: uses `TextEncoder` / `TextDecoder`, not raw `atob` / `btoa`.
- **Decoded content detection**: JSON → pretty preview; image / PDF → inline data-URL preview.
- **Resizable input/output panels**.
- **Real-time processing** with 300–500ms debounce.
- **Copy**, **Download**, **Clear**, **Swap** actions.
- **Data URL builder** with MIME selection.

### 3. URL Encode / Decode — `/url-encode`
Advanced URL encoding playground for API and web developers.

- **Four encoding modes**: `encodeURIComponent`, `encodeURI`, `form` (`x-www-form-urlencoded`), and **RFC 3986** strict.
- **Auto-detect** double or partial encoding.
- **Query-string parser**: edit URL params in a table view, add/remove rows, rebuild URL.
- **Batch mode**: encode/decode many lines at once (Text / JSON / CSV output).
- **Character-by-character breakdown**: Unicode code points + byte sequence.
- **Security scanner**: highlights XSS / SQL-injection patterns in the input.
- **Visual diff** between original and encoded outputs.
- **Shareable state**: input is persisted to the URL for easy linking.
- **Keyboard shortcuts** (`Ctrl/Cmd + Enter` to run).
- **Local history** with quick restore.

### 4. UUID Generator — `/uuid`
Generate, validate, and decode UUIDs of every common version.

- **Versions supported**: v1 (timestamp), v3 (MD5 namespace), v4 (random — `crypto.getRandomValues`), v5 (SHA-1 namespace).
- **Bulk generation**: up to **10,000** UUIDs in one go.
- **Formatting toggles**: uppercase, no hyphens, `{braces}`, `urn:uuid:` prefix.
- **Validator**: detect version, variant, and well-formedness.
- **v1 decoder**: extract embedded timestamp + clock sequence + node.
- **Export**: CSV, JSON, SQL `INSERT`, plain TXT.
- **Code snippets**: ready-to-paste generators in JavaScript, Python, Go, and SQL.
- **History log** stored in `localStorage`.

### 5. Color Converter — `/color`
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

### 6. JWT Decoder — `/jwt`
Decode, inspect, and audit JSON Web Tokens.

- **Three-section view**: Header, Payload, Signature with syntax highlighting.
- **Claims validator**: checks `exp`, `nbf`, `iat`, `iss`, `aud`, `sub`.
- **Signature verifier**: HS256/384/512 (secret) and RS256/ES256 (public key / JWK).
- **Security score card**: flags weak algos (`none`, HS256 with short secret), missing claims, long expirations.
- **Token comparison** side-by-side.
- **History** of recently decoded tokens (`localStorage`).
- **Code examples** in multiple languages for verifying the token server-side.

### 7. JWT Encoder — `/jwt-encoder`
Build and sign JWTs in the browser.

- **Algorithm picker**: HS256/384/512 via Web Crypto `HMAC`; RS/ES via imported keys.
- **Custom header & payload** editors with validation.
- **Quick claim helpers** for `exp`, `iat`, `nbf`, `iss`, `aud`, `sub`, `jti`.
- **Live token preview** updated on every keystroke.
- **Copy / Download** signed token.

### 8. API Response Diff — `/diff`
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

### 9. Fake Data Generator — `/fake-data`
Generate realistic mock data for prototypes, tests, and seed scripts. Names, emails, addresses, phone numbers, dates, IDs and more — exportable to JSON, CSV, or SQL.

### 10. Env Generator — `/env`
Build `.env` / `.env.example` files from a structured form. Random secret generation (via Web Crypto), key naming validation, and one-click download.

### 11. Hash Generator — `/hash`
SHA-1, SHA-256, SHA-384, SHA-512 hashes computed via the native **Web Crypto API** (`crypto.subtle.digest`).

- Multi-algorithm output in a single click.
- Per-hash copy buttons.
- Note: MD5 and bcrypt are intentionally **not** supported — MD5 isn't in Web Crypto and is cryptographically broken; bcrypt requires a server.

### 12. Date & Time — `/datetime`
Convert between Unix timestamps (s/ms), ISO 8601, RFC 2822, and human-readable formats. Time-zone aware conversions, "now" snapshot, relative time helpers.

### 13. Regex Playground — `/regex`
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
