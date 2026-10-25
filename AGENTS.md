# Architecture rules

- Extend tools through the existing lazy React Router routes, searchable homepage list, sidebar, and ToolSEO; keep the shared application shell intact.
- Image metadata inspection uses a disposable browser worker and reusable pure normalization/export functions, so parsing is cancellable and independently testable.