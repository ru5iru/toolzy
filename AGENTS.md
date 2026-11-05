# Architecture rules

- Extend tools through the existing lazy React Router routes, searchable homepage list, sidebar, and ToolSEO; keep the shared application shell intact.
- Image metadata inspection uses a disposable browser worker and reusable pure normalization/export functions, so parsing is cancellable and independently testable.
- Document Signer keeps crypto in pure modules under `src/components/document-signer` and `src/lib/crypto` (shared with JWT Hub), re-imports keys as non-extractable `CryptoKey`s per operation, holds keys in memory by default (device storage is opt-in and non-extractable only, and IndexedDB is not opened or created before that), and runs files of 5 MiB or more in a disposable cancellable worker.
- Fake Data uses pure typed template/builder/export modules with allowlisted Faker dispatch and lazy public locale imports; batches above 100 use a disposable cancellable worker to keep generation local and responsive.