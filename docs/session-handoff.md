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

## Naming Convention

- Use `Basic UDI-DI` as the canonical operator-facing term for the shared regulatory parent context.
- Use `Device UDI-DI` as the canonical operator-facing term for the device-specific identifier for one registerable device record.
- `parent` and `child` may still be used as shorthand to describe the relationship between one `Basic UDI-DI` and its related `Device UDI-DI` records, but they are explanatory terms rather than the primary labels.
- `primary_udi_di` remains the current internal field and API property name, but in business and UI language it should be read as `Device UDI-DI`.
- `catalogue_number` remains a workbook and operator selection identifier; it is not the EUDAMED record identifier.

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
- `Patch XML` remains accessible as a workspace, but PATCH generation and download should stay blocked until the baseline `POST` has been generated and reviewed for the same selected device record in the current session.
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
  - selected device record lineage
  - reviewed baseline `POST` for that same record
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
  - `Bulk UDI-DI POST` now excludes `Device UDI-DI` values already known as successfully registered in tracked state
  - historical verification snapshot on Friday, August 14, 2026 and Saturday, August 15, 2026:
    - backend `pytest`: `58 passed`
    - frontend production build: `npm run build` passed
  - successful Playground test results are persisted in `data/testing/testing-state.sqlite3`, with historical seed data now extracted into `data/testing/testing-state-seed.sql`, and are documented in `docs/eudamed-playground-test-report.md`
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
- refined `POST` direction confirmed on Wednesday, August 19, 2026:
  - the `POST` workspace should present the next single available `Device UDI-DI` record for the selected family and variant
  - if the parent `Basic UDI-DI` is already registered, the UI should explain that available `Device UDI-DI` records can be posted under that registered parent
  - the UI should not anchor `POST` to an arbitrary selected or first XML-ready `POST` row if that exact child device is already registered
  - if no further `Device UDI-DI` records are available for `POST`, the UI should say so explicitly
  - refined `PATCH` direction confirmed on Wednesday, August 19, 2026:
    - `Patch XML` should stay record-based rather than family-based
    - one PATCH flow should always target one exact child device lineage
    - the system should not infer a PATCH target from family and variant alone when multiple sibling child devices exist
    - the resolved PATCH target should remain stable across assessment, preview, download, and later response handling
- implemented `POST` shape refinement confirmed on Thursday, August 20, 2026:
  - single `POST` now emits `DEVICE.POST` when the parent `Basic UDI-DI` is not yet registered
  - single `POST` now emits child-only `UDI_DI.POST` when the parent `Basic UDI-DI` is already registered and the `Device UDI-DI` is still available
  - the child-only payload still references the registered parent through `basicUDIIdentifier`
- latest implemented UI and persistence refinements on Friday, August 21, 2026 and Saturday, August 22, 2026:
  - single `POST` preview now uses a dedicated full-width card layout with:
    - title and right-aligned action row
    - compact preview status strip
    - four metadata cards
    - XML structure navigator
    - highlighted raw XML preview
  - single `POST` now includes an `Upload Success XML` action in the preview workspace
  - the backend now exposes `/api/xml/upload-success-xml`
  - that endpoint currently accepts successful EUDAMED acknowledgement XML for:
    - `DEVICE.POST`
    - `UDI_DI.POST`
  - the upload endpoint now:
    - parses the acknowledgement XML
    - rejects non-`SUCCESS` acknowledgements
    - resolves the tracked subject by:
      - `basic_udi_di` for `DEVICE.POST`
      - `primary_udi_di` for `UDI_DI.POST`
    - records the success idempotently in `testing_events`
    - marks `testing_subjects.post_success = 1`
  - the frontend sends uploaded success XML as JSON payload content rather than multipart form data to avoid introducing `python-multipart`
  - single `POST` scope and count pills were refined to use exact tracked-success differences rather than broad XML-ready totals
  - single `PATCH` preview now follows the same visual language as single `POST`:
    - full-width preview card
    - right-aligned action row
    - compact preview status strip
    - four metadata cards
    - XML structure navigator
    - highlighted raw XML preview
  - single `PATCH` no longer exposes the earlier `Base Message` / `Derived Patch` toggle in the main preview
  - single `PATCH` now presents one derived PATCH preview path only in the primary preview card
  - redundant single-PATCH review and validation subpanels beneath the preview were removed so the preview card is the main source of preview/validation state
  - current agreed code-structure direction:
    - continue converging single `POST` and single `PATCH` UI first
    - only then refactor `frontend/src/App.tsx`
    - the intended refactor boundary is shared preview/layout primitives reusable by:
      - single `POST`
      - single `PATCH`
      - `Bulk Basic UDI POST`
      - `Bulk UDI-DI POST`
      - `Bulk PATCH`
  - current important design conclusion on Saturday, August 22, 2026:
    - do not assume EUDAMED Playground mirrors Production registration state
    - workbook/import business state and Playground testing evidence should remain distinct concepts
    - this means current PATCH gating should not be redesigned solely on the basis of Playground visibility gaps
    - however, the current implemented PATCH gate still relies on SQLite-tracked POST lineage and does not yet promote workbook-declared PATCH/registered state into that accepted-state model
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

Current visual direction:

- single `POST` and single `PATCH` should use the same card language and theme
- action-heavy XML workspaces should prefer:
  - one primary preview card
  - compact status/meta strips
  - fewer duplicated review/validation panels
- future refactoring should extract these shared UI primitives rather than duplicating more mode-specific JSX inside `frontend/src/App.tsx`

Current directional design intent:

- `EUDAMED Testing` should evolve from a mode selector into a process-aware operations workspace.
- The primary user flow should become:
  - choose operation type
  - choose `Product Family`
  - choose `Variant`
  - let the backend assess the current SQLite-backed situation
  - present the valid next action with supporting counts and reasons
- The system should define the situation for the user rather than expecting the user to infer it from low-level XML tooling.
- The backend now exposes explicit SQLite-backed operation-readiness assessments for:
  - parent `POST`
  - child `POST`
  - single-device `PATCH`
  - `Bulk PATCH`
- Current active assessment coverage is represented by:
  - `single_post`
  - `single_patch`
  - `bulk_post`
  - `bulk_patch`
- `Market Info` remains present as an XML workspace, but its operational assessment is still deferred and is not yet driven by the newer backend assessment contract.
- `Market Info` assessment remains deferred.
- Those assessments are SQLite-backed and should describe:
  - eligible record counts
  - required identity scope such as `Basic UDI-DI` or child `UDI-DI`
  - blocking reasons
  - recommended next action
- Keep the operation-specific rule sets explicit; do not collapse this into one opaque generic workflow engine.

Current first implementation contract for operation assessment:

- one backend endpoint per active operation type is now implemented and the payload shape stays consistent across them
- the active operation types are:
  - `single_post`
  - `single_patch`
  - `bulk_post`
  - `bulk_patch`
- deferred:
  - `single_market_info`
  - `bulk_market_info`

Recommended shared assessment payload:

- `operation_type`
  - one of the active operation identifiers above
- `product_family`
- `product_variant`
- `status`
  - `available`
  - `blocked`
  - `attention`
- `summary_message`
  - short user-facing sentence in plain English
- `blocking_reasons`
  - flat list of simple user-facing reasons
- `recommended_next_action`
  - short action label such as:
    - `Generate POST`
    - `Use Bulk UDI-DI POST`
    - `Review accepted PATCH lineage`
    - `Select a posted parent group`
- `eligible_record_count`
  - integer count for the operation as currently selected
- `identity_scope`
  - operation-specific identity context such as:
    - `catalogue_number`
    - `primary_udi_di`
    - `basic_udi_di`
    - selected parent group
- `evidence`
  - structured supporting facts used by the UI, not raw SQL state

Recommended operation-specific evidence payloads:

- `single_post`
  - `candidate_catalogue_number`
  - `candidate_primary_udi_di`
  - `candidate_basic_udi_di`
  - `parent_registration_known`
  - `child_registration_known`
  - `xml_ready`
- `single_patch`
  - `catalogue_number`
  - `primary_udi_di`
  - `basic_udi_di`
  - `tracked_registration_known`
  - `latest_accepted_version`
  - `latest_successful_scenario_id`
  - `reviewed_post_baseline_present`
- `bulk_post`
  - `eligible_parent_group_count`
  - `eligible_child_record_count`
  - `posted_parent_group_count`
  - `unposted_parent_group_count`
  - `available_basic_udi_di_groups`
- `bulk_patch`
  - `eligible_parent_group_count`
  - `selected_basic_udi_di`
  - `eligible_child_record_count`
  - `latest_version_summary`
  - `available_parent_groups`

Recommended plain-language blocking messages:

- `single_post`
  - `This parent Basic UDI-DI is already registered. Use child POST instead.`
  - `This Device UDI-DI is already registered, so a new POST is not available.`
- `single_patch`
  - `This device does not yet have a tracked successful registration, so PATCH is not available.`
  - `No accepted version state is available for this device lineage.`
- `bulk_post`
  - `All parent Basic UDI-DI groups are already registered.`
  - `No new Device UDI-DI records remain for this variant.`
- `bulk_patch`
  - `No posted child devices are currently available under the selected parent.`
  - `Select a posted parent group before generating Bulk PATCH.`

Recommended implementation rule:

- the existing UI can be retained and reused
- after the user selects:
  - `Device Family`
  - `Variant`
  - `Operation`
- the backend assessment should be loaded first
- preview, generate, and download controls should then be enabled only when the assessment says the operation is currently possible

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
- Current implemented `POST` message-shape behavior is:
  - if the parent `Basic UDI-DI` is not yet registered, emit parent-style `DEVICE.POST`
  - that `DEVICE.POST` contains one `MDRBasicUDI` parent registration and one `MDRUDIDIData` child registration for the chosen candidate
  - if the parent `Basic UDI-DI` is already registered, emit child-only `UDI_DI.POST`
  - that `UDI_DI.POST` contains only the child `UDIDIData` payload and references the existing parent through `basicUDIIdentifier`
- The current intended `POST` UX is:
  - resolve the next available `Device UDI-DI` candidate for the selected family and variant
  - if the parent `Basic UDI-DI` is already registered, present that candidate as a device registration under the existing parent
  - do not present an arbitrary selected `POST` row if that exact `Device UDI-DI` is already registered
  - if no further `Device UDI-DI` candidates remain, present an explicit no-candidate message rather than implying the wrong record can be posted
- Current single `POST` selection rules are:
  - if both parent `Basic UDI-DI` and child `UDI-DI` are already known, the record is skipped
  - if the parent is known but the child is not, single `POST` should present that child as the next available `POST` candidate under the registered parent
  - if neither parent nor child is known, that record may be offered as a genuine new registration candidate
- Current single `POST` preview UI now:
  - uses a dedicated full-width preview card
  - includes:
    - `Generate POST`
    - `Validate Against XSD`
    - `Download POST ZIP`
    - `Upload Success XML`
  - presents:
    - preview status
    - active view
    - validation status
    - schema target
    - generated file name
    - XML structure navigation
    - highlighted raw XML preview
- `POST` success XML upload is now part of the implemented workflow:
  - upload uses `/api/xml/upload-success-xml`
  - accepted message types:
    - `DEVICE.POST`
    - `UDI_DI.POST`
  - re-uploading the same acknowledgement should be idempotent rather than duplicating events
- Validates locally against the schema set.
- Supports `POST` ZIP download.
- The old combined `Post + Patch` baseline workspace is no longer the user-facing design and should be treated as replaced by `POST` plus `Patch XML`.

### Patch XML

Current implementation generates PATCH XML from one exact device record lineage.

It now:

- uses the current selected record identified by:
  - `product_family`
  - `product_variant`
  - `catalogue_number`
- treats that selected record as one exact child-device lineage, not as a general family-level PATCH request
- anchors PATCH generation to one exact identity set:
  - `catalogue_number`
  - `Device UDI-DI`
  - parent `Basic UDI-DI`
  - latest accepted tracked state for that same device
- requires the user to generate and review the baseline `POST` first for that same selected device record
- also requires tracked successful Playground registration for that same device before a version `2` `PATCH` can be drafted
- keeps the `Patch XML` workspace visible, but should block generation and download until that reviewed baseline `POST` exists in the current session
- should support:
  - `Equivalent First Patch`
  - real first-update version `2` PATCH generation from accepted `POST`
  - later version `3+` PATCH generation from latest accepted tracked state
- current implementation derives scenario drafts from the latest successful device state resolved through the testing-state store, currently backed by `data/testing/testing-state.sqlite3`
  - runtime app behavior should now treat SQLite as the active source of truth rather than auto-reading YAML when the store is empty
  - current tests now seed temporary SQLite state from `data/testing/testing-state-seed.sql`
  - scenario derivation falls back to the baseline first child `PATCH` only when no later accepted state has been recorded for that device
- current scenario status:
  - implemented and Playground-successful: `equivalent_first_patch`, `trade_name_edit`, `warning_add`, `storage_condition_edit`, `base_quantity_edit`
  - implemented but not Playground-accepted: `status_code_edit`
  - blocked by Playground business rules: `sterile_edit`, `latex_edit`
  - present in the UI but still unimplemented / untested: `production_identifier_edit`, `sterilization_edit`, `reprocessed_edit`, `number_of_reuses_edit`, `mdn_codes_edit`
- requires explicit user-supplied `PATCH` version input
- current single `PATCH` preview UI now:
  - uses a dedicated full-width preview card matching the single `POST` card language
  - includes:
    - `Generate Patch Scenario`
    - `Validate Against XSD`
    - `Download Patch Scenario ZIP`
  - presents:
    - preview status
    - active view
    - validation status
    - schema target
    - generated file name
    - XML structure navigation
    - highlighted raw XML preview
  - no longer uses the earlier `Base Message` / `Derived Patch` toggle in the main preview
  - now treats the primary preview as one derived PATCH preview path
- shows in the scenario/config workspace:
  - baseline-versus-draft business comparison
  - draft readiness messaging
  - generated XML change summary after preview
- validates generated XML locally and supports download

Current implemented limitation and wording note:

- current single `PATCH` availability still depends on the SQLite-backed accepted-state model, not directly on workbook-declared `PATCH` rows
- as of Saturday, August 22, 2026, this means some families/variants may show many workbook/canonical `PATCH` rows but zero PATCH-ready records in the current implemented design
- current tracked count snapshot from SQLite-backed testing state:
  - `17` tracked PATCH-base records overall
  - `0` for `Echelon / Echelon`
- this is an acknowledged mismatch between:
  - workbook/import business classification
  - SQLite-tracked accepted lineage used by the current PATCH gate
- current design decision:
  - do not redesign this solely because Playground may not reflect Production registrations
  - revisit wording first
  - revisit accepted-state import/promotion later as a distinct architecture decision

Record-based meaning:

- `Patch XML` should not silently switch between sibling devices within the same family and variant.
- The chosen PATCH target should remain the same record from assessment through XML generation.
- The UI may use family and variant to narrow the available records, but the actual PATCH lineage must resolve to one exact child device record before generation.
- Version `2` PATCH should derive from the accepted baseline `POST` for that exact record.
- Version `3+` PATCH should derive from the latest accepted tracked `PATCH` for that exact record.
- Response handling should later update tracked state against that same exact record lineage.

Important limitation:

- reviewed baseline `POST` state is persisted in the testing-state SQLite store, not only in-memory
- PATCH scenario promotion state such as `EUDAMED Candidate` versus `EUDAMED Accepted` still remains UI/application state rather than a broader workflow model
- the testing-state store is SQLite-backed today and is expected to evolve within SQLite rather than be replaced by a different database platform
- later scenario drafting still assumes an equivalent-first accepted `PATCH` baseline when no later accepted `PATCH` state has been recorded for that exact record
- this is now an acknowledged design constraint to replace
- `frontend/src/App.tsx` has improved visually but still contains substantial mode-specific branching
- once single `POST` and single `PATCH` wording stabilise, refactor `frontend/src/App.tsx` by extracting shared preview/layout primitives rather than continuing to add inline mode-specific branches

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

- Purpose: register multiple `Device UDI-DI` records under an already accepted `Basic UDI-DI`.
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
- This flow has now been validated in Playground for five `Device UDI-DI` records under one accepted `Elite VT` `Basic UDI-DI`.

### Bulk PATCH

- Purpose: apply the same approved PATCH scenario across several already registered child devices.
- Dependency: all targeted `Device UDI-DI` records must already exist in Playground.
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
- The UI no longer allows scenario generation from a variant without a reviewed baseline pair.
- Bulk parent existence is now resolved from successful tracked testing state via the testing-state store.
- Bulk Basic UDI POST and Bulk UDI-DI POST router stops now return `400` rather than `404`.
- Single `POST` now resolves and presents the next assessed candidate rather than relying on an arbitrary first XML-ready row.

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

- verify the current operation-assessment UI text for:
  - single `POST`
  - single `PATCH`
  - `Bulk Basic UDI POST`
  - `Bulk UDI-DI POST`
  - `Bulk PATCH`
- continue refining the plain-language readiness and blocking messages so they describe the actual record or cohort being assessed
- design SQLite-backed replacement of the remaining YAML-driven testing-history reads before changing response-processing behavior
- continue Playground testing for:
  - child-only `UDI_DI.POST`
  - record-based `PATCH`
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
- Active tests now rely on the current generated, SQLite-backed testing-state workflow, with historical test data seeded from `data/testing/testing-state-seed.sql`.

## Verification Notes

- Historical verification snapshots recorded above should be treated as dated evidence only.
- Re-run current verification from the present worktree before relying on pass counts.
- Latest current verification on Friday, August 21, 2026:
  - full backend suite: `85 passed`
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
  - `Patch XML` remains blocked until the baseline `POST` exists for the same selected record
  - operation assessment cards render the correct status, reasons, and next action after family, variant, and operation selection
  - single `POST` renders the assessed next candidate rather than an arbitrary XML-ready row
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
4. Move historical accepted-state snapshots into `device_current_state`.
5. Move historical testing events into `submission` and `submission_change`.
6. Switch the application to read current accepted state from the database rather than from any legacy file-based testing artifact.

### Current Agreed Identity Direction

- `device_subject` should become the single stable device-identity table for the application.
- The current repo already links testing-state tables toward that identity model:
  - `reviewed_post_baselines` already has `device_subject_id`
  - `testing_subjects` already has `device_subject_id`
  - the SQLite store backfills those links where possible on startup / schema ensure
- The next relational cleanup step is to stop treating testing-state tables as parallel identity stores even though those linkage columns now exist.
- Transitional matching should still use:
  - `product_family`
  - `product_variant`
  - `catalogue_number`
  - fallback `primary_udi_di` when needed
- Steady-state application lookups should move from string matching to foreign-key joins once that linkage exists.

### Next Database Steps

1. Replace the remaining YAML-dependent testing-history reads with SQLite-backed reads tied to `device_subject` lineage.
2. Reduce reviewed-baseline and testing-state lookups that still rely on text matching in favor of `device_subject_id` joins where practical.
3. Shape a clearer submission / testing-history model in the main SQLite application database rather than leaving testing history as a parallel architecture concern.
4. Expand canonical persistence tied to `device_subject` only after the testing-history lineage is stable.
5. Only after the SQLite relational shape settles, introduce migration tooling if needed for controlled SQLite schema evolution.

## Documentation Alignment

The current docs now need to describe:

- generated `Patch XML`
- current exact-record lineage
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
- broader SQLite persistence for accepted device state and submission / Playground testing history in the main application model
- automatic promotion of accepted PATCH scenarios into `EUDAMED Generation`
- hardening and test coverage for `Bulk PATCH`
- real Playground confirmation for `MARKET_INFO.PUT`
- full manual feature-validation pass across all current workspaces against the current SQLite-backed design
- broader scenario library beyond the current implemented PATCH scenarios
- external confirmation that candidate scenarios are operationally accepted by EUDAMED
- workbook-drift detection between the reviewed baseline pair and newer workbook state
- any later decision on workbook-refreshed scenario PATCH regeneration

## Open Work / Next Steps

Focus next on consolidating the remaining testing architecture onto SQLite and extending it carefully:

1. replace the remaining YAML-dependent testing-history reads with SQLite-backed reads
2. keep aligning testing history, reviewed baselines, and operation assessment around `device_subject` lineage
3. reduce text-matched lineage resolution where `device_subject_id` joins are now available
4. design the next SQLite-backed submission / response model so successful EUDAMED responses can update tracked state cleanly
5. after the testing-history model is stable, extend canonical and accepted-state persistence tied to `device_subject`
6. only after those relationships are stable, introduce migration tooling if needed for controlled SQLite schema evolution
