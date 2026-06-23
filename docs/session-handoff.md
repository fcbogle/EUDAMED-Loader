# Session Handoff

## Current Objective

Continue refining the XML workspaces so the UI clearly separates:

- `EUDAMED Testing`
- `EUDAMED Generation`

while evolving `Patch XML` from static fixture review toward a controlled scenario-based testing workflow that:

- lets the user select any product variant
- establishes one baseline `POST` parent record for that selected variant
- builds on the existing generated `Post + Patch` pair for that parent record
- uses the proven first child `PATCH` from that pair as the baseline for later PATCH scenario tests
- supports before/after review for approved operational PATCH scenarios
- uses toggle-based baseline-versus-derived PATCH XML comparison
- requires the user to provide the `e:version` integer for each scenario PATCH draft
- evolves batch generation toward explicit `POST Batch` and scenario-driven `PATCH Batch` workflows
- does not overstate EUDAMED acceptance

## Latest Confirmed Decisions

The current design direction is now explicitly:

- `POST` version `1`
- equivalent first child `PATCH` version `2`
- later scenario PATCH drafts inherit from that proven first `PATCH`
- the user enters the version integer for each scenario PATCH draft based on the current EUDAMED playground state

The practical workflow model is:

- select product family and variant
- resolve any available `POST` record for that variant
- use the existing generated `Post + Patch` pair as the baseline chain
- derive approved scenario PATCH drafts from the baseline first `PATCH`
- expose business-field before/after comparison
- expose toggle-based XML comparison between:
  - baseline first `PATCH`
  - derived scenario `PATCH`

Initial generated scenario scope should align with the already generated fixture-backed tests:

- `Trade Name Edit`
- `Critical Warnings`
- `Storage Condition Edit`

Deferred scenario:

- `Secondary Identifier Add`
  - still incomplete
  - no generated XML fixture yet

Observed fixture deltas confirm that current candidate scenarios differ from the baseline first `PATCH` only in:

- `Trade Name Edit`
  - `e:version`
  - `udidi:tradeNames/.../lsn:textValue`
- `Critical Warnings`
  - `e:version`
  - one added `udidi:criticalWarnings/commondi:warning`
- `Storage Condition Edit`
  - `e:version`
  - selected `udidi:storageHandlingConditions/.../lsn:textValue` comment values

## Completed In Recent Sessions

- Renamed the former XML workspace to `EUDAMED Testing`.
- Added a new top-level `EUDAMED Generation` area for accepted-only patterns.
- Added `Patch XML` to the testing workspace.
- Added the two UI status labels:
  - `EUDAMED Candidate`
  - `EUDAMED Accepted`
- Seeded the initial PATCH scenario registry with:
  - `trade_name_edit`
  - `warning_add`
  - `storage_condition_edit`
- Kept `secondary_identifier_add` out of the active scenario list because it is still incomplete.
- Wired `Patch XML` to fixture-backed preview and download using `backend/tests/fixtures/xml_patch_scenarios/...`
- Added a shared `Registered Device Anchor` concept to the backend and frontend.
- Aligned `Post + Patch`, `Patch XML`, and `Market Info` so they all use the same registered device anchor in `EUDAMED Testing`.
- Left `Single XML` and `Batch XML` on the broader family/variant XML-ready selection model.
- Added visual separation in the testing pill row:
  - `Post + Patch`, `Patch XML`, `Market Info`
  - vertical divider
  - `Single XML`, `Batch XML`
- Restricted the `Registered Device Anchor` panel so it appears only for the shared-device testing modes:
  - `Post + Patch`
  - `Patch XML`
  - `Market Info`
- Added fixture consistency tests so PATCH scenarios must match the baseline device identity.
- Refreshed the frontend documentation pages so they now match the current shared-anchor testing model and pill grouping.
- Fixed the `EUDAMED Testing` selection bug so `Post + Patch` and `Market Info` now follow the currently selected product family/variant record instead of always falling back to the Echelon VAC fixture anchor.

## Code Changes Made

Frontend:

- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/types.ts`
- `frontend/src/styles.css`
- `frontend/src/content/docs/eudamed-testing-generation-ui.md`
- `frontend/src/content/docs/xml-generation.md`

Backend:

- `backend/app/routers/xml_generation.py`
- `backend/app/services/xml_generation.py`
- `backend/app/xml_models.py`
- `backend/tests/test_echelon_xml_generation.py`
- `backend/tests/test_xml_patch_fixtures.py`

## Current UI Behavior

### EUDAMED Testing

Top-level area for comparison, validation, and candidate XML review.

Current pills:

- `Post + Patch`
- `Patch XML`
- `Market Info`
- divider
- `Single XML`
- `Batch XML`

Shared-device testing group:

- `Post + Patch`
- `Patch XML`
- `Market Info`

Current implemented behavior is now mixed:

- `Patch XML` still uses the shared fixture-backed `Registered Device Anchor`, currently backed by:
  - family id: `echelon-echelon-vac-EVAC22L1S`
  - baseline fixture: `equivalent_baseline/echelon-echelon-vac-EVAC22L1S`
  - product family: `Echelon`
  - product variant: `Echelon VAC`
  - catalogue number: `EVAC22L1S`
  - primary UDI-DI: `05050649062025`
- `Post + Patch` and `Market Info` now follow the currently selected product family / product variant record in the testing UI rather than always using the Echelon VAC fallback anchor.

`Patch XML` now:

- shows one candidate PATCH scenario at a time
- uses the shared registered device anchor
- loads existing fixture XML for preview
- validates that fixture XML against the local schema set
- supports download of the fixture XML
- allows the user to switch displayed status between `EUDAMED Candidate` and `EUDAMED Accepted` in the UI

Important limitation:

- PATCH scenario status is still UI state only
- it is not persisted

General XML tools:

- `Single XML`
- `Batch XML`

These do not use the registered device anchor. They still use the broader current XML-ready family/variant selection model.

### Current Concern About General XML Modes

Latest design thinking is that:

- `Single XML` may no longer be pragmatic as a long-term first-class mode
- `Batch XML` remains necessary
- the batch direction should become operation-aware rather than one generic mixed batch mode

Working direction:

- `Single XML` may be demoted to a temporary engineering / QA preview tool or removed later from the primary user workflow
- generic `Batch XML` should likely evolve into explicit `POST Batch` and `PATCH Batch` options

## Latest PATCH XML Design Direction

The current fixture-backed `Patch XML` flow is no longer the desired end state.

The intended direction is to evolve `Patch XML` into a controlled scenario-based drafting workflow inside `EUDAMED Testing`.

### Core Design Intent

The user should be able to:

- select any product family and product variant
- have the UI resolve one concrete `POST` parent record for that variant
- use the existing generated `Post + Patch` pair for that same record as the baseline chain
- choose from a whitelist of confirmed operational PATCH scenarios
- enter the version integer for the scenario PATCH draft
- see a before/after business-field view
- see a toggle-based XML comparison between baseline first `PATCH` and derived scenario `PATCH`
- edit only the fields allowed for the chosen scenario
- generate a new candidate PATCH XML for review, validation, and download

### Recommended Anchor Model

The preferred model is now a `variant-scoped POST parent with baseline PATCH chain`.

This means:

- the user selects a product family and variant
- the application resolves one available `POST` record for that variant
- that record becomes the active parent baseline
- the application reuses the existing generated `Post + Patch` pair for that parent
- all PATCH scenario drafts for that testing session derive from the same baseline first `PATCH`
- if the user changes variant, the testing anchor changes too
- changing variant should clear any unsaved PATCH draft scenario state tied to the previous variant

Recommended user message on variant change:

- `Changing product variant will switch the testing anchor device and clear any unsaved PATCH draft scenario.`

This is preferred over a manual lock/unlock workflow because it keeps the user flow simple while preserving traceability.

### Confirmed Scenario-Driven PATCH Approach

`Patch XML` should move away from:

- static selection of one pre-generated fixture XML per scenario

and toward:

- selection of one approved operational scenario type
- reuse of the existing generated first child `PATCH` as the baseline
- explicit user-supplied PATCH version input
- controlled field editing for that scenario only
- generation of a new candidate PATCH XML from the baseline first `PATCH` plus user-provided change values

### Example Target Workflow

Example for `Trade Name Edit`:

1. User selects product family and variant.
2. Application resolves one available `POST` record for that variant.
3. Application reuses the existing generated `Post + Patch` pair for that same record.
4. The baseline child `PATCH` remains version `2`.
3. User opens `Patch XML`.
4. User chooses `Trade Name Edit` from a scenario dropdown.
5. User enters the next PATCH version integer based on the EUDAMED playground state.
6. UI shows:
   - current trade name
   - new trade name input
   - baseline PATCH version `2`
   - proposed scenario PATCH version
   - before / after comparison
   - toggle-based XML comparison between baseline and derived PATCH
7. Backend generates a new candidate PATCH XML targeting that same device record lineage.
8. UI shows XML preview, local XSD validation, and download.

### Why This Direction Was Chosen

This keeps testing clearer and more operationally realistic because:

- all PATCH scenarios for a selected variant point to the same underlying device record
- it is obvious which registered device is being updated
- scenario comparisons are easier because only the approved changed field varies
- it avoids turning `Patch XML` into a generic XML editor

### Recommended Initial Whitelist

The initial approved operational scenario list should stay narrow, for example:

- `Trade Name Edit`
- `Warning Add`
- `Storage Condition Edit`
- later `Secondary Identifier Add`
- later one additional plain-text maintenance scenario such as device description or intended purpose text

### Recommended Generation Strategy

Preferred first implementation strategy:

- build on the existing generated `Post + Patch` pair
- treat the baseline first child `PATCH` as the scenario derivation source
- apply controlled scenario-specific overrides plus a user-supplied version integer

Preferred first implementation does **not** require:

- a generic XML editor
- arbitrary XPath-level patching
- fully freeform PATCH authoring

## Latest Batch XML Direction

The current single `Batch XML` mode is now viewed as an intermediate step rather than the desired end-state design.

### Recommended Batch Split

The XML workspace should likely evolve toward:

- `Post + Patch`
  - record-level testing / comparison
- `Patch XML`
  - single-record approved scenario drafting and testing
- `POST Batch`
  - variant-level batch generation for create flows
- `PATCH Batch`
  - variant-level batch generation for approved update scenarios

This is preferred over one generic batch mode because POST and PATCH represent different operational intents and different generation rules.

### Single XML Position

Current thinking is that `Single XML` may no longer be a pragmatic long-term business-facing mode because:

- `Post + Patch` already provides stronger record-level testing for create/update comparison
- `Patch XML` is evolving into the controlled single-record update workflow
- operational preparation is more likely to be variant-scoped batch generation

Tentative direction:

- keep `Single XML` only if it remains useful as an engineering / QA / debug preview
- otherwise retire or demote it from the primary XML workflow

### POST Batch Intent

`POST Batch` should mean:

- generate all POST-classified XML-ready records for the selected product family / variant
- produce a batch package in the same message/package style as the established POST/PATCH XML generation patterns

### PATCH Batch Intent

Current preferred interpretation of `PATCH Batch` is **scenario-driven PATCH batch generation**, not just a generic batch of any PATCH-classified source rows.

That means:

- select product family and variant
- choose an approved PATCH scenario type, for example `Trade Name Edit`
- enter the scenario change values or rule
- apply that same approved change pattern across all applicable records in the selected variant
- generate a batch package of PATCH XML messages for those affected records

Example:

- choose product variant
- choose `PATCH Batch`
- choose approved scenario `Trade Name Edit`
- provide a new trade name or approved update rule
- generate PATCH XML messages for all applicable device records in that variant that require the trade-name update

### Important PATCH Batch Rule

`PATCH Batch` should **not** mean:

- blindly update every record in the selected variant

It should mean:

- update every **applicable** record in the selected variant for the chosen approved scenario

This implies the UI and backend should eventually support:

- approved scenario selection
- applicability rules
- before / after summary
- affected-record count
- clear preview of what will change before package generation

### Important Distinction

Even after this evolution:

- generated scenario drafts should remain `EUDAMED Candidate` by default
- only externally confirmed patterns should move into `EUDAMED Generation`
- `Patch XML` should remain a testing workspace, not an operational upload workflow

### EUDAMED Generation

Top-level area for accepted-only XML generation.

Current state:

- only `Post + Patch` is surfaced here
- candidate PATCH scenarios do not yet appear here, even if the UI label is switched to `EUDAMED Accepted`

## Confirmed Design Facts

- The application is still a preparation/review tool, not a live submission system.
- Current accepted testing baseline remains:
  - `POST -> DEVICE.POST`
  - `PATCH -> UDI_DI.PATCH`
- Equivalent first `PATCH` should keep `marketInfos` identical to the equivalent `POST`.
- All PATCH scenarios under `backend/tests/fixtures/xml_patch_scenarios` should relate to the same registered base device for a given scenario family.
- `Post + Patch`, `Patch XML`, and `Market Info` should all be testable against that same registered device after successful POST registration.
- `Single XML` and `Batch XML` are separate general XML tools and should remain visually separated from the shared-device testing modes.
- Only truly `EUDAMED Accepted` patterns should appear in the operational generation area.

## Fixture-Backed PATCH Scenario Facts

Current supported fixture-backed candidate scenarios:

- `trade_name_edit`
- `warning_add`
- `storage_condition_edit`

Current inactive scenario:

- `secondary_identifier_add`
  - still incomplete
  - no generated XML file declared
  - status remains pending

Baseline fixture:

- `backend/tests/fixtures/xml_patch_scenarios/equivalent_baseline/echelon-echelon-vac-EVAC22L1S`

Guardrail now enforced:

- active PATCH scenario fixtures must match the baseline fixture identity:
  - `baseline_fixture`
  - `product_family`
  - `product_variant`
  - `catalogue_number`

Priority PATCH tests most likely to occur in practice:

- `trade_name_edit`
  - common maintenance change where device identity stays the same but commercial text changes
- `warning_add`
  - likely after post-market review or labeling updates
- `storage_condition_edit`
  - likely where storage or handling wording needs correction or clarification
- `secondary_identifier_add`
  - important future scenario because traceability identifiers may be added after initial registration
- one additional plain-text maintenance edit
  - likely candidates include intended-purpose text or device-description text updates

## Test Status

Commands run:

```bash
cd frontend && npm run build
cd backend && ../.venv/bin/python -m pytest -q tests/test_echelon_xml_generation.py tests/test_xml_patch_fixtures.py
```

Results:

- frontend production build passed
- targeted backend XML generation and PATCH fixture tests passed
- frontend documentation markdown imports also built successfully after refresh

## Still Missing

- persistence for PATCH scenario status (`EUDAMED Candidate` / `EUDAMED Accepted`)
- persistence for baseline-family acceptance state
- automatic promotion of accepted PATCH scenarios into `EUDAMED Generation`
- live scenario generation from canonical/device data instead of reading fixed XML fixture files
- scenario-template generation from a variant-scoped testing anchor plus controlled field overrides
- before/after PATCH field comparison UI
- per-scenario input forms for approved operational PATCH scenarios
- explicit reset behavior when the selected product variant changes
- XML mode redesign for explicit `POST Batch` and `PATCH Batch`
- decision on whether `Single XML` is retained as an engineering-only tool or removed from the primary workflow
- scenario-driven `PATCH Batch` generation across all applicable records in a selected variant
- batch-level before / after summaries and affected-record reporting for approved PATCH scenarios
- broader PATCH scenario support beyond the current three generated fixtures
- completion of `secondary_identifier_add`
- implementation of a fifth high-likelihood plain-text PATCH scenario
- externally confirmed EUDAMED acceptance for the three candidate PATCH scenarios
- operational design for more than one variant-scoped testing anchor family
- official sample XML files:
  - `SAMPLE_DTX_UDI_007.01.xml`
  - `SAMPLE_DTX_UDI_007.02.xml`

## Open Operational Note

PATCH scenario generation and PATCH batch generation will need explicit handling for the XML `version` field.

Current note to retain:

- baseline `POST` is version `1`
- baseline equivalent first `PATCH` is version `2`
- later scenario PATCH drafts must require a user-entered integer version
- the user enters that value based on the current EUDAMED playground state
- local XML generation logic should therefore never silently auto-increment version for scenario drafts
- version handling must stay explicit and reviewable in both backend payloads and the `Patch XML` UI

## Recommended Next Step

Design and implement the generated scenario-authoring version of `Patch XML` by building on the existing `Post + Patch` pair rather than replacing it.

Recommended delivery sequence:

1. Backend
   - formalize the existing generated `Post + Patch` pair as:
     - parent `POST`
     - baseline first child `PATCH`
     - protected identity fields
   - resolve any available `POST` record for the selected variant
   - derive supported scenario PATCH drafts from the baseline first `PATCH`
   - require user-supplied PATCH version input
   - return:
     - parent POST summary
     - baseline PATCH summary
     - field-level before/after comparison
     - baseline PATCH XML
     - derived scenario PATCH XML
     - validation result

2. Frontend
   - redesign `Patch XML` into a comparison workspace
   - show:
     - parent POST context
     - baseline first PATCH context
     - shared PATCH version input
     - scenario-specific inputs
     - before/after business-field comparison
     - toggle-based XML comparison
   - clear unsaved scenario state when the selected variant changes

3. Transition
   - keep fixture-backed PATCH scenario preview as a reference path during transition
   - keep candidate scenario status conservative until real EUDAMED confirmation exists

4. Later
   - add persistence for baseline-family and PATCH-scenario status
   - evolve batch modes toward explicit `POST Batch` and scenario-driven `PATCH Batch`
   - decide whether `Single XML` should remain only as an engineering/debugging tool
