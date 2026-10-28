# Architecture rules

- Extend tools through the existing lazy React Router routes, searchable homepage list, sidebar, and ToolSEO; keep the shared application shell intact.
- Image metadata inspection uses a disposable browser worker and reusable pure normalization/export functions, so parsing is cancellable and independently testable.
- Fake Data uses pure typed template/builder/export modules with allowlisted Faker dispatch and lazy public locale imports; batches above 100 use a disposable cancellable worker to keep generation local and responsive.