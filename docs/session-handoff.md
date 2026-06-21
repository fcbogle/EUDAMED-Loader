# Session Handoff

## Current Objective

Continue refining the XML workspaces so the UI clearly separates:

- `EUDAMED Testing`
- `EUDAMED Generation`

while evolving `Patch XML` from static fixture review toward a controlled scenario-based testing workflow that:

- lets the user select any product variant
- establishes one testing anchor record for that selected variant
- uses that same anchor record for all PATCH scenario tests for that variant
- supports before/after review for approved operational PATCH scenarios
- evolves batch generation toward explicit `POST Batch` and scenario-driven `PATCH Batch` workflows
- does not overstate EUDAMED acceptance

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
- have the UI resolve one concrete testing record for that variant
- use that same record as the testing anchor for all PATCH scenarios for that variant
- choose from a whitelist of confirmed operational PATCH scenarios
- see a before/after view
- edit only the fields allowed for the chosen scenario
- generate a new candidate PATCH XML for review, validation, and download

### Recommended Anchor Model

The preferred model is now a `variant-scoped testing anchor`.

This means:

- the user selects a product family and variant
- the application resolves one concrete device record for that variant
- that record becomes the active testing anchor
- all PATCH scenario drafts for that testing session use that same record
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
- controlled field editing for that scenario only
- generation of a new candidate PATCH XML from the selected anchor record plus user-provided change values

### Example Target Workflow

Example for `Trade Name Edit`:

1. User selects product family and variant.
2. Application resolves one device record for that variant as the testing anchor.
3. User opens `Patch XML`.
4. User chooses `Trade Name Edit` from a scenario dropdown.
5. UI shows:
   - current trade name
   - new trade name input
   - before / after comparison
6. Backend generates a new candidate PATCH XML targeting that same device record.
7. UI shows XML preview, local XSD validation, and download.

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

- generate from one known baseline anchor record plus controlled scenario-specific overrides

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

- `version` should not be treated as a universally fixed rule across all PATCH scenarios
- correct version behavior may depend on the state of the target testing environment and what EUDAMED already knows about the registered device record
- local XML generation logic should therefore keep version handling explicit and reviewable
- version increment/update behavior should be confirmed against the actual testing environment before being hardened into operational rules

## Recommended Next Step

Design and implement the first controlled scenario-authoring version of `Patch XML`, starting with `Trade Name Edit`, so that:

- the user can select any product family and product variant
- the UI resolves one concrete testing anchor record for that variant
- the same testing anchor is used across PATCH scenarios for that variant
- `Patch XML` can show before / after values for one approved scenario
- the backend can generate a new candidate PATCH XML from that selected anchor record plus user input
- changing product variant clears unsaved draft PATCH scenario state

Then evolve the XML mode set toward:

- `Post + Patch`
- scenario-based `Patch XML`
- `POST Batch`
- scenario-driven `PATCH Batch`

and decide whether `Single XML` should remain only as an engineering/debugging tool.

After that, implement persistence for baseline-family and PATCH-scenario status so that:

- the accepted baseline `Post + Patch` remains stored as `EUDAMED Accepted`
- candidate PATCH scenarios can be promoted only after real EUDAMED testing
- `EUDAMED Generation` can filter from stored accepted patterns rather than temporary UI state
- future variant-scoped testing anchor families can be introduced without losing the single-record PATCH testing model
