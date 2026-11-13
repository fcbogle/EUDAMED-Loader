# Software Engineering Patterns

Reviewed 1 November 2026 against the current implementation.

## Current patterns

- Layered backend with separate routers, parsing, canonical, assessment, generation and persistence services.
- Canonical interpretation between source workbooks and XML projection.
- Configured normalization and environment-specific actors/schema/storage.
- Retained source copies, hash-bound workbook/audit evidence and versioned reviews.
- Bounded XML generation, independent accepted-state lineage and exact-package review.
- SQLite transactions, verified pre-import backups and isolated synthetic database tests.

Source review severity is defined in the Dev import review policy; that is
separate from XML message eligibility and XSD validation. The new Dev flow reuses
existing preparation and persistence services instead of creating another database.

## Contract checks and remaining work

Tests check that emitted canonical validation paths belong to the declared model
vocabulary and are unique. The old examples of type/device_type naming drift
must not be presented as current failures. Canonical, validation and XML models
still have distinct responsibilities; remaining aliases, text-based lineage paths
and larger service/UI modules need targeted review rather than a blanket claim
that field naming is the single unfinished architecture task.

Formal audit retention, access controls, persistent cloud storage and transport
integration remain separate work. Refer to [Architecture Position](architecture-position.md)
and [Roadmap](roadmap.md) for scope; no M2M implementation is implied.
