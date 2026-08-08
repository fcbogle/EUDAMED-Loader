# Architecture Definition Document Draft

## Purpose Of This Draft

This draft assembles the sections of the Architecture Definition Document that can be populated from the current project documentation and implemented design. It is intended as source material for the formal ADD, not as the final controlled architecture document.

## Scope

This project is an analysis-first, schema-aware preparation application for EUDAMED regulatory data. The current scope is limited to `MDR` device data held across multiple Excel workbooks, authoritative Basic UDI reference data, local EUDAMED XSD/schema files, canonical interpretation, validation, and controlled XML preview/download workflows.

Current in-scope capabilities include:

- source workbook inventory and profiling
- reference-data-assisted product variant linkage
- canonical mapping review
- canonical validation and XML readiness analysis
- XML preview, local XSD validation, and download
- controlled baseline `POST` / `PATCH` and scenario-derived later `PATCH` review

Current out-of-scope capabilities include:

- live EUDAMED submission
- M2M / AS4 / eDelivery transport
- submission history and response management
- database-backed persistence
- operational audit history beyond current in-memory review workflows

## Business Context

The business currently relies on multiple Excel workbooks as source evidence for device and regulatory data. These workbooks vary in structure, completeness, and consistency. The authoritative variant reference source is `BasicUDIs.xlsx`, while a legacy tracekey workbook still contributes supplemental SRN enrichment.

The immediate business need is not direct live submission. The current need is to create a controlled digital preparation layer that can:

- understand workbook structure and content
- expose data quality and readiness issues early
- interpret workbook content as stable regulatory meaning
- align source data to EUDAMED-oriented schema and message expectations
- support safe XML review and packaging before later submission support is introduced

This work is intended to reduce manual interpretation risk and build a path toward repeatable EUDAMED preparation rather than a one-off spreadsheet transformation utility.

## Architecture Vision Summary

The target direction is a schema-aware regulatory data preparation platform with clear separation between:

- workbook/source parsing
- source profiling
- canonical regulatory modeling
- mapping definitions
- business-rule-based validation
- XML generation and validation
- future submission history and audit
- future M2M / transport integration

The current implemented flow is:

`Excel review -> Canonical review -> Canonical validation -> XML preview/download`

The near-term intent is to mature the preparation layer so that XML generation is built on validated, traceable, canonicalized data. The longer-term intent is to support manual submission preparation first, then later extend toward automated integration.

## Architecture Principles

The current documentation supports these working principles:

1. Do not build a one-off Excel-to-XML script.
2. Keep parsing, canonical interpretation, validation, and XML generation separate.
3. Use source workbooks as evidence, not as the target operating model.
4. Keep XML profiles explicit by scenario.
5. Prefer conservative review and testing workflows over premature automation.
6. Delay delivery and integration logic until preparation and submission objects are properly defined.
7. Keep documentation aligned with the implemented workflow.

## Stakeholders, Actors, Roles And Responsibilities

### Business Sponsor

Owns the business case and expected outcomes. Approves scope, priorities, and phased delivery, and ensures the solution addresses the business need for EUDAMED preparation capability.

### Regulatory Affairs Lead

Owns regulatory correctness. Confirms source-data interpretation, canonical expectations, mapping decisions, validation expectations, and whether XML patterns are suitable for testing or operational use.

### Regulatory Operations User

Uses the preparation workflow. Reviews validation findings, baseline `POST` / `PATCH` output, scenario `PATCH` changes, and prepares XML packages for later manual submission activity.

### Product Data / Source Data Owner

Owns source-data meaning. Explains workbook fields, resolves missing or inconsistent values, and confirms intended product, market, storage, and warning semantics.

### Solution Architect

Owns the target architecture. Preserves separation of concerns, manages long-term platform direction, and prevents the solution from collapsing into a fragile point utility.

### Engineering

Builds and maintains the backend and frontend services that profile workbooks, interpret canonical data, validate readiness, and render XML review workflows.

### Quality / Compliance

Reviews traceability, control points, and evidence expectations to ensure the platform supports regulated preparation practices.

### IT / Platform / Integration Owner

Supports deployment direction, supportability, and future persistence and integration concerns.

## Baseline Business Capability

Before this project matures, business capability remains spreadsheet-led and heavily dependent on manual interpretation. The business can store and review device data in Excel and manually inspect schema assets, but it cannot yet consistently prepare EUDAMED submission data through a governed digital workflow.

Baseline limitations include:

- fragmented workbook structure and naming
- limited traceability from source values to regulatory meaning
- limited early visibility of completeness and consistency issues
- no governed platform workflow for controlled XML package preparation
- no structured handling of later `PATCH` change scenarios
- no submission history, manual upload tracking, or automated integration

## Target Business Capability

The intended business capability is a platform-led EUDAMED preparation workflow that can:

- profile and interpret workbook data consistently
- expose quality and readiness issues before XML generation
- map workbook fields into a stable canonical regulatory model
- validate records against EUDAMED-oriented expectations
- generate and review baseline `POST` / `PATCH` XML in a controlled manner
- derive approved later `PATCH` scenarios from a reviewed baseline chain
- prepare XML packages safely for later manual upload activity
- provide the foundation for future submission tracking and automated delivery

## Baseline Application Architecture

The current application is a Python/React web application consisting of:

- a FastAPI backend
- a React/TypeScript/Vite frontend
- local configuration for normalization and canonical mapping review artifacts
- local workbook, reference, and schema data sources

Current major application capabilities are grouped into:

- workbook profiling
- canonical review
- canonical validation
- XML generation / review

The XML workspace is currently split between:

- `EUDAMED Testing`
- `EUDAMED Generation`

Within `EUDAMED Testing`, the current modes are:

- `Post + Patch`
- `Patch XML`
- `Market Info`
- `Single XML`
- `Batch XML`

The most mature controlled testing path is now:

- select one XML-ready parent `POST` record
- generate and review baseline `Post + Patch`
- derive approved scenario `PATCH` drafts from that reviewed first child `PATCH`

## Target Application Architecture

The target application architecture is evolving toward a clearer separation of preparation, submission, delivery, and history concerns.

Target application responsibilities are expected to include:

- source ingestion and profiling
- canonical interpretation and mapping
- validation and rule execution
- XML package generation and schema validation
- manual submission support
- submission history and audit
- later transport integration

The current codebase is primarily in the preparation layer, with an initial XML assembly slice that should later be formalized into a distinct submission layer.

## Baseline Data Architecture

The current data architecture is evidence-driven and file-backed.

Primary data sources:

- source Excel workbooks under `data/source_excel/`
- authoritative Basic UDI reference workbook under `data/basic_udi_reference/BasicUDIs.xlsx`
- legacy SRN fallback workbook
- local EUDAMED schema pack under `data/schemas/`

Current logical interpretation layers:

- source workbook rows
- variant linkage to authoritative reference data
- canonical mapping review
- canonical validation / XML-facing contract
- typed XML projection

Current core domain concepts documented in the canonical layer include:

- `Manufacturer`
- `BasicDevice`
- `DeviceRecord`
- `MarketAvailability`
- `StorageCondition`
- `CriticalWarning`

Known current limitation:

- canonical and XML-facing field names are close but not yet perfectly normalized, with some alias drift between review, validation, and XML layers

## Target Data Architecture

The target data architecture should formalize a stable canonical regulatory model and isolate it from workbook-specific field naming. It should support:

- source-to-canonical mapping definitions
- normalized business-rule evaluation
- explicit schema-facing transformation
- later persistence of submission artifacts and state

Near-term target direction is to reduce naming drift between canonical models and XML-facing paths while keeping XML profile logic explicit by scenario.

## Baseline Technology Architecture

Current technology stack:

- Python 3.11
- FastAPI
- Pydantic
- React
- TypeScript
- Vite
- `openpyxl` for Excel handling
- `lxml` for XML/XSD handling
- local file-backed configuration and schema assets

Current deployment position:

- the application is not yet deployed
- frontend target hosting is `Azure Static Web Apps`
- backend target hosting still requires confirmation

## Target Technology Architecture

The target technology architecture remains modular. The backend is expected to remain Python-based, while the frontend remains React/TypeScript-based and is intended to be hosted on `Azure Static Web Apps`. The target architecture is expected to add:

- persistence
- explicit submission-domain storage
- operational workflow state
- later delivery/integration adapters

Detailed runtime topology, security architecture, and operational support design still require further input.

## Integration And External Interface Architecture

Current external interface focus is schema and message alignment, not live submission.

Implemented XML service profiles include:

- `DEVICE.POST`
- `UDI_DI.PATCH`
- `MARKET_INFO.PUT`

Current XML behavior includes:

- baseline `POST`
- equivalent first child `PATCH` with `e:version = 2`
- scenario-derived later `PATCH` from that reviewed baseline
- local XSD validation against the bundled schema set

Current `Patch XML` control model includes:

- exact parent-record lineage through `catalogue_number`
- reviewed baseline pair gating
- explicit user-entered later `PATCH` version
- scenario-specific field changes only

Future integration direction includes:

- manual upload preparation and tracking
- later AS4 / eDelivery / M2M integration

## Constraints And Assumptions

Documented constraints include:

- `MDR` only in current scope
- accessories workbook visible but excluded from active mapping
- `BasicUDIs.xlsx` is authoritative for variant linkage
- legacy tracekey workbook still supplies SRN fallback data
- current XML work is limited to preview, validation, and download
- no live EUDAMED submission is implemented

Documented assumptions include:

- local schema validity is necessary but not sufficient for operational acceptance
- scenario `PATCH` drafting should remain conservative and controlled
- the solution should be extensible toward later submission support

## Risks And Issues

Current documented risks and issues include:

- workbook inconsistency and naming variation
- canonical-to-XML field-name drift
- lack of persistence for status and review state
- incomplete scenario coverage
- no manual upload state tracking yet
- no database-backed history or audit model yet
- future operational ambiguity if `Single XML` and generic `Batch XML` are not redesigned with clearer intent

## Transition Architecture And Roadmap

Current phased direction remains:

1. data and schema discovery
2. canonical model proposal
3. mapping and validation
4. XML package generation
5. manual submission support
6. future M2M transport

Near-term roadmap items already documented include:

- reduce field-name drift
- harden workbook parsing
- keep XML profiles explicit by scenario
- define submission-domain models
- add manual upload workflow support after XML review
- add persistence and later delivery adapters

## Architecture Decisions And Rationale

Current major decisions reflected in the documentation include:

- the project is a preparation and review application first, not a live submission platform
- workbook parsing, canonical interpretation, validation, and XML generation remain separate
- XML testing and accepted generation are separated in the UI
- later scenario `PATCH` drafts must derive from a reviewed baseline `Post + Patch` chain
- scenario `PATCH` generation must target the exact selected parent record
- `Patch XML` should not be a freeform XML editor

## Dependencies

Known dependencies include:

- source Excel workbook quality and consistency
- authoritative Basic UDI reference workbook
- local EUDAMED schema pack
- continued regulatory clarification on scenario suitability and later operational acceptance

## Open Questions

Current open questions include:

- whether accepted scenario `PATCH` patterns should later appear in `EUDAMED Generation`
- how baseline review and scenario acceptance state should be persisted
- whether `Single XML` remains a long-term mode
- how `POST Batch` and scenario-driven `PATCH Batch` should be introduced
- what audit, retention, and security controls will be required in later phases

## Sections Still Requiring Additional Input

The following ADD areas are only partially supported by current documentation and require further stakeholder input:

- security architecture
- audit and retention architecture
- detailed deployment/runtime topology
- operational support model
- future integration architecture in implementation detail
