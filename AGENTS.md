# Architecture rules

- Markdown Editor uses CodeMirror extensions and pure document helpers, with sanitized React Markdown rendering and blocked remote images; local autosave and exports never transmit content.
- Only the Markdown route opts into a bounded full-height shared shell and locally scoped theme overrides, keeping other tools' layout and theme behavior unchanged.

- Extend tools through the existing lazy React Router routes, searchable homepage list, sidebar, and ToolSEO; keep the shared application shell intact.
- Image metadata inspection uses a disposable browser worker and reusable pure normalization/export functions, so parsing is cancellable and independently testable.
- Image metadata search uses a pure shared filter with per-category match counts; worker startup and processing deadlines are separate so loading time does not consume the processing budget.
- Fake Data uses pure typed template/builder/export modules with allowlisted Faker dispatch and lazy public locale imports; batches above 100 use a disposable cancellable worker to keep generation local and responsive.
- Image metadata removal is lossless segment/chunk dropping (JPEG, PNG) in a disposable worker, followed by structural + exifr re-parse verification; download is only allowed when verification passes, because re-encoding or unverified claims would risk integrity and privacy.
