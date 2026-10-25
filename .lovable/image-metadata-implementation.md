# Image Metadata Viewer implementation plan

1. Extend existing lazy routes, sidebar, searchable homepage, and SEO at `/image-metadata`; retain the current shell and semantic styling.
2. Use exifr in a cancellable worker with signature validation and bounded file sizes. Normalize detected tags into searchable categories and derive evidence-based privacy findings.
3. Add local preview, picker/drop zone, status/errors, value and GPS copying, and escaped JSON/CSV exports. Release resources on switching/reset/unmount.
4. Cover parser, normalization, exports, privacy, and lifecycle with synthetic tests; verify real browser uploads and existing navigation.
5. Document supported formats and defer clean copies rather than risk animation, profiles, orientation, or misleading removal claims.