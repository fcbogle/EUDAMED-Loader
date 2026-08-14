# Session Handoff

## Current Objective

Continue refining the XML workspaces so the UI clearly separates:

- `EUDAMED Testing`
- `EUDAMED Generation`

while keeping `Patch XML` as a controlled testing workflow that:

- requires a reviewed baseline `POST` in the current session before scenario generation unlocks
- handles all PATCH generation, including an explicit `Equivalent First Patch` option
- derives version `2` PATCH drafts directly from the accepted `POST`
- derives version `3+` PATCH drafts from the latest successful tracked state for that device
- preserves device lineage by carrying the chosen parent `POST` record identity through scenario generation
- shows explicit before/after business comparison before XML generation
- shows toggle-based comparison between baseline and derived `PATCH` XML
- requires the user to enter the `e:version` integer for each later scenario draft
- keeps candidate PATCH testing conservative and separate from accepted generation patterns

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
  - harden and test `Bulk PATCH`
  - test `Market Info` update in Playground
  - implement database-backed persistence
  - refine the UI after the database-backed state model is in place

## Current Implemented Behavior

### EUDAMED Testing

Current pill order:

- `Post + Patch`
- `Patch XML`
- `Market Info`
- divider
- `Single XML`
- `Bulk Basic UDI POST`
- `Bulk UDI-DI POST`
- `Bulk PATCH`

Shared-device testing group:

- `Post + Patch`
- `Patch XML`
- `Market Info`

General XML tools:

- `Single XML`
- `Bulk Basic UDI POST`
- `Bulk UDI-DI POST`
- `Bulk PATCH`

### Post + Patch

- Uses the parent `POST` record determined by current selection logic:
  - the exact selected record if it is an XML-ready `POST`
  - otherwise the first available XML-ready `POST` in the selected variant
- Generates:
  - one baseline `POST`
  - one equivalent first child `PATCH`
- Validates both locally against the schema set.
- Provides explicit separate `POST` and `PATCH` ZIP downloads after preparation from one download action.
- As of Sunday, August 9, 2026, the baseline `POST` and equivalent first-child `PATCH` have both been accepted successfully in Playground for at least one tested device lineage.
- This is now the current implemented behavior, but it is no longer the agreed target design.
- Agreed target design:
  - this workspace should become `POST` only
  - it should generate only the registration `POST`
  - the equivalent first-child `PATCH` should move into `Patch XML` as an explicit PATCH option

### Patch XML

Current implementation is generated and record-driven.

It now:

- uses the current parent `POST` selection identified by:
  - `product_family`
  - `product_variant`
  - `catalogue_number`
- requires the user to generate and review the baseline `POST` first for that parent record
- keeps the `Patch XML` workspace visible, but should block generation and download until that reviewed baseline `POST` exists in the current session
- should support:
  - `Equivalent First Patch`
  - real first-update version `2` PATCH generation from accepted `POST`
  - later version `3+` PATCH generation from latest accepted tracked state
- current implementation still derives scenario drafts from the latest successful device state recorded in `data/testing/playground-tested-subjects.yaml` when available
  - and falls back to the baseline first child `PATCH` only when no later accepted state has been recorded for that device
- supports the active scenarios:
  - `trade_name_edit`
  - `warning_add`
  - `storage_condition_edit`
- requires explicit user-supplied `PATCH` version input
- shows:
  - baseline-versus-draft business comparison
  - draft readiness messaging
  - baseline-versus-derived XML toggle
  - generated XML change summary after preview
- validates generated XML locally and supports download

Important limitation:

- baseline-pair review state is in-memory only for the current session
- PATCH scenario status remains UI state only
- it is not persisted
- latest successful accepted device state is still persisted in YAML rather than in a database
- the current implementation still assumes the reviewed equivalent first-child `PATCH` as the starting point before later scenario drafting
- this is now an acknowledged design constraint to replace

### Market Info

- Uses the selected XML-ready record / shared testing anchor
- Generates one standalone `MARKET_INFO.PUT` message
- Validates locally and supports download

### Single XML / Bulk XML

- `Single XML` still operates from the broader XML-ready family/variant selection model.
- `Bulk Basic UDI POST` now represents parent registration waves only.
- In a parent wave, only the first eligible row for a given `Basic UDI-DI` should emit a `DEVICE.POST`; later duplicate-parent rows in that same wave should be omitted to avoid duplicate parent creation errors.
- `Bulk UDI-DI POST` now represents child registration waves only.
- In a child wave, each generated message should be a standalone `UDI_DI.POST` for one device under an already accepted parent `Basic UDI-DI`.
- The validated standalone child wrapper is `device:UDIDIData` with `xsi:type="udidi:MDRUDIDIDataType"`.
- `Bulk PATCH` is the next bulk mode and should reuse the same per-device accepted-state lineage rules as single-device `Patch XML`.
- Bulk modes do not use the in-memory reviewed baseline-pair gate used by the current single-device testing flow.

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
- This rule has now been validated by Playground behavior where repeated parent creation for the same `Basic UDI-DI` was rejected as a duplicate.

### Bulk UDI-DI POST

- Purpose: register multiple child UDI-DIs under an already accepted parent.
- Service profile: `UDI_DI.POST`.
- Message shape: standalone child registration payload, not parent `DEVICE.POST`.
- XML wrapper: `device:UDIDIData` with `xsi:type="udidi:MDRUDIDIDataType"`.
- Parent linkage is carried through `basicUDIIdentifier`; the parent `MDRBasicUDI` block is not repeated in this flow.
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
- `Patch XML` scenario generation stays blocked unless the reviewed baseline state in memory matches the same:
  - product family
  - product variant
  - catalogue number
- If the currently selected XML-ready row is not itself a `POST`, the current UI still falls back to the first available XML-ready `POST` in the selected variant.
- The UI no longer allows scenario generation from a variant without a reviewed baseline pair.

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

Candidate design-only scenarios now listed in the dropdown:

- `Sterilization`
- `Reprocessed`
- `Number Of Reuses`
- `MDN Codes`

Next implemented simple scenarios:

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
  - scenario-derived later `PATCH` payloads now use the latest successful tracked device state when available, falling back to the baseline first child `PATCH` otherwise
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
- Active tests now rely on the current generated, YAML-backed workflow only.

## Latest Verification

- Focused backend XML generation suite:
  - `PYTHONPATH=backend .venv/bin/python -m pytest -q backend/tests/test_echelon_xml_generation.py`
  - result: `18 passed`
- Full backend suite:
  - `PYTHONPATH=backend .venv/bin/python -m pytest -q backend/tests`
  - result: `32 passed`
- Frontend verification:
  - `npm run build`
  - result: passed

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
- PostgreSQL becomes the application source of truth after import.
- The application should read runtime testing state, accepted device state, submission history, and later generation workflows from PostgreSQL rather than directly from workbook files or YAML.

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
- persistence for baseline-pair review / existence state
- PostgreSQL-backed persistence for imported workbook rows, accepted device state, and Playground testing history
- automatic promotion of accepted PATCH scenarios into `EUDAMED Generation`
- redesign of baseline `Post + Patch` workspace into `POST` only
- hardening and test coverage for `Bulk PATCH`
- real Playground confirmation for `Bulk PATCH`
- real Playground confirmation for `MARKET_INFO.PUT`
- broader scenario library beyond the current implemented PATCH scenarios
- external confirmation that candidate scenarios are operationally accepted by EUDAMED
- workbook-drift detection between the reviewed baseline pair and newer workbook state
- any later decision on workbook-refreshed scenario PATCH regeneration

## Recommended Next Step

Focus next on proving the remaining testing workflows before replacing YAML with database-backed state:

1. harden `Bulk PATCH` against the currently tested device cohorts
2. test `Bulk PATCH` in Playground and record both successes and rejections
3. test `MARKET_INFO.PUT` in Playground and capture the accepted update pattern
4. implement database-backed persistence for:
   - imported workbook rows
   - current accepted device state
   - submission / Playground history
   - baseline review and scenario acceptance state
5. switch the application from YAML-backed accepted state to database-backed accepted state
6. refine the UI after the persistence model is in place so:
   - status and lineage messaging come from the database
   - bulk and single-device workspaces reflect persisted accepted state
   - later promotion and reporting flows can be added cleanly
