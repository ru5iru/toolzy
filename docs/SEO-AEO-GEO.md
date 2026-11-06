# Toolzy SEO / AEO / GEO guide

> Read this alongside `DESIGN.md` §11 ("Adding or changing a tool") every time you add a new tool or make a significant capability change.

Toolzy runs at **https://devtools.rusiru.cc**. The Lovable preview (toolzy.lovable.app) is for staging only — all canonical URLs, structured data, sitemaps and AI-discovery files must point at the production domain.

---

## 1. What's already in place

| Concern | File |
|---|---|
| Global site-level `<title>`, `<meta>`, OG, Twitter, structured data | `index.html` |
| Per-page title, canonical, keywords, OG, Twitter + all structured data | `src/components/ToolSEO.tsx` |
| `react-helmet-async` provider | `src/App.tsx` (`<HelmetProvider>`) |
| Sitemap | `public/sitemap.xml` |
| Crawl rules + AI-crawler allowlist | `public/robots.txt` |
| AI/LLM tool index (long form) | `public/llms.txt` |
| AI/LLM tool index (short form, for discovery) | `public/ai.txt` |
| Web app manifest | `public/site.webmanifest` |

---

## 2. The `ToolSEO` component

Every tool page **must** render `<ToolSEO>` before any visible JSX.

```tsx
import { ToolSEO } from "@/components/ToolSEO";

<ToolSEO
  title="Tool Display Name — Action Phrase"
  description="One or two sentences. Lead with the action ('Convert', 'Inspect', 'Generate'). Mention the most searched keywords naturally. End with 'Nothing is uploaded.' or 'Runs in your browser.'"
  canonicalPath="/route"
  keywords={["primary keyword", "variant", "use-case phrase"]}
  faq={[
    { question: "Is my data uploaded?", answer: "No. All processing runs in your browser — nothing is sent to any server." },
    // 2–5 more Qs that mirror what people type into search and ask AI assistants
  ]}
  howToSteps={[
    "Step 1 — what to paste or upload",
    "Step 2 — what to click or configure",
    "Step 3 — how to copy or download the result",
  ]}
/>
```

### Props

| Prop | Required | Notes |
|---|---|---|
| `title` | ✓ | Without the ` — Free Online Tool \| Toolzy` suffix — it's added automatically for tool pages. Home page passes its full title and `isApp={false}`. |
| `description` | ✓ | 140–160 chars. Used for `<meta description>`, og:description, and Twitter. |
| `canonicalPath` | ✓ | Absolute path, e.g. `/json`. Must match the `<loc>` in `sitemap.xml`. |
| `keywords` | recommended | 4–8 strings. Use the terms people type into Google and AI chat. |
| `faq` | recommended | 3–6 Q&A pairs → generates `FAQPage` schema. Eligible for Google FAQ rich results and AI answer extraction. |
| `howToSteps` | recommended | 3–5 steps → generates `HowTo` schema. Eligible for how-to rich results and step-by-step AI answers. |
| `isApp` | rarely needed | Defaults `true`. Pass `false` on the home page (it is a `WebSite`, not a `WebApplication`). |
| `ogImage` | optional | Absolute URL of a 1200×630 image. Falls back to the shared site OG image. |

### What `ToolSEO` generates automatically

- `<title>` tag and `<meta name="description">`
- `<meta name="keywords">` and `<link rel="canonical">`
- Open Graph: `og:title`, `og:description`, `og:url`, `og:image` (+dimensions), `og:type`, `og:site_name`
- Twitter Card: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- `WebApplication` schema (skipped when `isApp={false}`)
- `BreadcrumbList` schema → Home → Tool (skipped on the home page)
- `FAQPage` schema (when `faq` is provided)
- `HowTo` schema (when `howToSteps` is provided)

---

## 3. Checklist when adding a new tool

### 3a. `ToolSEO` on the page

Add `<ToolSEO>` with at minimum `title`, `description`, `canonicalPath`, and `keywords`. Aim to also include `faq` (3+ Qs) and `howToSteps` (3+ steps).

### 3b. `public/sitemap.xml`

Add a `<url>` block in the correct category comment section. Use today's date as `lastmod`. Also update `lastmod` on the home URL (`/`) because a new tile appeared there.

```xml
<url>
  <loc>https://devtools.rusiru.cc/new-tool</loc>
  <lastmod>YYYY-MM-DD</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
```

Priority guide: `1.0` = home, `0.9` = core/high-traffic tools, `0.8` = standard tools, `0.7` = niche tools.

### 3c. `public/llms.txt`

Add a new `## Tool Name` section. Keep it in the same order as the sidebar. Format:

```
## Tool Name

URL: https://devtools.rusiru.cc/route
Category: Category Name

One-paragraph description: what it processes (input), what it produces (output),
key limits, and the privacy note. No marketing tone.

Capabilities:
- Short, specific bullet per feature (e.g. "Export: JSON, CSV, SQL INSERT, YAML" not "Export formats")

Example queries this tool answers:
- "Specific natural-language query a developer might type to an AI assistant"
- "Another concrete query"
```

### 3d. `public/ai.txt`

Add one `Tool: Name — URL` line in the tool index at the bottom of the file:

```
Tool: New Tool Name — https://devtools.rusiru.cc/new-tool
```

### 3e. `index.html`

1. If the tool is prominent, add it to the `<meta name="description">` and `og:description` tags.
2. Add a one-line entry to the `featureList` array inside the `SoftwareApplication` structured-data block.
3. Update the tool count in both description tags and the `SoftwareApplication` description field.

### 3f. `src/pages/Index.tsx`

1. Add the tile to the tools grid.
2. Update the FAQ answer about available tools to reflect the new count and mention the new tool.

---

## 4. Checklist when updating an existing tool's capabilities

1. **`ToolSEO` on that page** — update `description`, add new keywords, add new FAQ items or HowTo steps that reflect the new capability.
2. **`public/llms.txt`** — add the new capability to the `Capabilities:` list; add example queries if relevant.
3. **`public/sitemap.xml`** — update `lastmod` on the tool's URL to today's date.
4. **`index.html`** — update the `featureList` entry for that tool if the capability is significant.

---

## 5. Writing good FAQ questions (AEO)

FAQ schema questions become candidates for Google's FAQ rich results and for AI engines that extract answers from structured data. Write them the way a person would type a query:

| Type | Example |
|---|---|
| Privacy (required on every tool) | "Is my [data/image/key] uploaded?" |
| What it does | "What does [X] do?" / "Can I [do X]?" |
| How to | "How do I [convert/decode/generate X]?" |
| Limitations | "Which formats are supported?" / "What is the file size limit?" |
| Comparison | "What is the difference between [A] and [B]?" |

- Answer the question directly in the first sentence.
- Keep answers under ~200 words.
- Avoid marketing language ("powerful", "seamless").

---

## 6. Writing good llms.txt entries (GEO)

- **Description paragraph:** describe inputs, outputs, privacy, and limits precisely. Not marketing copy.
- **Capabilities list:** one bullet per distinct feature. Be specific: not "Export formats" but "Export: JSON, CSV, SQL INSERT, YAML".
- **Example queries:** 3–8 natural-language queries a developer would type into an AI assistant. Use specific, concrete phrasing: not "hash text" but "Generate the SHA-256 hash of this text".

---

## 7. Title conventions

- **Tool pages:** `title` prop = `"Tool Name — Action Phrase"` (e.g. `"Image Metadata Viewer — EXIF, GPS & Privacy Inspector"`). Keep it ≤60 chars before the auto-suffix.
- **Home page:** `title` prop = `"Toolzy — Free Online Developer Tools"` with `isApp={false}`.

---

## 8. Domain rule

**All canonical URLs, sitemap entries, structured-data `url` fields, llms.txt URLs, ai.txt URLs, and robots.txt Sitemap line must use `https://devtools.rusiru.cc`.**

The `BASE_URL` constant in `src/components/ToolSEO.tsx` is the single source of truth for structured data and canonical tags. If the domain ever changes, update it there and re-run the `sed` replacement across the static files.

---

## 9. Verification checklist

Before committing:

- [ ] `npx tsc --noEmit` — no TypeScript errors
- [ ] `npm run build` — build succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Check `<title>` in the browser tab and OG tags with [opengraph.xyz](https://www.opengraph.xyz)
- [ ] Validate FAQ and HowTo schema: [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Confirm the new URL appears in `public/sitemap.xml`
- [ ] Confirm the new tool appears in `public/llms.txt` with an `Example queries` section
- [ ] Confirm the new tool appears in `public/ai.txt`
- [ ] Submit the updated sitemap in [Google Search Console](https://search.google.com/search-console) after deploy

---

## 10. Google Search Console setup (one-time)

1. Go to [Google Search Console](https://search.google.com/search-console) → Add property → `https://devtools.rusiru.cc`.
2. Verify ownership via the HTML meta tag method: Google gives you a `<meta name="google-site-verification" content="...">` tag. Add it to `index.html` where the placeholder comment is.
3. Submit `https://devtools.rusiru.cc/sitemap.xml` under Sitemaps.
4. Submit `https://devtools.rusiru.cc/robots.txt` for review.
