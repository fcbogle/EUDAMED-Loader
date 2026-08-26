# Architecture Position

## Current Implementation

The application is no longer just a workbook review and XML preview scaffold. It is now an operational EUDAMED preparation and testing application with active SQLite-backed state.

Current implemented flow:

`Workbook evidence -> canonical interpretation -> canonical validation -> operation assessment -> XML generation -> Playground success capture -> SQLite operational state`

What exists now:

- workbook import and profiling
- SQLite-backed `Submission Data` read models
- SQLite-backed canonical validation projection
- operation-readiness assessment before XML generation
- single `POST` workspace
- single `Patch XML` workspace
- `Market Info` workspace
- `Bulk Basic UDI-DI POST`
- `Bulk Device UDI-DI POST`
- `Bulk PATCH`
- local XSD validation
- success-XML upload for successful Playground outcomes

What does not exist yet:

- direct EUDAMED submission
- AS4 / eDelivery / M2M transport
- receipt polling and automated reconciliation
- final production-grade submission history and audit model

## Architectural Direction

The application is moving toward a cleaner split between:

1. `Preparation`
2. `Operational Testing State`
3. `Submission`
4. `Delivery`
5. `History`

Today, the implemented codebase spans `Preparation` and `Operational Testing State`, with a controlled XML generation layer that will later mature into a fuller submission layer.

## Current Position

The current architecture position is:

- SQLite is an active operational store, not a future-only idea
- operation availability is assessed before XML generation
- parent Basic UDI-DI `POST`, child Device UDI-DI `POST`, and `PATCH` remain separate workflows
- accepted-state lineage controls `PATCH` generation
- Playground-confirmed outcomes are persisted and reused to drive the next available operation
- the older `Post + Patch` and `Single XML` framing is no longer the active user-facing architecture

## Current Constraints

- EUDAMED Playground availability is external and can interrupt testing workflows
- workbook data alone does not define accepted EUDAMED state
- some lineage logic still depends on alias handling and transitional matching rules
- the UI and backend must stay aligned on family/variant alias behavior and remaining-operation counts

## Near-Term Direction

- continue extracting operation-specific UI logic out of `App.tsx`
- apply the same workspace pattern across single and bulk operations
- strengthen SQLite identity and accepted-state linkage
- improve bulk performance and operator feedback
- keep documentation aligned with the implemented POST / PATCH / Bulk architecture
