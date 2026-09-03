# Architecture Definition Document Draft

## Purpose Of This Draft

This draft restates the architecture around the application as it exists now, not as it existed during the earlier workbook-analysis phase. It is intended to be used as source material for the formal Architecture Definition Document and to keep the architecture narrative aligned with the implemented codebase.

## Document Status

This is a working architecture draft based on the codebase, current UI workspaces, current SQLite persistence, and the documented direction in [session-handoff.md](/Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/docs/session-handoff.md).

It reflects the state of the application as of August 31, 2026.

Current verification baseline for this draft:

- backend `python -m pytest -q`: `111 passed, 1 warning`
- frontend `npm run build`: passed
- the frontend still has no configured automated UI test runner in the repo

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
- `Bulk Market Info`

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

## Application Creator

This application was created in response to demand for a EUDAMED registration solution for Blatchford manufactured products.

Application creator:

- Frank C Bogle
- Head of Enterprise Solutions
- Blatchford Mobility Ltd

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
- generation of single-device scenario-driven `MARKET_INFO.PUT` XML
- generation of bulk Basic UDI-DI parent registration XML
- generation of bulk Device UDI-DI child registration XML
- generation of bulk PATCH XML
- generation of bulk Market Info XML for a selected registered parent cohort
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
- `Registration State`
- `Testing Summary`
- `Canonical Validation`
- `EUDAMED Testing`

Within `EUDAMED Testing`, the active operation modes are:

- `POST`
- `Patch XML`
- `Market Info`
- `Bulk Basic UDI-DI POST`
- `Bulk Device UDI-DI POST`
- `Bulk PATCH`
- `Bulk Market Info`

The older `Post + Patch` and `Single XML` framing is obsolete and should not be treated as the current architecture.

## Current Logical Architecture

The current logical architecture is composed of the following layers.

### 1. Source Evidence Layer

This layer reads workbook and reference inputs from local files and normalizes raw source values.

### 2. Canonical Interpretation Layer

This layer interprets workbook rows into stable regulatory meaning, including family/variant identity, device identity, and XML-relevant attributes. It separates variable workbook headers and business-friendly values from the fixed EUDAMED concepts used for validation and XML generation.

Each canonical device record retains:

- source workbook, sheet, and row lineage
- catalogue number, Device UDI-DI, and Basic UDI-DI identity
- canonical field paths for XML-relevant data such as status, trade name, manufacturer, warnings, storage conditions, and Market Information
- structured completeness and XML-readiness results

The canonical model represents the proposed, validated business data. It is distinct from the separately tracked EUDAMED accepted state, which is established only after an acknowledgement is imported.

Source aliases are normalised at this boundary. For example, both `ON_THE_EU` and `ON_THE_EU_MARKET` resolve to the EUDAMED XML value `ON_THE_MARKET`. This mapping is applied on workbook import; an import refresh is therefore required before regenerated XML uses a newly added alias.

### 3. Canonical Validation Layer

This layer determines readiness for downstream XML workflows and produces the “XML-ready” population used by the testing workspaces.

### 4. Operation Assessment Layer

This layer determines whether a selected scope has an eligible next operation. It does not simply expose raw rows. It evaluates current tracked state and returns:

- available vs blocked outcome
- candidate identity
- parent/child registration interpretation
- recommended next action
- counts relevant to the selected operation

Current implementation status:

- dedicated assessment flows are implemented for:
  - single `POST`
  - single `PATCH`
  - bulk parent/child `POST`
  - `Bulk PATCH`
  - `Bulk Market Info`
- single-device `Market Info` still uses resolved registered-device context rather than a fully separate assessment contract

### 5. XML Generation Layer

This layer generates operation-specific XML payloads for:

- single `POST`
- single `PATCH`
- `Market Info`
- bulk parent `POST`
- bulk child `POST`
- bulk `PATCH`
- bulk `Market Info`

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
- latest successful Market Info version per device lineage
- per-device accepted-state lineage
- append-only generated and success workflow events
- success XML upload outcomes
- counts and read models used by UI panels

This layer now materially affects candidate selection for `POST`, `Patch XML`, `Bulk Device UDI-DI POST`, `Bulk PATCH`, and `Bulk Market Info`.

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

Current architecture assumption:

- publicly accessible EUDAMED and MDCG guidance does not currently give a clear verified rule for whether `MARKET-INFO.PUT` increments the accepted device version, leaves it unchanged, or uses a distinct market-information version concept
- the implemented and planned architecture should therefore treat Market Info version handling as evidence-led
- `MARKET-INFO.PUT` should use the current accepted Market Info/device version as input context when needed by the XML shape
- successful `MARKET-INFO.PUT` should be persisted in Market Info-specific lineage state
- successful `MARKET-INFO.PUT` should not, by default, advance the core tracked device/PATCH version lineage
- the active implementation now records Market Info success separately in:
  - `testing_events`
  - `testing_subjects.latest_successful_market_info_version`
- the active implementation now promotes the accepted Market Info country set back into the UI after successful XML upload so the next scenario starts from the new accepted baseline

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

### `Bulk Market Info`

This generates chunked `MARKET_INFO.PUT` packages for a selected posted-device cohort under one registered Basic UDI-DI parent.

Current implementation behavior:

- eligibility is assessed against the selected parent scope
- a selected cohort may contain different accepted market-country baselines; each device retains its own baseline and receives its own next Market Info version
- user-edited market-country overrides drive one target state per Bulk Market Info chunk
- local validation, ZIP download, success upload, and SQLite persistence are implemented

## Current Success XML Architecture

The application now supports success-XML upload as a first-class operational workflow.

The current success-XML endpoint accepts success XML for:

- `DEVICE.POST`
- `UDI_DI.POST`
- `UDI_DI.PATCH`
- `MARKET_INFO.PUT`

The parser also supports multi-entity acknowledgements for bulk operations.

Current persistence behavior includes:

- stamping successful `POST` records at version `1`
- incrementing `PATCH` lineage using the accepted returned state
- recording scenario information for successful PATCH updates where available
- recording successful Market Info updates as separate Market Info events and Market Info version state
- correlating successful acknowledgements back to generated preview context by `subject_id`, `message_type`, `correlation_id`, and `message_id`, with a latest-generated fallback retained for compatibility
- preserving generated preview rows as append-only `testing_events` history rather than overwriting the latest preview
- updating the state that drives next-operation availability and remaining counts

The current success-capture architecture does not yet treat `MARKET-INFO.PUT` as part of the same version lineage as `PATCH`. That separation is intentional until operational evidence proves otherwise.

This capability is a major part of the current architecture and should be treated as such.

## Current Workflow Event Logging Architecture

The first compatibility-safe slice of workflow-event logging is already implemented in the SQLite testing-state layer.

Current behavior:

- generated `POST`, `Patch XML`, and `Market Info` previews append `generated` rows to `testing_events`
- success uploads append `success_ack` rows to `testing_events`
- mixed acknowledgements record successful entities independently and retain non-success entities as `error_ack` rows without advancing their accepted state
- ZIP-producing downloads append one package-level audit row to `generated_packages`; this records the flow, filename, creation time, byte size, SHA-256 digest, contained filenames, and manifest metadata without storing a duplicate ZIP blob
- event rows carry explicit workflow metadata in addition to `raw_event_json`, including:
  - `event_kind`
  - `operation_scope`
  - `batch_id`
  - `base_message_type`
  - `base_version`
  - `derived_version`
  - `accepted_state_source`
  - `state_before_json`
  - `state_after_json`
  - `delta_json`
  - `correlation_id`
  - `message_id`
- legacy `testing_subjects` compatibility fields remain active while richer event data is phased in

`testing_events` remains device-scoped. `generated_packages` is deliberately separate because one bulk ZIP can contain many devices and does not belong to a single device event.

Single and Bulk PATCH exclude devices with an unresolved EUDAMED `marketInfoLink` rejection. Those devices must be handled through `MARKET_INFO.PUT` before a later PATCH is generated. PATCH payloads repeat the latest accepted Market Information state, so an accepted state that differs from the workbook is safe to PATCH; only `MARKET_INFO.PUT` can change that state.

Bulk `MARKET_INFO.PUT` may apply one explicit target country set to devices with different accepted/source baselines. Each payload retains its own baseline and receives its own next Market Info version.

When an EUDAMED Market Info error reports a current version, SQLite retains that value as an observed version floor. It does not overwrite the accepted Market Information snapshot, but prevents generation from reusing a version EUDAMED has already accepted.

### Bulk Market Info And PATCH Reconciliation

Playground testing established that a `UDI_DI.PATCH` rejected with EUDAMED's `marketInfoLink` rule must be followed by a successful `MARKET_INFO.PUT` acknowledgement before PATCH is retried. The application enforces this as a device-specific pending condition, and resolves it only when a later Market Info success is recorded.

The accepted Market Info state is independent of the source workbook. After a successful Market Info update, PATCH payloads repeat the accepted country set rather than reverting to workbook countries. Therefore, an accepted Market Info difference is not itself a PATCH exclusion.

EUDAMED can report a higher current Market Info version than SQLite has accepted locally, for example when a previous success acknowledgement was not imported. That response is persisted as an observed version floor. Single and Bulk Market Info generation use the highest accepted or observed version as the current baseline; Single Market Info rejects a stale version supplied by the UI.

This design was verified in the Navigator / Javelin / Linx test cohort: a Bulk Market Info PUT completed with 29 successes and one version-scheme error, the affected device completed a Single Market Info PUT at version 3, and the subsequent Bulk PATCH completed successfully for all 31 devices.

### Playground Option Mapping

The application routes operator workflows to EUDAMED service messages. Playground selection must therefore follow the service message, irrespective of whether the generated package is single-device or bulk:

| Service message | Application workflows | Confirmed Playground option |
| --- | --- | --- |
| `UDI_DI.POST` | Single and Bulk Device UDI-DI POST | `Upload of UDI-DI/Master UDI-DI for existing Basic UDI-DI` |
| `UDI_DI.PATCH` | Single and Bulk PATCH | `Update of UDI-DI/Master UDI-DI` |
| `MARKET_INFO.PUT` | Single and Bulk Market Info | `Update Market Information` |
| `DEVICE.POST` | Basic UDI-DI POST | `Upload of Legacy / Regulation Device / SPP (Basic UDI and UDI-DI / Master UDI-DI)` |

Generated payloads and returned acknowledgements are both retained in SQLite event/package history so the selected option, EUDAMED result, and accepted state can be reconciled together.

This is not yet the final submission-history architecture, but it is current architecture and it already affects correctness of accepted-state reconciliation.

## Current UI Architecture Direction

The current UI direction is to keep all operation workspaces aligned around the same pattern:

- assessment card
- preview card
- compact metadata strip
- explicit next-action controls
- XML structure / XML preview review area
- upload-success action when the workflow supports it

This pattern has already been applied substantially to single `POST` and single `PATCH`, and is being extended to bulk operations.

It now also applies to single `Market Info`, which uses:

- an assessment card
- a scenario/edit card
- a preview card
- upload-success handling
- the same compact metadata and preview language as the other single-device workspaces

The architecture implication is that the frontend is moving from one large mixed workspace toward operation-specific components with shared UI language and shared orchestration patterns.

## Current Persistence And State Architecture

The present persistence model is operational rather than archival. Its job is to answer:

- what is already known to be successfully tested
- what the latest accepted version is for a device
- whether a new `POST` is parent-seeding or child-only
- whether a `PATCH` can be built safely
- what the latest accepted Market Info version is for a device lineage
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
- Market Info version semantics are now operationally tracked, but the exact EUDAMED contract meaning still depends on continued Playground evidence because public guidance remains incomplete
- success capture is stronger than before, but broader audit and replay tooling is still limited

## Transition Architecture And Roadmap

The current transition path is:

1. finish aligning `POST`, `Patch XML`, `Market Info`, `Bulk Device UDI-DI POST`, `Bulk PATCH`, and `Bulk Market Info` around a consistent workspace design
2. continue extracting large operation-specific UI logic out of `App.tsx`
3. strengthen SQLite-backed identity and accepted-state linkage
4. extend workflow-event logging carefully without breaking current compatibility fields
5. expand documentation so it matches implemented behavior
6. improve bulk performance and operator feedback
7. continue controlled `MARKET_INFO.PUT` testing and confirm the long-term versioning rule from operational evidence
8. only then consider later transport integration

## Production Cutover Planning

The current implemented workflow is a controlled Playground-testing architecture. It is intentionally conservative:

- single `PATCH` depends on SQLite-tracked successful `POST` lineage
- bulk `PATCH` depends on SQLite-tracked accepted-state lineage
- operation availability is constrained by locally confirmed testing evidence

That is appropriate for the current testing phase, but it is not the final Production cutover model.

The Production cutover direction should be:

- any row classified as `POST` remains eligible for `POST`
- any row classified as `PATCH` becomes eligible for `PATCH` without requiring an application-generated prior `POST`
- source/reference lifecycle classification should therefore be allowed to drive Production `PATCH` eligibility once version state is trustworthy

This is particularly important for families and variants already modeled as being in a `PATCH` lifecycle in the authoritative reference data.

### Planned Operating Modes

The architecture should later support two distinct modes:

#### 1. Testing Lineage Mode

This is the current implemented behavior.

- local SQLite success history is the authority for accepted lineage
- `PATCH` remains blocked until tracked successful registration exists
- suited to Playground proving and controlled workflow hardening

#### 2. Production Assumed-Registered Mode

This is the intended cutover direction.

- workbook/reference `PATCH` rows may proceed without an app-generated `POST`
- eligibility depends on trusted lifecycle classification plus trusted version state
- suited to Production-aligned operations where prior registration is assumed or externally confirmed

### Version-State Strategy For Production `PATCH`

Production cutover requires a trusted source for the current accepted version before generating the next `PATCH`.

The preferred order is:

1. live EUDAMED lookup of current version state
2. controlled use of workbook/reference version markers where business ownership confirms that assumption
3. explicit operator-confirmed current version as a fallback

The architecture should not assume that local SQLite testing history alone is sufficient for Production `PATCH` versioning.

### Version-State Strategy For Production `MARKET-INFO.PUT`

Production cutover should keep Market Info version handling separate from PATCH lineage until evidence proves coupling.

The current intended rule is:

1. use the current accepted Market Info/device version as context if the Market Info XML/service contract requires it
2. record successful Market Info outcomes in separate Market Info state fields and events
3. do not increment the core accepted device version solely because a `MARKET-INFO.PUT` succeeded unless EUDAMED acknowledgement evidence or restricted technical guidance proves that this is required

This prevents the architecture from incorrectly advancing PATCH lineage on the basis of an assumption that is not yet verified from public EUDAMED guidance.

## Major Architecture Decisions Reflected Here

This draft reflects the following major architecture decisions already present in the codebase:

- SQLite is the active operational store
- success-XML upload is part of the active workflow
- workflow-event logging is part of the active SQLite testing-state design
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
- whether Market Info version semantics should remain completely separate at Production cutover or be reconciled with a broader accepted-state model
- how Production cutover should switch from testing-lineage gating to assumed-registered `PATCH` gating
- how Production `PATCH` version state should be sourced from EUDAMED, trusted source version markers, or explicit operator confirmation
- what the final submission-history and audit model should be
- how much of the current frontend orchestration should move into reusable workspace components

## Sections Still Requiring Additional Input

The following sections can now be drafted more accurately later, but still need explicit stakeholder input:

- formal non-functional requirements
- deployment architecture and hosting topology
- support and operational ownership model
- security model for later upload/transport phases
- production submission and reconciliation architecture
