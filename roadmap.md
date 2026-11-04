# Toolzy Improvement Roadmap

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
- [ ] 4. v2: encrypted private-key export (decide PKCS#8 library vs. Toolzy envelope), IndexedDB storage of non-extractable keys, Ed25519 (feature-detected), RSA-4096, batch sign/verify.
- [ ] 5. Companions: Secrets generator tab in Crypto Suite, PS256/JWK in JWT Hub, X.509 certificate inspector.
- [ ] 6. Later: embedded PDF signatures (CMS/PAdES) and X.509 trust chains, only if there is demand.
