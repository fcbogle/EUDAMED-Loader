# Session Handoff

## Current Objective

Continue the XML workspace split between:

- `EUDAMED Testing`
- `EUDAMED Generation`

and build out controlled PATCH scenario handling without overstating EUDAMED acceptance.

## Completed In This Session

- Added a Documentation note for the agreed `EUDAMED Testing` / `EUDAMED Generation` UI direction.
- Renamed the main XML workspace in the frontend from `XML Generation` to `EUDAMED Testing`.
- Added a new top-level `EUDAMED Generation` tab for accepted-only XML patterns.
- Added a `Patch XML` pill inside `EUDAMED Testing`.
- Introduced the two UI status labels:
  - `EUDAMED Candidate`
  - `EUDAMED Accepted`
- Seeded the initial PATCH scenario registry with:
  - `trade_name_edit`
  - `warning_add`
  - `storage_condition_edit`
- Wired `Patch XML` to fixture-backed preview and download using the existing XML files under `backend/tests/fixtures/xml_patch_scenarios/...`
- Kept `Post + Patch` as the only accepted pattern visible in `EUDAMED Generation`

## Code Changes Made

Frontend:

- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/types.ts`
- `frontend/src/content/docs/eudamed-testing-generation-ui.md`

Backend:

- `backend/app/routers/xml_generation.py`
- `backend/app/services/xml_generation.py`
- `backend/app/xml_models.py`

## Current UI Behavior

### EUDAMED Testing

Top-level area for review and comparison work.

Current pills:

- `Post + Patch`
- `Single XML`
- `Market Info`
- `Patch XML`
- `Batch XML`

`Patch XML` now:

- shows one candidate PATCH scenario at a time
- remains anchored to the accepted baseline family `echelon-echelon-vac-EVAC22L1S`
- loads the existing fixture XML for preview
- validates that fixture XML against the local schema set
- supports download of the fixture XML
- allows the user to switch the displayed status between `EUDAMED Candidate` and `EUDAMED Accepted` in the UI

Important limitation:

- PATCH scenario status is currently UI state only
- it is not yet persisted anywhere

### EUDAMED Generation

Top-level area for accepted-only XML generation.

Current state:

- only `Post + Patch` is surfaced here
- PATCH scenarios do not yet appear here, even if the UI label is switched to `EUDAMED Accepted`

## Confirmed Design Facts

- The application is still a preparation/review tool, not a live submission system.
- Current XML baseline remains:
  - `POST -> DEVICE.POST`
  - `PATCH -> UDI_DI.PATCH`
- Equivalent first `PATCH` should keep `marketInfos` identical to the equivalent `POST`.
- Candidate PATCH scenarios should remain tied to the same baseline device family and not be treated as freeform XML editing.
- Only `EUDAMED Accepted` patterns should be available in the operational generation area.

## Fixture-Backed PATCH Scenario Facts

Current supported fixture-backed candidate scenarios:

- `trade_name_edit`
- `warning_add`
- `storage_condition_edit`

Current excluded scenario:

- `secondary_identifier_add`
  - still incomplete
  - no generated XML file declared
  - status remains effectively pending

## Test Status

Commands run:

```bash
cd frontend && npm run build
../.venv/bin/python -m pytest -q backend/tests/test_echelon_xml_generation.py -q
```

Results:

- frontend production build passed
- targeted backend XML generation tests passed

## Still Missing

- persistence for PATCH scenario status (`EUDAMED Candidate` / `EUDAMED Accepted`)
- accepted/candidate status storage model for baseline families and PATCH scenarios
- automatic promotion of accepted PATCH scenarios into `EUDAMED Generation`
- true scenario generation from live device/canonical data instead of fixture-backed XML
- broader PATCH scenario support beyond the first three candidate fixtures
- externally confirmed EUDAMED acceptance for the three candidate PATCH scenarios
- official sample XML files:
  - `SAMPLE_DTX_UDI_007.01.xml`
  - `SAMPLE_DTX_UDI_007.02.xml`

## Recommended Next Step

Implement persistence for baseline-family and PATCH-scenario status so that:

- `Post + Patch` remains stored as `EUDAMED Accepted`
- candidate PATCH scenarios can be promoted after real testing
- `EUDAMED Generation` can filter from stored accepted patterns rather than temporary UI state
