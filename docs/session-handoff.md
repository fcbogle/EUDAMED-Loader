# Session Handoff

## Current Objective

Continue refining the XML workspaces so the UI clearly separates:

- `EUDAMED Testing`
- `EUDAMED Generation`

while keeping PATCH testing tied to one shared registered device and not overstating EUDAMED acceptance.

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

## Code Changes Made

Frontend:

- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/types.ts`
- `frontend/src/styles.css`
- `frontend/src/content/docs/eudamed-testing-generation-ui.md`

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

These three modes now use the same `Registered Device Anchor`, currently backed by:

- family id: `echelon-echelon-vac-EVAC22L1S`
- baseline fixture: `equivalent_baseline/echelon-echelon-vac-EVAC22L1S`
- product family: `Echelon`
- product variant: `Echelon VAC`
- catalogue number: `EVAC22L1S`
- primary UDI-DI: `05050649062025`

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

## Test Status

Commands run:

```bash
cd frontend && npm run build
cd backend && ../.venv/bin/python -m pytest -q tests/test_echelon_xml_generation.py tests/test_xml_patch_fixtures.py
```

Results:

- frontend production build passed
- targeted backend XML generation and PATCH fixture tests passed

## Still Missing

- persistence for PATCH scenario status (`EUDAMED Candidate` / `EUDAMED Accepted`)
- persistence for baseline-family acceptance state
- automatic promotion of accepted PATCH scenarios into `EUDAMED Generation`
- live scenario generation from canonical/device data instead of reading fixed XML fixture files
- broader PATCH scenario support beyond the current three generated fixtures
- completion of `secondary_identifier_add`
- externally confirmed EUDAMED acceptance for the three candidate PATCH scenarios
- operational design for more than one registered-device anchor family
- official sample XML files:
  - `SAMPLE_DTX_UDI_007.01.xml`
  - `SAMPLE_DTX_UDI_007.02.xml`

## Recommended Next Step

Implement persistence for baseline-family and PATCH-scenario status so that:

- the accepted baseline `Post + Patch` remains stored as `EUDAMED Accepted`
- candidate PATCH scenarios can be promoted only after real EUDAMED testing
- `EUDAMED Generation` can filter from stored accepted patterns rather than temporary UI state
- future registered-device anchor families can be introduced without losing the shared-device testing model
