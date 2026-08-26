# Architecture Definition Document Draft

## Purpose Of This Draft

This draft restates the architecture around the application as it exists now, not as it existed during the earlier workbook-analysis phase. It is intended to be used as source material for the formal Architecture Definition Document and to keep the architecture narrative aligned with the implemented codebase.

## Document Status

This is a working architecture draft based on the codebase, current UI workspaces, current SQLite persistence, and the documented direction in [session-handoff.md](/Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/docs/session-handoff.md).

It reflects the state of the application as of August 24, 2026.

## Scope

The application is a schema-aware EUDAMED preparation and testing platform for MDR device data. It no longer stops at workbook review and XML preview alone. It now includes:

- workbook ingestion and profiling
- canonical interpretation and validation
- SQLite-backed operational state
- single-device XML workspaces
- bulk XML workspaces
- local XSD validation
- manual EUDAMED Playground testing support
- success-XML upload and persistence of confirmed outcomes

Current in-scope XML/testing capabilities are:

- `POST`
- `Patch XML`
- `Market Info`
- `Bulk Basic UDI-DI POST`
- `Bulk Device UDI-DI POST`
- `Bulk PATCH`

Current out-of-scope capabilities remain:

- direct EUDAMED submission
- AS4 / eDelivery / M2M transport
- automated receipt polling
- production reconciliation workflows
- final production-grade submission history and audit controls

## Business Context

The business uses multiple source Excel workbooks to hold MDR device data. Those workbooks are incomplete as an operating model for EUDAMED because they do not by themselves provide:

- stable operational identity
- reliable registration lineage
- explicit accepted-state tracking
- controlled XML generation paths
- operational feedback from Playground testing

The application therefore acts as a preparation and testing layer between workbook evidence and eventual regulatory submission workflows.

The immediate business objective is controlled XML generation and controlled recording of successful EUDAMED Playground outcomes. This is especially important for:

- separating parent Basic UDI-DI registration from child Device UDI-DI registration
- keeping PATCH generation anchored to the latest accepted per-device state
- making bulk workflows operationally accurate rather than generic batch exports

## Architecture Vision Summary

The target architecture is a regulatory preparation platform with explicit separation between:

- source evidence
- canonical regulatory interpretation
- readiness validation
- XML generation
- operational testing state
- accepted-state lineage
- future submission transport

The current implemented architecture has already moved materially toward that target. The application now operates as:

`Workbook evidence -> canonical interpretation -> canonical validation -> operation assessment -> XML generation -> Playground success capture -> SQLite operational state`

This is the key change from the earlier architecture narrative. SQLite-backed state and success capture are now part of the active operating design, not future-only ideas.

## Architecture Principles

The current architecture follows these principles:

1. Do not build a one-off Excel-to-XML converter.
2. Keep source evidence, canonical interpretation, validation, and XML assembly separate.
3. Treat Playground-confirmed outcomes as operational state, not temporary UI state.
4. Keep parent Basic UDI-DI registration, child Device UDI-DI registration, and PATCH as separate regulatory workflows.
5. Make operation availability explicit through assessment services before XML generation.
6. Keep PATCH lineage anchored to accepted per-device state.
7. Keep UI terminology aligned with regulatory meaning and backend behavior.
8. Keep documentation aligned with implemented workflow, not historical intent.

## Stakeholders, Actors, Roles And Responsibilities

### Business Sponsor

Owns business priority, workflow direction, and delivery sequencing.

### Regulatory Affairs Lead

Owns regulatory correctness, message-shape expectations, and interpretation of what constitutes a valid candidate, valid lineage, and valid accepted-state transition.

### Regulatory Operations User

Uses the application to:

- assess operation availability
- generate XML
- validate XML locally
- test messages in EUDAMED Playground
- upload success XML
- monitor remaining operational candidates

### Product / Source Data Owner

Owns meaning of workbook content and resolves source data issues or interpretation gaps.

### Solution Architect

Owns platform direction, separation of concerns, and prevention of workflow collapse into ad hoc XML utilities.

### Engineering

Implements backend services, frontend workspaces, persistence, and testing-state logic.

## Current Implemented Business Capability

The application currently provides a real controlled testing workflow rather than a review-only prototype.

Implemented business capability now includes:

- assessment of whether a `POST` or `PATCH` is actually available for a selected family/variant scope
- distinction between parent-seeding and child-only `POST` candidates
- generation of single-device `POST` XML
- generation of single-device scenario-based `PATCH` XML
- generation of bulk Basic UDI-DI parent registration XML
- generation of bulk Device UDI-DI child registration XML
- generation of bulk PATCH XML
- local XSD validation against the wrapped EUDAMED service message schema set
- upload of EUDAMED success XML to record confirmed successful outcomes in SQLite

This is now materially beyond the earlier “review and preview” posture.

## Current Application Architecture

The application is a Python and React web application consisting of:

- a FastAPI backend
- a React/TypeScript/Vite frontend
- workbook and schema assets under `data/`
- SQLite-backed operational persistence

The main user-facing workspaces are:

- `Submission Data`
- `Canonical Validation`
- `EUDAMED Testing`

Within `EUDAMED Testing`, the active operation modes are:

- `POST`
- `Patch XML`
- `Market Info`
- `Bulk Basic UDI-DI POST`
- `Bulk Device UDI-DI POST`
- `Bulk PATCH`

The older `Post + Patch` and `Single XML` framing is obsolete and should not be treated as the current architecture.

## Current Logical Architecture

The current logical architecture is composed of the following layers.

### 1. Source Evidence Layer

This layer reads workbook and reference inputs from local files and normalizes raw source values.

### 2. Canonical Interpretation Layer

This layer interprets workbook rows into stable regulatory meaning, including family/variant identity, device identity, and XML-relevant attributes.

### 3. Canonical Validation Layer

This layer determines readiness for downstream XML workflows and produces the “XML-ready” population used by the testing workspaces.

### 4. Operation Assessment Layer

This layer determines whether a selected scope has an eligible next operation. It does not simply expose raw rows. It evaluates current tracked state and returns:

- available vs blocked outcome
- candidate identity
- parent/child registration interpretation
- recommended next action
- counts relevant to the selected operation

### 5. XML Generation Layer

This layer generates operation-specific XML payloads for:

- single `POST`
- single `PATCH`
- `Market Info`
- bulk parent `POST`
- bulk child `POST`
- bulk `PATCH`

### 6. Success Capture Layer

This layer parses returned EUDAMED success XML and applies confirmed changes to the SQLite state model.

### 7. Operational Read Model Layer

This layer powers UI counts, next-candidate logic, lineage interpretation, and “what is available now” behavior.

## Current Data Architecture

The current data architecture is hybrid: file-backed for source evidence and SQLite-backed for operational state.

### File-Backed Inputs

Primary file-backed inputs include:

- source Excel workbooks
- Basic UDI reference workbook
- local EUDAMED schema pack
- configuration/mapping assets

### SQLite-Backed Operational State

SQLite is now part of the current application architecture. It is not future-only.

The operational SQLite layer currently stores and supports:

- testing subjects
- registration success state
- latest successful version per device
- per-device accepted-state lineage
- success XML upload outcomes
- counts and read models used by UI panels

This layer now materially affects candidate selection for `POST`, `Patch XML`, `Bulk Device UDI-DI POST`, and `Bulk PATCH`.

## Target Data Direction

The next data-architecture direction remains relational cleanup and stronger identity linkage. The target is to:

- use stable device-subject identity consistently
- reduce string-matched lineage logic
- tie accepted-state records back to a stable device subject
- expand submission and audit history
- track scenario-level change intent more explicitly

That said, the current SQLite layer is already operationally significant and must be documented as current architecture rather than deferred architecture.

## Current XML Workflow Architecture

### Single `POST`

Single `POST` works as an assessment-first flow:

1. user selects family/variant scope
2. backend assesses whether a valid next candidate exists
3. UI explains whether the next operation is:
   - a parent-seeding Basic UDI-DI `POST`, or
   - a child Device UDI-DI `POST`
4. preview is generated only for the next eligible candidate
5. success XML can be uploaded to persist the confirmed result

### `Patch XML`

Single-device PATCH is a controlled scenario workspace:

1. user selects family/variant scope
2. backend identifies the next eligible accepted-state device
3. scenario selection determines the intended business change
4. the derived PATCH is built from the latest accepted tracked state
5. success XML records the confirmed successful PATCH and advances version state

### `Market Info`

`Market Info` remains a distinct operation area and should continue to be treated separately from `POST` and `PATCH`.

### `Bulk Basic UDI-DI POST`

This generates parent-only registration packages. It is intentionally separate from child registration.

### `Bulk Device UDI-DI POST`

This generates child-only registration packages under an already tracked parent Basic UDI-DI. The current design expects the XML shape to remain purely child-oriented in this mode.

### `Bulk PATCH`

This generates PATCH packages derived from tracked accepted device state. The current UI direction includes operational scoping such as:

- all posted devices
- next N devices
- selected catalogue numbers
- imported catalogue lists

## Current Success XML Architecture

The application now supports success-XML upload as a first-class operational workflow.

The current success-XML endpoint accepts success XML for:

- `DEVICE.POST`
- `UDI_DI.POST`
- `UDI_DI.PATCH`

The parser also supports multi-entity acknowledgements for bulk operations.

Current persistence behavior includes:

- stamping successful `POST` records at version `1`
- incrementing `PATCH` lineage using the accepted returned state
- recording scenario information for successful PATCH updates where available
- updating the state that drives next-operation availability and remaining counts

This capability is a major part of the current architecture and should be treated as such.

## Current UI Architecture Direction

The current UI direction is to keep all operation workspaces aligned around the same pattern:

- assessment card
- preview card
- compact metadata strip
- explicit next-action controls
- XML structure / XML preview review area
- upload-success action when the workflow supports it

This pattern has already been applied substantially to single `POST` and single `PATCH`, and is being extended to bulk operations.

The architecture implication is that the frontend is moving from one large mixed workspace toward operation-specific components with shared UI language and shared orchestration patterns.

## Current Persistence And State Architecture

The present persistence model is operational rather than archival. Its job is to answer:

- what is already known to be successfully tested
- what the latest accepted version is for a device
- whether a new `POST` is parent-seeding or child-only
- whether a `PATCH` can be built safely
- how many eligible operations remain in a selected scope

The current model is therefore not just passive storage. It is part of the workflow engine.

## Current Constraints And Assumptions

Current constraints and assumptions include:

- EUDAMED Playground availability is external and unstable
- Playground-confirmed state may not equal production truth
- workbook data alone does not define accepted EUDAMED state
- accepted-state tracking currently depends on local recorded outcomes
- current lineage logic still contains some text-matching and alias handling
- UI and backend must stay aligned on family/variant alias behavior

## Current Risks And Issues

The main current architecture risks are:

- `App.tsx` remains too large and still contains legacy paths that should be extracted or removed
- some workflows still rely on fallback or transitional UI structures
- operational counts can become misleading if they are not tied precisely to the selected mode
- bulk PATCH preview generation may become slow for larger selections because current derivation work is done per device before package assembly
- success capture is stronger than before, but broader audit and replay tooling is still limited

## Transition Architecture And Roadmap

The current transition path is:

1. finish aligning `POST`, `Patch XML`, `Bulk Device UDI-DI POST`, and `Bulk PATCH` around a consistent workspace design
2. continue extracting large operation-specific UI logic out of `App.tsx`
3. strengthen SQLite-backed identity and accepted-state linkage
4. expand documentation so it matches implemented behavior
5. improve bulk performance and operator feedback
6. only then consider later transport integration

## Major Architecture Decisions Reflected Here

This draft reflects the following major architecture decisions already present in the codebase:

- SQLite is the active operational store
- success-XML upload is part of the active workflow
- parent and child `POST` flows remain separate in bulk mode
- `Patch XML` is the single-device PATCH workspace
- operation assessment precedes XML generation
- accepted-state lineage controls PATCH generation
- Playground testing outcomes are used to drive subsequent availability decisions

## Open Architecture Questions

Open questions that still need deliberate architecture decisions include:

- how far the SQLite model should go before a more formal relational identity cleanup
- how scenario change capture for PATCH should evolve beyond the current first-pass recording
- how bulk PATCH generation should scale toward larger selections
- what the final submission-history and audit model should be
- how much of the current frontend orchestration should move into reusable workspace components

## Sections Still Requiring Additional Input

The following sections can now be drafted more accurately later, but still need explicit stakeholder input:

- formal non-functional requirements
- deployment architecture and hosting topology
- support and operational ownership model
- security model for later upload/transport phases
- production submission and reconciliation architecture
