# Session Handoff

## Current Objective

Continue refining the XML workspaces so the UI and backend now clearly separate:

- `POST`
- `Patch XML`
- `Market Info`
- `Bulk Basic UDI POST`
- `Bulk UDI-DI POST`
- `Bulk PATCH`
- `EUDAMED Generation`

with the current implementation focus now being:

- preserve the clean split between parent-only and child-only bulk registration flows
- keep `Patch XML` as the controlled single-device PATCH workspace
- keep `Bulk PATCH` aligned to latest successful per-device accepted state
- make the bulk UI simpler and more operationally accurate
- stabilize the SQLite-backed application persistence layer

## Reading Guide

- `Current Repo State` sections below should be treated as authoritative for the next session.
- `Historical Playground Findings` sections capture dated evidence and prior decisions.
- Any recorded test counts in this document are historical snapshots only. Re-run verification from the current worktree before relying on them.

## Latest Confirmed Decisions

- As of Sunday, August 9, 2026, the live EUDAMED Playground validator rejected `m:Push version="3.0.30"` and required `3.0.32` instead.
- The repo has therefore been hotfixed to default `EUDAMED_MESSAGE_SCHEMA_VERSION` to `3.0.32` for current Playground testing.
- The bundled local `MessageType.xsd` fixed `m:Push@version` value has also been hotfixed from `3.0.30` to `3.0.32` so local validation and tests remain aligned with current Playground behavior.
- This is intentionally captured as a reversible config decision because the public EUDAMED technical documentation page still showed XSD version `3.0.30` at the time of testing.
- Playground upload testing on Sunday, August 9, 2026 also revealed an actor mismatch guard:
  - generated XML carried `UK-MF-000048777`
  - logged-in Playground actor was `UK-MF-000033261`
  - EUDAMED rejected the upload because `MFActorCode` / sender actor must match the submitting actor
- The repo now supports a testing-only override via `EUDAMED_MANUFACTURER_SRN_OVERRIDE` so Playground XML can be aligned to the logged-in actor without rewriting the underlying source/reference data.
- Playground testing then revealed a second actor-reference issue:
  - generated XML carried `ARActorCode` `DE-AR-000006292`
  - Playground could not resolve that actor in the current environment
- The repo now supports `EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE=true` so `ARActorCode` can be omitted for controlled Playground testing when the referenced AR is not available there.
- Search results in Playground then identified the current AR actor for the logged-in manufacturer context as `DE-AR-000031681` (`Blatchford Europe GmbH`).
- The repo now supports `EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE` so Playground XML can carry a valid AR actor without mutating the underlying legacy reference data.
- On Sunday, August 9, 2026, a `DEVICE.POST` upload succeeded in Playground using this working actor combination:
  - `EUDAMED_MESSAGE_SCHEMA_VERSION=3.0.32`
  - `EUDAMED_MANUFACTURER_SRN_OVERRIDE=UK-MF-000033261`
  - `EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE=DE-AR-000031681`
  - `EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE=false`
- On Sunday, August 9, 2026, the baseline equivalent first-child `UDI_DI.PATCH` from the generated `Post + Patch` pair also succeeded in Playground with `e:version = 2`.
- Baseline `POST` remains version `1`.
- The current implemented repo still treats the equivalent first child `PATCH` as version `2`.
- Later scenario `PATCH` drafts inherit from the latest successful tracked PATCH state for the device when available.
- The user must enter the next scenario `PATCH` version explicitly based on the EUDAMED playground state.
- `Patch XML` remains accessible as a workspace, but PATCH generation and download should stay blocked until the baseline `POST` has been generated and reviewed for the matching parent record in the current session.
- For the current increment, parent `POST` selection is:
  - the exact selected record if that record is an XML-ready `POST`
  - otherwise the first available XML-ready `POST` in the selected variant
- Deriving later scenario `PATCH` drafts from the reviewed device lineage is acceptable for the initial testing phase.
- New design direction agreed on Tuesday, August 11, 2026:
  - the baseline workspace should move from `Post + Patch` to `POST` only
  - `Patch XML` should become the only workspace that generates PATCH messages
  - `Patch XML` should include an explicit `Equivalent First Patch` option
  - a version `2` `PATCH` should be allowed to be the first real update derived directly from the accepted `POST`
  - that version `2` `PATCH` must still match the accepted `POST` in every non-target field
  - only the explicitly changed field or fields should differ
  - version `3+` `PATCH` messages should continue to derive from the latest accepted tracked `PATCH` state for that device
- The old fixture-backed PATCH scenario artifacts have now been removed from the repo.
- The current PATCH workflow is therefore entirely record-driven:
  - selected XML-ready parent `POST`
  - equivalent first-child `PATCH`
  - latest successful tracked device state for later scenario drafts
- The redundant combined `download-post-patch-pair` path has been removed.
- Separate `POST` ZIP and `PATCH` ZIP downloads remain the supported baseline-pair download behavior.
- Workbook-drift detection or workbook-refreshed scenario regeneration can be considered later, after initial testing.
- Agreed next execution order on Thursday, August 13, 2026:
  - complete and harden the clean bulk registration split
  - continue `Bulk PATCH` and `Market Info` Playground testing
  - implement broader database-backed persistence beyond the current testing-state store
  - continue UI refinement after the database-backed state model is in place
- Latest implemented decisions on Friday, August 14, 2026:
  - `Single XML` has been removed from the user-facing `EUDAMED Testing` workspace
  - `Bulk Basic UDI POST` is now treated as a parent-only flow
  - `Bulk UDI-DI POST` is now treated as a child-only flow
  - parent existence is now resolved from the testing-state store, currently backed by `data/testing/testing-state.sqlite3`
  - if a parent `Basic UDI-DI` already has a successful `DEVICE.POST`, `Bulk Basic UDI POST` should not generate a new parent seed
  - in that case the clean backend message is now:
    - `Parent Basic UDI-DI already exists for {family} / {variant}. Use Bulk UDI-DI POST to add child devices.`
  - if a parent `Basic UDI-DI` does not yet have a successful `DEVICE.POST`, `Bulk UDI-DI POST` should not silently reserve a seed row any longer
  - instead it now blocks child generation and tells the user to run `Bulk Basic UDI POST` first
  - the bulk POST router responses for these business-rule stops now return `400 Bad Request` rather than `404 Not Found`
  - the simplified bulk summary cards now use the full available width in the UI
  - `Bulk Basic UDI POST` UI readiness now uses unposted-parent count rather than total-parent count
  - bulk parent / child eligibility now scans the full XML-ready variant population before applying the `300` message cap
  - the `300` cap therefore limits emitted package size, not eligibility discovery
  - single-device `Patch XML` generation is now backend-gated as well as frontend-gated
  - the backend now requires the exact baseline `POST` for the selected `product_family` / `product_variant` / `catalogue_number` to have been generated and reviewed in the current process before `PATCH` preview or download is allowed
  - bulk `PATCH` remains exempt from that single-device reviewed-baseline gate
  - `Bulk Basic UDI POST` frontend readiness now resolves by actual unposted `Basic UDI-DI` set difference rather than by subtracting unrelated posted-parent counts
  - explicit action feedback is now shown when generating `Bulk Basic UDI POST` and `Bulk UDI-DI POST` previews
  - historical verification snapshot on Friday, August 14, 2026:
    - backend `pytest`: `51 passed`
    - frontend production build: `npm run build` passed
- Latest implemented and verified decisions on Friday, August 14, 2026 and Saturday, August 15, 2026:
  - single `POST` now selects the next valid candidate from tracked state rather than blindly offering the first row in the chosen family and variant
  - single `PATCH` now requires both:
    - reviewed baseline `POST` preview for the exact selected record in the current session
    - tracked successful Playground registration for that same device before version `2` `PATCH` can be generated
  - `Bulk UDI-DI POST` now excludes child `primary UDI-DI` values already known as successfully registered in tracked state
  - historical verification snapshot on Friday, August 14, 2026 and Saturday, August 15, 2026:
    - backend `pytest`: `58 passed`
    - frontend production build: `npm run build` passed
  - successful Playground test results are persisted in `data/testing/testing-state.sqlite3`, with legacy YAML bootstrap data in `data/testing/playground-tested-subjects.yaml`, and are documented in `docs/eudamed-playground-test-report.md`
    - successful single `DEVICE.POST` for `Epirus / Esprit / ESP22L1S` on Thursday, August 14, 2026
    - successful single `UDI_DI.PATCH` version `2` trade-name update for `Epirus / Esprit / ESP22L1S` on Thursday, August 14, 2026
    - successful second `Elite / Elite VT` bulk child `UDI_DI.POST` wave of five new child devices on Thursday, August 14, 2026
    - successful `Elite / Elite VT` bulk `UDI_DI.PATCH` equivalent-first wave across ten child devices on Thursday, August 14, 2026
  - latest traced single-`POST` eligibility findings on Saturday, August 15, 2026:
    - `Echelon VAC` is blocked because the parent `Basic UDI-DI` is already known in tracked state, so additional registrations should use `Bulk UDI-DI POST`
    - `Echelon VT` is blocked because every validated row in that variant is currently classified as `PATCH`, not `POST`
- Latest agreed design direction on Wednesday, August 19, 2026:
  - `EUDAMED Testing` should move toward a process-type-driven workflow rather than exposing raw XML actions first
  - the user should first choose the intended operation type, then choose `Product Family` and `Variant`
  - SQLite-backed backend assessment should then determine and present the current operational situation for that selection
  - the UI should guide the user by explaining:
    - what is possible
    - what is blocked
    - why it is blocked
    - how many records are eligible
    - what the next valid action is
  - example intended outcomes:
    - if a parent `Basic UDI-DI` is already registered, parent `POST` should stop and direct the user toward child `POST`
    - if no successful tracked registration exists for the targeted device lineage, `PATCH` should stop and explain that accepted / tracked state is required first
    - for bulk operations, the system should resolve the eligible cohort and present counts and groupings before generation
  - this should be implemented as explicit operation-specific readiness assessment rather than one generic workflow engine
  - no data-model change has yet been agreed for linking testing history beyond the current `device_subject`-anchored direction; discuss that separately before implementation

## Current Repo State

## Current Implemented Behavior

### Submission Data

- The `Submission Data` workspace now mixes:
  - live workbook inventory from direct Excel inspection
  - SQLite-backed import snapshot, read-model, and monitoring panels
- The current SQLite import layer persists:
  - `import_batch`
  - `source_workbook`
  - `source_row`
  - `device_subject`
  - `device_identity_issue`
  - `canonical_device_record`
  - `canonical_field_value`
  - `canonical_projection_snapshot`
- The active SQLite file is currently:
  - `data/testing/testing-state.sqlite3`
- The current workbook-import and projection flow is:
  - workbook rows are imported into SQLite as `source_row`
  - matching rows are resolved into stable `device_subject` identities
  - unresolved or conflicting identity cases are captured in `device_identity_issue`
  - the current canonical validation subset is persisted into `canonical_device_record` and `canonical_field_value`
  - a batch-level canonical projection snapshot is persisted in `canonical_projection_snapshot`
- The UI now surfaces database-backed panels for:
  - `Database Tables`
  - `Workbook Snapshot`
  - `Database Monitoring`
  - `Latest Drift`
- The UI now also uses SQLite-backed read-model endpoints for:
  - `device_subject` summaries
  - `source_row` summaries and detail views
  - `device_identity_issue` summaries and detail views
- The UI now treats missing workbook-import data as an empty state rather than a hard error:
  - if no import batch exists yet, the page shows `Import Workbooks`
  - the same control remains available in the status card for reruns
- The current workbook-import monitoring endpoints are:
  - `/api/workbook-imports/latest/summary`
  - `/api/workbook-imports/schema-summary`
  - `/api/workbook-imports/health`
  - `/api/workbook-imports/latest/diff`
- The current SQLite-backed read-model endpoints are:
  - `/api/workbook-imports/device-subjects`
  - `/api/workbook-imports/source-rows`
  - `/api/workbook-imports/identity-issues`
- `latest/summary` and `latest/diff` may legitimately return `404` when no import batch exists yet
  - the frontend now treats that as first-run state, not as a fatal failure
- Current design boundary:
  - SQLite is now the active operational store for workbook import state, monitoring, identity issue tracking, and canonical projection snapshots
  - the `Submission Data` workspace is no longer summary-only database chrome; it already depends on SQLite-backed read paths
  - the broader relational cleanup still remains ahead:
    - more consistent `device_subject_id` lineage joins across all persistence
    - expansion of accepted-state and submission-history persistence beyond the current testing-state slices

### Canonical Validation

- The canonical validation UI now prefers a SQLite-backed projection rather than rebuilding only from direct workbook inspection.
- The active SQLite-backed canonical validation route is:
  - `/api/canonical-validation`
- Current route behavior:
  - if no workbook import exists yet, the route now returns `404` and the UI treats that as an import-required state
  - if a workbook import exists and the SQLite projection is current, the route reports `persistence_source = sqlite_projection` and `projection_status = ready`
  - if a workbook import exists but the stored projection is stale, the route rebuilds the SQLite projection for the latest batch and reports `projection_status = rebuilt`
  - if a workbook import exists but the SQLite projection is missing and cannot be rebuilt, the route now fails with `503` rather than silently hiding the persistence problem
- The `Submission Data` workspace now surfaces projection state separately from generic import state:
  - `ready`
  - `stale`
  - `missing`
- The `Canonical Validation` workspace now surfaces SQLite projection status separately from validation scope:
  - `SQLite ready`
  - `Projection rebuilt`
  - `Import required`
- Current practical meaning:
  - workbook import is now the entry point for refreshing the SQLite-backed canonical view
  - canonical validation is no longer just a transient workbook read; it is part of the persisted SQLite workflow

### EUDAMED Testing

Current pill order:

- `POST`
- `Patch XML`
- `Market Info`
- divider
- `Bulk Basic UDI POST`
- `Bulk UDI-DI POST`
- `Bulk PATCH`

Shared-device testing group:

- `POST`
- `Patch XML`
- `Market Info`

General XML tools:

- `Bulk Basic UDI POST`
- `Bulk UDI-DI POST`
- `Bulk PATCH`

Current directional design intent:

- `EUDAMED Testing` should evolve from a mode selector into a process-aware operations workspace.
- The primary user flow should become:
  - choose operation type
  - choose `Product Family`
  - choose `Variant`
  - let the backend assess the current SQLite-backed situation
  - present the valid next action with supporting counts and reasons
- The system should define the situation for the user rather than expecting the user to infer it from low-level XML tooling.
- The backend should eventually expose explicit operation-readiness assessments for at least:
  - parent `POST`
  - child `POST`
  - single-device `PATCH`
  - `Bulk PATCH`
  - `Market Info`
- Those assessments should be SQLite-backed and should describe:
  - eligible record counts
  - required identity scope such as `Basic UDI-DI` or child `UDI-DI`
  - blocking reasons
  - recommended next action
- Keep the operation-specific rule sets explicit; do not collapse this into one opaque generic workflow engine.

### Planned EUDAMED Testing Logging

- Target this work after the current SQLite persistence increments and Canonical Validation / testing UI tidy-up are complete.
- The goal is targeted auditability for EUDAMED testing decisions and writes, not broad debug logging across the whole app.
- Preferred implementation shape:
  - structured application logs via `structlog`
  - optional SQLAlchemy query tracing behind a disabled-by-default flag
  - durable SQLite audit tables for the business events that matter during Playground testing
- Logging should be narrowly scoped to:
  - `has_successful_basic_udi_post`
  - `has_successful_primary_udi_post`
  - `posted_entries`
  - `posted_parent_groups`
  - writes to `testing_subjects`
  - writes to `testing_events`
  - writes to `reviewed_post_baselines`
  - generation of `POST`, `PATCH`, and bulk preview/download artifacts
  - recorded outcomes such as success, failure, accepted, and rejected
- Logging should not default to capturing:
  - every generic `SELECT`
  - workbook-import internals
  - full XML payload bodies
  - full Playground response bodies
  - routine Canonical / Canonical Validation read traffic
- Proposed feature flags:
  - `EUDAMED_TESTING_AUDIT=true`
  - `EUDAMED_TESTING_DEBUG_LOGS=false`
  - `EUDAMED_TESTING_SQL_TRACE=false`
- Proposed SQLite audit tables:
  - `testing_query_audit`
  - `testing_xml_run`
  - `testing_xml_result`
  - `testing_state_transition`
- Best first safe increment when this work starts:
  - log the Basic UDI and Primary UDI existence checks
  - log writes to `testing_events`
  - log creation of `POST` / `PATCH` preview and download artifacts
  - log recorded Playground outcomes and resulting state transitions
- Likely implementation touchpoints:
  - `backend/app/services/testing_state_store.py`
  - `backend/app/services/xml_generation.py`
  - any SQLite persistence layer that replaces remaining in-memory testing-state behavior

### POST

- Single `POST` no longer relies on a shared anchor panel.
- It generates one registration `POST` for the next valid candidate in the selected family and variant.
- Current single `POST` selection rules are:
  - if both parent `Basic UDI-DI` and child `UDI-DI` are already known, the record is skipped
  - if the parent is known but the child is not, single `POST` stops and directs the user to `Bulk UDI-DI POST`
  - if neither parent nor child is known, that record may be offered as a genuine new registration candidate
- Validates locally against the schema set.
- Supports `POST` ZIP download.
- The old combined `Post + Patch` baseline workspace is no longer the user-facing design and should be treated as replaced by `POST` plus `Patch XML`.

### Patch XML

Current implementation is generated and record-driven.

It now:

- uses the current parent `POST` selection identified by:
  - `product_family`
  - `product_variant`
  - `catalogue_number`
- requires the user to generate and review the baseline `POST` first for that parent record
- also requires tracked successful Playground registration for that same device before a version `2` `PATCH` can be drafted
- keeps the `Patch XML` workspace visible, but should block generation and download until that reviewed baseline `POST` exists in the current session
- should support:
  - `Equivalent First Patch`
  - real first-update version `2` PATCH generation from accepted `POST`
  - later version `3+` PATCH generation from latest accepted tracked state
- current implementation derives scenario drafts from the latest successful device state resolved through the testing-state store, currently backed by `data/testing/testing-state.sqlite3`
  - runtime app behavior should now treat SQLite as the active source of truth rather than auto-reading YAML when the store is empty
  - current tests may still seed temporary SQLite state from the historical YAML fixture
  - scenario derivation falls back to the baseline first child `PATCH` only when no later accepted state has been recorded for that device
- current scenario status:
  - implemented and Playground-successful: `equivalent_first_patch`, `trade_name_edit`, `warning_add`, `storage_condition_edit`, `base_quantity_edit`
  - implemented but not Playground-accepted: `status_code_edit`
  - blocked by Playground business rules: `sterile_edit`, `latex_edit`
  - present in the UI but still unimplemented / untested: `production_identifier_edit`, `sterilization_edit`, `reprocessed_edit`, `number_of_reuses_edit`, `mdn_codes_edit`
- requires explicit user-supplied `PATCH` version input
- shows:
  - baseline-versus-draft business comparison
  - draft readiness messaging
  - baseline-versus-derived XML toggle
  - generated XML change summary after preview
- validates generated XML locally and supports download

Important limitation:

- reviewed baseline `POST` state is persisted in the testing-state SQLite store, not only in-memory
- PATCH scenario promotion state such as `EUDAMED Candidate` versus `EUDAMED Accepted` still remains UI/application state rather than a broader workflow model
- the testing-state store is SQLite-backed today and is expected to evolve within SQLite rather than be replaced by a different database platform
- the current implementation still assumes the reviewed equivalent first-child `PATCH` as the starting point before later scenario drafting
- this is now an acknowledged design constraint to replace

### Market Info

- Uses the selected XML-ready record / shared testing anchor
- Generates one standalone `MARKET_INFO.PUT` message
- Validates locally and supports download

### Bulk XML

- `Single XML` is now removed from the user-facing workspace and should be treated as an internal preview capability only unless reintroduced deliberately.
- `Bulk Basic UDI POST` now represents parent registration waves only.
- `Bulk UDI-DI POST` now represents child registration waves only.
- `Bulk PATCH` remains the bulk update mode.
- Bulk modes do not use the single-device reviewed baseline gate used by the current single-device PATCH flow.
- `Bulk PATCH` should continue to reuse the same per-device accepted-state lineage rules as single-device `Patch XML`.

## Current PATCH Workflow

1. Select product family, variant, and the XML-ready record to review.
2. Open the baseline registration workspace and generate the baseline `POST`.
3. Review the baseline `POST` generated from that same selected row.
4. Open `Patch XML`.
5. Confirm the parent catalogue number shown in `Patch XML` and confirm the baseline `POST` is marked reviewed.
6. Choose one PATCH option:
   - `Equivalent First Patch`
   - first real version `2` update PATCH
   - later version `3+` update PATCH
7. Enter the intended `PATCH` version integer.
8. Enter only the PATCH-specific change values.
9. Review the before/after business summary.
10. Generate the derived scenario `PATCH`.
11. Compare:
   - current accepted base state
   - derived scenario `PATCH`
12. Review local XSD validation and download if needed.

## Agreed PATCH Design Direction

- Version `1` remains the accepted registration `POST`.
- The baseline registration workspace should generate `POST` only.
- `Patch XML` should own all PATCH generation.
- `Equivalent First Patch` should be an explicit PATCH option rather than being forced in the baseline workspace.
- A version `2` `PATCH` should be allowed to be the first real update derived directly from the accepted `POST`.
- That version `2` `PATCH` should match the accepted `POST` in all non-target fields.
- Only the explicitly changed field or fields should differ between:
  - accepted `POST`
  - first real version `2` `PATCH`
- Version `3+` `PATCH` messages should derive from the latest accepted tracked `PATCH` state for that device.
- This means the long-term rule should become:
  - version `2` base state: accepted `POST`
  - version `3+` base state: latest accepted tracked `PATCH`
- The current no-change equivalent version `2` `PATCH` should therefore be treated as an optional testing flow, not as the default or only PATCH flow.
- Bulk registration should now be treated as explicit staged flows rather than one generic `Batch XML` mode.
- The validated sequence is:
  - `Bulk Basic UDI POST`
  - `Bulk UDI-DI POST`
  - `Bulk PATCH`
- `Bulk Basic UDI POST` should create at most one new parent registration per `Basic UDI-DI` in a wave.
- `Bulk UDI-DI POST` should register child devices only after the parent `Basic UDI-DI` has already been accepted.
- `Bulk PATCH` should resolve the latest accepted state independently for each targeted child device lineage.

## Bulk POST Design Direction

- The old generic `Batch XML` concept is now superseded by explicit bulk modes with different regulatory behavior.
- `Bulk Basic UDI POST` is the parent registration step.
- `Bulk UDI-DI POST` is the child registration step.
- `Bulk PATCH` comes only after both registration steps have been proven for the targeted device set.

### Bulk Basic UDI POST

- Purpose: register a new parent `Basic UDI-DI` once.
- Service profile: `DEVICE.POST`.
- Emission rule: one parent message per distinct `Basic UDI-DI`.
- If several selected rows belong to the same new parent, only the first eligible row should generate the parent payload.
- If that parent `Basic UDI-DI` already has a successful `DEVICE.POST` in tracked testing state, it should not generate any new parent payload.
- The current clean message for that case is:
  - `Parent Basic UDI-DI already exists for {family} / {variant}. Use Bulk UDI-DI POST to add child devices.`
- The UI now needs to present readiness using unposted parent count, not total parent count.

### Bulk UDI-DI POST

- Purpose: register multiple child UDI-DIs under an already accepted parent.
- Service profile: `UDI_DI.POST`.
- Message shape: standalone child registration payload, not parent `DEVICE.POST`.
- XML wrapper: `device:UDIDIData` with `xsi:type="udidi:MDRUDIDIDataType"`.
- Parent linkage is carried through `basicUDIIdentifier`; the parent `MDRBasicUDI` block is not repeated in this flow.
- If the parent `Basic UDI-DI` already exists, all selected eligible child rows should be included.
- Child rows already known as successfully registered in tracked state must be excluded before XML generation.
- The old prototype behavior that reserved the first row as a fallback parent seed is no longer the target model.
- If the parent does not exist yet, this flow should stop and instruct the user to run `Bulk Basic UDI POST` first.
- If no genuinely new child rows remain after tracked-state filtering, the UI should say so explicitly rather than generate duplicate child XML.

## Historical Playground Findings

## Latest Playground Evidence

- `Epirus / Esprit`
  - single `DEVICE.POST` for `ESP22L1S` succeeded on Thursday, August 14, 2026
  - single `UDI_DI.PATCH` version `2` trade-name update for `ESP22L1S` succeeded on Thursday, August 14, 2026
- `Elite / Elite VT`
  - first bulk child `UDI_DI.POST` wave of five devices had already been recorded as successful
  - second bulk child `UDI_DI.POST` wave of five new devices also succeeded on Thursday, August 14, 2026
  - bulk `UDI_DI.PATCH` equivalent-first wave across ten child devices succeeded on Thursday, August 14, 2026
- `Echelon`
  - `Echelon VAC` is not currently eligible for single `POST` because the parent lineage is already known in tracked state
  - `Echelon VT` is not currently eligible for single `POST` because all validated rows are classified as `PATCH`
- This flow has now been validated in Playground for five child UDI-DIs under one accepted `Elite VT` parent.

### Bulk PATCH

- Purpose: apply the same approved PATCH scenario across several already registered child devices.
- Dependency: all targeted child UDI-DIs must already exist in Playground.
- Base-state rule: each child device must resolve its own latest accepted state before the next PATCH is derived.
- Bulk PATCH therefore cannot rely on one shared wave baseline; it must behave as a per-device PATCH lineage operation executed in bulk.

## Implemented Guardrails

- Generated scenario `PATCH` preview/download now require `catalogue_number` in the request contract.
- Backend generated-scenario preview/download resolve an exact XML-ready `POST` record for:
  - family
  - variant
  - catalogue number
- `Patch XML` scenario generation stays blocked unless the persisted reviewed baseline state matches the same:
  - product family
  - product variant
  - catalogue number
- If the currently selected XML-ready row is not itself a `POST`, the current UI still falls back to the first available XML-ready `POST` in the selected variant.
- The UI no longer allows scenario generation from a variant without a reviewed baseline pair.
- Bulk parent existence is now resolved from successful tracked testing state via the testing-state store.
- Bulk Basic UDI POST and Bulk UDI-DI POST router stops now return `400` rather than `404`.

## Current UI Notes

- The bulk summary cards for:
  - `Bulk PATCH Summary`
  - `Bulk UDI-DI POST Summary`
  - `Bulk POST Summary`
  now use a full-width multi-column layout so the cards expand across the available space rather than collapsing into a narrow content strip.
- `Single XML` has been removed from the top XML mode selector.
- `Bulk Basic UDI POST` currently shows:
  - unposted parent count
  - a readiness message when all parents already exist
- The current expected message for `Elite / EliteVT` is:
  - `All Basic UDI-DI parents for this variant already have successful parent DEVICE.POST entries. Use Bulk UDI-DI POST for additional child devices.`

## Immediate Next Checks

- restart the backend after the latest router and message changes
- verify the UI now shows the cleaner parent-exists stop instead of a confusing failed action
- start shaping `EUDAMED Testing` toward operation-type readiness assessment driven by SQLite state rather than direct action-first mode switching
- continue Playground testing for:
  - `Bulk UDI-DI POST`
  - `Bulk PATCH`
  - `Market Info`
- keep all new successful or rejected Playground results reflected in:
  - `data/testing/testing-state.sqlite3`
  - `docs/eudamed-playground-test-report.md`

## Current Scenario Scope

Active generated scenarios:

- `Equivalent First Patch`
  - purpose: explicit version `2` baseline `UDI_DI.PATCH`
  - values:
    - `e:version = 2`
    - no business-field delta
  - example:
    - accepted `POST` version `1`
    - derived `PATCH` version `2`
- `Trade Name Edit`
  - target: `udidi:tradeNames`
  - values:
    - free text
    - one replacement trade name value per generated scenario
  - example:
    - before: `ELANIC 22L CAT1 -EXT.FOOT PROSTHESIS`
    - after: `ELANIC 22L CAT1 -EXT.FOOT PROSTHESIS UPDATED`
- `Critical Warnings`
  - target: `udidi:criticalWarnings`
  - values:
    - controlled warning code
    - optional comment
    - `CW999` requires comment
  - example:
    - before: `CW010`
    - after: `CW011`
- `Storage Condition Edit`
  - target: `udidi:storageHandlingConditions`
  - values:
    - one or more existing condition comments updated
    - current implemented testing focus remains `SHC006` and `SHC007`
  - example:
    - before `SHC006`: `Minus 15C`
    - after `SHC006`: `Store in a dry location`

Additional UI-present but not yet implemented scenarios:

- `Sterilization`
- `Reprocessed`
- `Number Of Reuses`
- `MDN Codes`

Implemented or partially implemented scenarios with caveats:

- `Base Quantity`
  - target: `udidi:baseQuantity`
  - values:
    - any positive integer
  - examples:
    - `1`
    - `2`
    - `10`
- `Sterile`
  - target: `udidi:sterile`
  - values:
    - `true`
    - `false`
  - example:
    - before: `false`
    - after: `true`
- `Latex`
  - target: `udidi:latex`
  - values:
    - `true`
    - `false`
  - example:
    - before: `false`
    - after: `true`
- `Status Code`
  - target: `udidi:status/commondi:code`
  - values:
    - `NOT_INTENDED_FOR_EU_MARKET`
    - `ON_THE_MARKET`
    - `NO_LONGER_PLACED_ON_THE_MARKET`
  - example:
    - before: `ON_THE_MARKET`
    - after: `NO_LONGER_PLACED_ON_THE_MARKET`

## Current XML Facts

- Accepted testing baseline remains:
  - `POST -> DEVICE.POST`
  - `PATCH -> UDI_DI.PATCH`
- The first confirmed accepted Playground baseline pair was proven on Sunday, August 9, 2026:
  - `DEVICE.POST` -> `SUCCESS`
  - `UDI_DI.PATCH` with `e:version = 2` -> `SUCCESS`
- Current implementation:
  - scenario-derived later `PATCH` payloads now use the latest successful tracked device state from the SQLite-backed testing-state store when available, falling back to the baseline first child `PATCH` otherwise
- Agreed target direction:
  - version `2` PATCH payloads should derive directly from the accepted `POST`
  - version `3+` PATCH payloads should derive from the latest accepted tracked `PATCH`
- This is intentional for the initial testing phase so scenario changes remain narrow and traceable against one reviewed baseline or one later accepted state.
- Non-scenario fields should stay aligned with the current accepted state for that device lineage.
- Expected scenario deltas are limited to:
  - `e:version`
  - the scenario-approved target field(s)
- Agreed future-state rule:
  - for version `2`, the chosen base should be the accepted `POST`
  - for version `3+`, the chosen base should be the latest accepted tracked `PATCH`

## Latest Confirmed Playground Execution

- On Tuesday, August 11, 2026, `Elan / Elan IC / ELANIC22L1S` succeeded with a scenario-derived `UDI_DI.PATCH` for `Critical Warnings`.
- Confirmed identifiers:
  - transaction id `6aebefd6-4a73-47e4-96f1-23094c0a0167`
  - submission id `06b987f7-4432-4780-9a31-c1fe12de3603`
  - `UDI-DI` `05050649096501`
- Confirmed business delta:
  - `e:version = 4`
  - critical warning changed from `CW010` to `CW011`
  - retained trade name `ELANIC 22L CAT1 -EXT.FOOT PROSTHESIS UPDATED`
- Catalogue number is currently represented in the XML as:
  - `udidi:referenceNumber`

## Latest Codebase Cleanup

- Removed the obsolete fixture-era PATCH scenario tree under:
  - `backend/tests/fixtures/xml_patch_scenarios`
- Removed stale fixture-anchor fields from `RegisteredDeviceAnchor`.
- Removed the unused combined baseline-pair download route and frontend client method:
  - `/api/xml/download-post-patch-pair`
- Active tests now rely on the current generated, SQLite-backed testing-state workflow, with legacy YAML used only for initial store seeding.

## Verification Notes

- Historical verification snapshots recorded above should be treated as dated evidence only.
- Re-run current verification from the present worktree before relying on pass counts.
- Latest current verification on Saturday, August 15, 2026:
  - focused workbook-import tests: `3 passed`
  - full backend suite: `61 passed`
  - frontend production build: `npm run build` passed
- Recommended backend command from the current repo layout:
  - `cd backend`
  - `PYTHONPATH=. ../.venv/bin/pytest -q`
- Recommended frontend command:
  - `cd frontend`
  - `npm run build`

## Frontend Testing Position

- The frontend currently has no configured test runner.
- Current automated frontend verification is limited to:
  - TypeScript compile
  - Vite production build
- Recommended future frontend stack:
  - `vitest`
  - `@testing-library/react`
  - `@testing-library/user-event`
  - `msw`
  - later `playwright` for a very small number of end-to-end flows
- Highest-value first frontend tests:
- `Patch XML` remains blocked until `Post + Patch` exists for the same selected record
- after redesign, `Patch XML` should instead remain blocked until the baseline `POST` exists for the same selected record
- PATCH version defaults to one greater than the latest successful tracked version
- trade name input seeds from latest successful tracked state rather than workbook row
- warning comment required only for `CW999`
  - storage-condition scenario requires at least one changed condition

## Proposed Database Direction

- Excel workbooks remain the upstream source files.
- SQLite is the current and planned application database for imported source state, testing state, and later canonical persistence.
- The application should read runtime testing state, accepted device state, submission history, and later generation workflows from SQLite rather than directly from workbook files or YAML.

### Minimal Proposed Schema

#### Import Layer

- `import_batch`
  - `id`
  - `source_type`
  - `label`
  - `imported_at`
  - `imported_by`
  - `notes`
- `source_workbook`
  - `id`
  - `import_batch_id`
  - `workbook_name`
  - `file_path`
  - `file_hash`
  - `loaded_at`
- `source_row`
  - `id`
  - `source_workbook_id`
  - `sheet_name`
  - `row_index`
  - `product_family`
  - `product_variant`
  - `catalogue_number`
  - `primary_udi_di`
  - `submission_operation`
  - `raw_payload_json`
  - `canonical_status`
  - `created_at`

#### Canonical Device Identity

- `device_subject`
  - `id`
  - `subject_key`
  - `product_family`
  - `product_variant`
  - `catalogue_number`
  - `primary_udi_di`
  - `basic_udi_di`
  - `current_source_row_id`
  - `created_at`
  - `updated_at`

#### Current Accepted State

- `device_current_state`
  - `id`
  - `device_subject_id`
  - `current_version`
  - `trade_name`
  - `storage_conditions_json`
  - `critical_warnings_json`
  - `last_successful_submission_id`
  - `updated_at`

#### Submission And Testing History

- `submission`
  - `id`
  - `device_subject_id`
  - `source_row_id`
  - `message_type`
  - `scenario_id`
  - `scenario_label`
  - `version`
  - `status`
  - `environment`
  - `transaction_id`
  - `submission_id`
  - `correlation_id`
  - `message_id`
  - `payload_created_at`
  - `tested_at`
  - `xml_file_name`
  - `xml_payload`
  - `zip_file_name`
  - `notes`
- `submission_change`
  - `id`
  - `submission_id`
  - `field_name`
  - `field_code`
  - `before_value`
  - `after_value`
  - `change_kind`

#### Optional Early Control Table

- `device_test_flags`
  - `device_subject_id`
  - `post_success`
  - `baseline_patch_success`
  - `exclude_from_post_wave`
  - `exclude_from_baseline_patch_wave`
  - `updated_at`

### Recommended Database Rules

- Never update `source_row` in place.
- Treat each workbook load as a new `import_batch`.
- Update `device_current_state` only from successful accepted submissions.
- Keep `submission` as the complete audit log.
- Keep generated XML payloads in the database initially unless size becomes a problem later.

### Suggested Migration Path From Today

1. Keep workbook parsing as-is.
2. Import parsed workbook rows into `source_row`.
3. Build `device_subject` from the current row-level device identity.
4. Move YAML `latest_successful_state` into `device_current_state`.
5. Move YAML `test_events` into `submission` and `submission_change`.
6. Switch the application to read current accepted state from the database rather than from YAML.

### Current Agreed Identity Direction

- `device_subject` should become the single stable device-identity table for the application.
- The next relational cleanup step is to stop treating testing-state tables as parallel identity stores.
- Specifically:
  - `reviewed_post_baselines` should gain `device_subject_id`
  - `testing_subjects` should gain `device_subject_id` or be replaced by a better history table tied to `device_subject`
- Transitional matching should still use:
  - `product_family`
  - `product_variant`
  - `catalogue_number`
  - fallback `primary_udi_di` when needed
- Steady-state application lookups should move from string matching to foreign-key joins once that linkage exists.

### Next Database Steps

1. Add SQLite-backed read endpoints for:
   - `device_subject` list and detail
   - `source_row` list and detail
   - filters by family, variant, catalogue number, submission operation, and import batch
2. Move the `Submission Data` workspace from summary-only database panels to real SQLite-backed record views.
3. Add `device_subject_id` to `reviewed_post_baselines` and backfill it from current text identity matching.
4. Add `device_subject_id` to `testing_subjects` or replace that table with a better linked testing-history structure.
5. Change reviewed-baseline and testing-state lookups from string matching to foreign-key joins.
6. After those links are stable, add canonical persistence tied to `device_subject`.
7. Only after the SQLite relational shape settles, introduce migration tooling if needed for controlled SQLite schema evolution.
7. Only after the SQLite relational shape settles, introduce migration tooling if needed for controlled SQLite schema evolution.

## Documentation Alignment

The current docs now need to describe:

- generated `Patch XML`
- current parent-record lineage
- reviewed baseline-pair gating
- before/after comparison as a current feature, not a future idea
- tracked-state scenario derivation for the initial testing phase

Files refreshed in this pass:

- `docs/session-handoff.md`
- `frontend/src/content/docs/xml-generation.md`
- `frontend/src/content/docs/eudamed-testing-generation-ui.md`
- `frontend/src/content/docs/eudamed-service-contract-findings.md`

## Current Schema-Version Note

- Local default message schema version is now `3.0.32`.
- Previous repo default was `3.0.30`.
- Local bundled `data/schemas/service/Message/MessageType.xsd` fixed value is also now `3.0.32`.
- Previous bundled fixed value was `3.0.30`.
- Optional testing override now exists:
  - `EUDAMED_MANUFACTURER_SRN_OVERRIDE`
  - intended for Playground actor alignment only
  - should remain easy to remove or change later
- Optional testing suppression now exists:
  - `EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE`
  - intended for Playground-only compatibility when the AR actor is not resolvable there
  - should remain easy to remove or change later
- Optional testing override now also exists:
  - `EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE`
  - intended to point XML generation at a Playground-valid AR SRN such as `DE-AR-000031681`
  - preferred over suppression when EUDAMED business rules require an AR for the submitting manufacturer
- Reason for temporary/default switch:
  - actual Playground validation error `E-I-40000` on Sunday, August 9, 2026 required `m:Push@version="3.0.32"`
- Public technical documentation observed during the same session still stated `v 3.0.30` for the published `XSD schemas.zip`.
- Treat this as a controlled operational hotfix until the local schema pack is fully refreshed, the published documentation catches up, or a later EUDAMED validator change requires another version adjustment.

## Still Missing

- persistence for PATCH scenario status (`EUDAMED Candidate` / `EUDAMED Accepted`)
- persistence for baseline-family acceptance state
- broader SQLite persistence for imported workbook rows, accepted device state, and Playground testing history
- automatic promotion of accepted PATCH scenarios into `EUDAMED Generation`
- redesign of baseline `Post + Patch` workspace into `POST` only
- hardening and test coverage for `Bulk PATCH`
- real Playground confirmation for `Bulk PATCH`
- real Playground confirmation for `MARKET_INFO.PUT`
- full manual feature-validation pass across all current workspaces before database work starts
- broader scenario library beyond the current implemented PATCH scenarios
- external confirmation that candidate scenarios are operationally accepted by EUDAMED
- workbook-drift detection between the reviewed baseline pair and newer workbook state
- any later decision on workbook-refreshed scenario PATCH regeneration

## Open Work / Next Steps

Focus next on making the current SQLite layer a real read model and extending it carefully:

1. add backend read endpoints for:
   - `device_subject` list and detail
   - imported `source_row` list and detail
   - filters by family, variant, catalogue number, operation, and import batch
2. move the `Submission Data` workspace to use those SQLite-backed endpoints for database panels rather than treating the import DB as summary-only storage
3. implement the next relational identity step:
   - add `device_subject_id` to `reviewed_post_baselines`
   - add `device_subject_id` to `testing_subjects` or replace that table with a better linked history structure
4. backfill those links using:
   - `product_family`
   - `product_variant`
   - `catalogue_number`
   - fallback `primary_udi_di`
5. switch testing-state and reviewed-baseline lookups from string matching to foreign-key joins
6. after the source/read-model layer is stable, add canonical persistence tied to `device_subject`
7. only after those relationships are stable, introduce migration tooling if needed for controlled SQLite schema evolution
