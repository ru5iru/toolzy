/**
 * prerender-seo.mjs
 *
 * Post-build script that generates a static HTML file for every tool route.
 * Each file has the correct <title>, meta description, og:*, twitter:* and
 * canonical tags baked in so search crawlers see meaningful content without
 * waiting for JavaScript to hydrate.
 *
 * Usage: node scripts/prerender-seo.mjs
 * Run after `npm run build` (see deploy.yml).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist", import.meta.url).pathname;
const BASE = "https://devtools.rusiru.cc";
const SITE_NAME = "Toolzy";
const OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a8941552-9ffd-43fb-a460-b27723f2980b/id-preview-75720018--c01f4f33-6220-46a1-bfb7-420b0ce8af24.lovable.app-1774889779954.png";

// ---------------------------------------------------------------------------
// Route metadata — keep in sync with ToolSEO props in each page
// ---------------------------------------------------------------------------
const ROUTES = [
  {
    path: "/json",
    title: "JSON Formatter, Validator & Minifier  -  Online Tool",
    description:
      "Free online JSON formatter, validator, and minifier. Paste your JSON to format, beautify, or compress it instantly in your browser.",
  },
  {
    path: "/encode",
    title: "Encoding Hub  -  Base64, URL Encode & Data URL Converter",
    description:
      "Encode and decode Base64, URL-safe Base64, percent-encoded URLs, and Data URLs with auto-detect and file support. Nothing leaves your browser.",
  },
  {
    path: "/crypto",
    title: "Crypto Suite  -  Hash, UUID & Random Secret Generator",
    description:
      "Generate SHA-256/512 hashes with HMAC, create UUID v4/v5 tokens in bulk, and generate JWT secrets and AES keys — all via the native Web Crypto API, in your browser.",
  },
  {
    path: "/color",
    title: "Color Converter  -  HEX, RGB, HSL, HSV, CMYK Online Tool",
    description:
      "Convert colors between HEX, RGB, HSL, HSV, CMYK. Generate palettes, check WCAG contrast, create gradients, and extract colors from images. Free online tool.",
  },
  {
    path: "/jwt",
    title: "JWT Hub  -  Free Online JWT Decoder, Encoder & Verifier",
    description:
      "Decode and inspect JWT claims, encode and sign tokens with HS256/RS256, and verify signatures — all client-side, nothing leaves your browser.",
  },
  {
    path: "/diff",
    title: "API Response Diff Tool  -  Free Online JSON Comparison",
    description:
      "Compare two JSON API responses side-by-side with structural diff, ignore rules, and type change detection. Browser-only, nothing uploaded.",
  },
  {
    path: "/fake-data",
    title: "Fake Data Generator  -  JSON, CSV, SQL & YAML Exports",
    description:
      "Generate 1–1000 records locally with Faker v10 JSON templates, a visual builder, locales, reproducible seeds, and JSON, NDJSON, CSV, SQL or YAML exports.",
  },
  {
    path: "/env",
    title: "Environment File Generator  -  .env Builder & Differ",
    description:
      "Build .env configuration files with pre-built templates for Node.js, Laravel, Spring Boot, React, and Django. Compare two .env files with key-level diff.",
  },
  {
    path: "/datetime",
    title: "Date & Time Toolkit  -  Timestamps, Timezones & Cron",
    description:
      "Convert Unix timestamps to human dates, compare timezones, and build cron expressions with a visual cron generator. Free online date/time tools.",
  },
  {
    path: "/regex",
    title: "Regex Playground  -  Live Regex Tester with Highlights",
    description:
      "Live regex tester with real-time match highlighting, capture groups, and a library of common patterns. Test regular expressions online instantly.",
  },
  {
    path: "/image-metadata",
    title: "Image Metadata Viewer  -  EXIF, GPS & Privacy Inspector",
    description:
      "Inspect EXIF, GPS, camera details, timestamps, IPTC and XMP tags from JPEG, PNG and TIFF images in your browser. Export JSON or CSV. Nothing uploaded.",
  },
  {
    path: "/markdown",
    title: "Markdown Editor  -  Live GFM Preview in Your Browser",
    description:
      "Markdown editor with live preview, GitHub-flavored Markdown, local autosave, split view, slash commands, find/replace, and Markdown or HTML exports.",
  },
  {
    path: "/html-editor",
    title: "HTML WYSIWYG Editor  -  Visual Rich Text & Source Code",
    description:
      "Free browser-only rich-text HTML editor with instant source code, headings, lists, links, tables, local images, and HTML download.",
  },
  {
    path: "/text",
    title: "Text Utilities  -  Case Convert, Slug, Encode & More",
    description:
      "Convert case, slugify, count characters, deduplicate lines, encode/decode HTML entities and more. 20+ text operations, all in your browser, nothing uploaded.",
  },
  {
    path: "/document-signer",
    title: "Document Signer  -  Sign & Verify Digital Signatures",
    description:
      "Sign files and verify detached digital signatures in your browser. Generate RSA-PSS and ECDSA keys, export PEM and JWK. Nothing is uploaded.",
  },
  {
    path: "/certificate",
    title: "X.509 Certificate Inspector  -  Decode SSL Certs & CSRs",
    description:
      "Decode X.509 certificates and CSRs in your browser. Inspect subject, issuer, validity, SANs, key usage and fingerprints instantly. Nothing uploaded.",
  },
  {
    path: "/sql",
    title: "SQL Formatter  -  Beautify & Format SQL Queries Online",
    description:
      "Format, beautify and minify SQL queries for MySQL, PostgreSQL, SQLite, T-SQL, Oracle PL/SQL, BigQuery, Snowflake and more. Free, browser-only, nothing uploaded.",
  },
  {
    path: "/number-base",
    title: "Number Base Converter  -  Binary, Decimal, Hex, Octal",
    description:
      "Convert numbers between binary, octal, decimal and hex instantly. Includes bitwise AND, OR, XOR, NOT, shifts, and hex↔ASCII conversion. Browser-only.",
  },
  {
    path: "/cron",
    title: "Cron Expression Builder  -  Visual Cron Generator Online",
    description:
      "Build and validate cron expressions with an interactive visual editor. See a plain-English explanation and next run times instantly. Free, browser-only.",
  },
  {
    path: "/text-diff",
    title: "Text & Code Diff Tool  -  Free Online Diff Comparator",
    description:
      "Compare two texts or code snippets side-by-side or in unified view. Inline word-level highlights on changed lines. Free, browser-only, nothing uploaded.",
  },
  {
    path: "/yaml",
    title: "YAML JSON TOML Converter  -  Free Online Format Converter",
    description:
      "Convert between YAML, JSON, and TOML instantly. Paste any config format and convert it to the other. Free, browser-only, nothing uploaded.",
  },
  {
    path: "/chmod",
    title: "chmod Calculator  -  Linux File Permissions Converter",
    description:
      "Calculate Linux file permissions: convert between symbolic and octal notation, build chmod commands, and understand permission bits. Free, browser-only.",
  },
  {
    path: "/password",
    title: "Password Generator  -  Random Passwords & Passphrases",
    description:
      "Generate strong random passwords and passphrases in your browser. Configurable length, character sets, passphrase mode, and bulk generation. Nothing uploaded.",
  },
  {
    path: "/csv",
    title: "CSV Tool  -  Parse, Filter, Sort & Export Data Online",
    description:
      "Parse CSV, TSV, and delimited text in your browser. Preview data as a table, filter rows, sort columns, view column stats, and export as CSV or JSON.",
  },
  {
    path: "/curl",
    title: "curl to Code Converter  -  Python, JS, TypeScript, Go, PHP, Ruby",
    description:
      "Paste a curl command and instantly get equivalent code in Python, JavaScript, TypeScript, Go, PHP, or Ruby. Free, browser-only, nothing uploaded.",
  },
  {
    path: "/json-transform",
    title: "JSON Transformer  -  jq-style Filter & Transform Tool",
    description:
      "Apply jq-compatible filters to JSON: map, select, sort_by, group_by, to_entries, flatten and more. Live output, no server required.",
  },
];

// ---------------------------------------------------------------------------
// HTML injection helpers
// ---------------------------------------------------------------------------

/** Escape a string for safe use inside an HTML attribute value. */
function escAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function inject(template, route) {
  const { path, title, description } = route;
  const fullTitle = `${title} | ${SITE_NAME}`;
  const url = `${BASE}${path}`;

  let html = template;

  // <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escAttr(fullTitle)}</title>`);

  // canonical
  html = html.replace(
    /<link rel="canonical" href="[^"]*"[^>]*>/,
    `<link rel="canonical" href="${escAttr(url)}" />`
  );

  // meta description
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escAttr(description)}">`
  );

  // og:title
  html = html.replace(
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${escAttr(title)}">`
  );

  // og:description
  html = html.replace(
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${escAttr(description)}">`
  );

  // og:url
  html = html.replace(
    /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${escAttr(url)}">`
  );

  // twitter:title
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*">/,
    `<meta name="twitter:title" content="${escAttr(title)}">`
  );

  // twitter:description
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*">/,
    `<meta name="twitter:description" content="${escAttr(description)}">`
  );

  return html;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const template = readFileSync(join(DIST, "index.html"), "utf8");
let generated = 0;

for (const route of ROUTES) {
  const dir = join(DIST, route.path.slice(1)); // strip leading /
  mkdirSync(dir, { recursive: true });
  const html = inject(template, route);
  writeFileSync(join(dir, "index.html"), html, "utf8");
  generated++;
  console.log(`  ✓ ${route.path}`);
}

console.log(`\nPrerendered ${generated} routes into dist/`);
