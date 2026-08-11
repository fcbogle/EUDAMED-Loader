# EUDAMED Playground Test Report

## Purpose

This document records EUDAMED Playground testing performed from the application and captures the specific records, XML message types, outcomes, and operational findings.

It is intended to be shareable with project stakeholders, including Regulatory Affairs and Quality, and should remain focused on testing evidence rather than architecture or session continuity.

## Document Role

This document should be used for:

- Playground test execution history
- tested subject identification
- confirmed upload outcomes
- important validation or environment findings discovered through testing

This document should not be used for:

- session continuity notes
- architecture direction
- speculative future design

Related documents:

- `docs/session-handoff.md`
  - working session continuity and current technical context
- `docs/architecture-definition-draft.md`
  - architecture direction, rationale, and future-state design

## Test Environment

- Environment: `EUDAMED Playground`
- Application context: locally generated XML from the EUDAMED preparation application
- Current tested date range: Sunday, August 9, 2026 onward

## Current Tested Subject Ledger

### Subject 1

- Product family: `Echelon`
- Product variant: `Echelon VAC`
- Catalogue number: `EVAC22L1S`
- Primary UDI-DI: `05050649062025`
- Basic UDI-DI: `5050649ECHELONVACNL`
- Source workbook: `Template for Echelon family EUDAMED.xlsx`
- Source sheet: `Echelon VAC`
- Source row index: `3`
- Current status:
  - baseline `POST` tested successfully
  - baseline first-child `PATCH` tested successfully
  - first real scenario-derived `PATCH` tested successfully for storage condition `SHC006`
  - second real scenario-derived `PATCH` tested successfully for storage condition `SHC007`
  - should be excluded from future baseline `POST` and baseline `PATCH` waves unless deliberate re-test is required

### Subject 2

- Product family: `Elan`
- Product variant: `Elan IC`
- Catalogue number: `ELANIC22L1S`
- Primary UDI-DI: `05050649096501`
- Basic UDI-DI: `5050649ELANICNM`
- Source workbook: `Template for Elan products EUDAMED.xlsx`
- Source sheet: `Elan IC`
- Source row index: `3`
- Current status:
  - baseline `POST` tested successfully
  - baseline first-child `PATCH` tested successfully
  - first real scenario-derived `PATCH` tested successfully for trade name

## Confirmed Test Executions

### Single-Device Testing

#### Device A: `Echelon` / `Echelon VAC` / `EVAC22L1S`

Device identity:

- Product family: `Echelon`
- Product variant: `Echelon VAC`
- Catalogue number: `EVAC22L1S`
- Primary UDI-DI: `05050649062025`
- Basic UDI-DI: `5050649ECHELONVACNL`

##### A1. Baseline `DEVICE.POST`

- Test date/time: `2026-08-09T20:52:02+02:00`
- Message type: `DEVICE.POST`
- Subject:
  - `Echelon`
  - `Echelon VAC`
  - `EVAC22L1S`
  - `05050649062025`
- Outcome: `SUCCESS`
- Transaction id: `5174249e-e84a-4786-8f53-7c176c013aa6`
- Submission id: `cdf34da9-da6a-4a11-abc1-df95612ff907`

Working configuration at the time of success:

- `EUDAMED_MESSAGE_SCHEMA_VERSION=3.0.32`
- `EUDAMED_MANUFACTURER_SRN_OVERRIDE=UK-MF-000033261`
- `EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE=DE-AR-000031681`
- `EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE=false`

Notes:

- This confirmed that the application can generate a `DEVICE.POST` XML package accepted by the current Playground environment.
- The tested record should now be treated as a known registered Playground subject for follow-on PATCH testing.

##### A2. Baseline first-child `UDI_DI.PATCH`

- Test date/time: `2026-08-09T20:59:45+02:00`
- Message type: `UDI_DI.PATCH`
- Subject:
  - `Echelon`
  - `Echelon VAC`
  - `EVAC22L1S`
  - `05050649062025`
- `e:version`: `2`
- Outcome: `SUCCESS`
- Transaction id: `349eb9f9-6445-4f52-a130-aed9f9c80dad`
- Submission id: `ccccc754-313c-496e-b4b2-b402df7f9645`

Notes:

- This was the equivalent first-child `PATCH` generated from the accepted baseline `POST`.
- This established the baseline version lineage for later scenario-derived PATCH testing on the same subject.

##### A3. Scenario `UDI_DI.PATCH` for storage condition `SHC006`

- Playground acceptance time: `2026-08-11T12:02:14.683+02:00`
- Payload creation time: `2026-08-11T10:00:36+00:00`
- Message type: `UDI_DI.PATCH`
- Scenario id: `storage_condition_edit`
- Subject:
  - `Echelon`
  - `Echelon VAC`
  - `EVAC22L1S`
  - `05050649062025`
- `e:version`: `3`
- Outcome: `SUCCESS`
- Transaction id: `a63b317b-6994-48c7-b5d6-29f8f7727ff9`
- Submission id: `2d4e6323-ab2c-4639-bf93-6cee0c964351`
- Correlation id: `cb67dcb5-33b0-4358-834a-7316718bc4b2`
- Message id: `3d025f58-e5b6-40ac-b0e1-bad3f10525cc`

Confirmed business delta:

- changed storage condition: `SHC006`
- before: `Minus 15C`
- after: `Store in a dry location`

Explicitly unchanged:

- `SHC007` remained `Plus 50C`

Notes:

- This is the first confirmed real scenario-derived `PATCH` accepted in Playground after the baseline pair.
- The report now distinguishes exactly which storage condition code was changed so the remaining condition can be tested separately in a later PATCH.

##### A4. Scenario `UDI_DI.PATCH` for storage condition `SHC007`

- Playground acceptance time: `2026-08-11T12:34:04.607+02:00`
- Payload creation time: `2026-08-11T10:31:49+00:00`
- Message type: `UDI_DI.PATCH`
- Scenario id: `storage_condition_edit`
- Subject:
  - `Echelon`
  - `Echelon VAC`
  - `EVAC22L1S`
  - `05050649062025`
- `e:version`: `4`
- Outcome: `SUCCESS`
- Transaction id: `05925076-b7af-423a-a385-ed84f51a8eb3`
- Submission id: `8008074a-8b72-40d6-842f-5fddd3a846b0`
- Correlation id: `a02d26a4-346b-48c3-a117-0b807d43a887`
- Message id: `404bd610-d886-47af-a1ff-ed343d41aea2`

Confirmed business delta:

- changed storage condition: `SHC007`
- before: `Plus 50C`
- after: `Store in a dry location`

Retained prior accepted state:

- `SHC006` remained `Store in a dry location`

Notes:

- This is the second confirmed real scenario-derived `PATCH` accepted in Playground for the same tested subject.
- Because the application does not yet persist accepted Playground state, the generated XML repeated the already accepted `SHC006` value explicitly while introducing the new `SHC007` change at version `4`.

#### Device B: `Elan` / `Elan IC` / `ELANIC22L1S`

Device identity:

- Product family: `Elan`
- Product variant: `Elan IC`
- Catalogue number: `ELANIC22L1S`
- Primary UDI-DI: `05050649096501`
- Basic UDI-DI: `5050649ELANICNM`

##### B1. Baseline `DEVICE.POST`

- Playground acceptance time: `2026-08-11T12:54:18.979+02:00`
- Message type: `DEVICE.POST`
- Subject:
  - `Elan`
  - `Elan IC`
  - `ELANIC22L1S`
  - `05050649096501`
- Outcome: `SUCCESS`
- Transaction id: `5788dbed-16ae-42b3-af99-6e3751d41746`
- Submission id: `ff9574dd-0f54-4cfe-8136-5991f0770119`

Notes:

- This established a second tested device lineage in Playground rather than continuing all testing on the original `Echelon VAC` record.
- The next planned step for this subject is the equivalent first-child baseline `UDI_DI.PATCH` with `e:version = 2`.

##### B2. Baseline first-child `UDI_DI.PATCH`

- Playground acceptance time: `2026-08-11T13:02:41.257+02:00`
- Message type: `UDI_DI.PATCH`
- Subject:
  - `Elan`
  - `Elan IC`
  - `ELANIC22L1S`
  - `05050649096501`
- `e:version`: `2`
- Outcome: `SUCCESS`
- Transaction id: `3dea9de9-f857-4db1-b8bd-c97efba76312`
- Submission id: `9f335a58-82c6-4ec8-aaa2-f862b4cb6933`

Notes:

- This was the equivalent first-child `PATCH` generated from the accepted baseline `POST` for the `Elan IC` subject.
- This established the baseline version lineage for later scenario-derived PATCH testing on this second device lineage.

##### B3. Scenario `UDI_DI.PATCH` for trade name

- Playground acceptance time: `2026-08-11T13:50:14.111+02:00`
- Payload creation time: `2026-08-11T11:47:46+00:00`
- Message type: `UDI_DI.PATCH`
- Scenario id: `trade_name_edit`
- Subject:
  - `Elan`
  - `Elan IC`
  - `ELANIC22L1S`
  - `05050649096501`
- `e:version`: `3`
- Outcome: `SUCCESS`
- Transaction id: `9b620847-7c81-4e32-b74c-de286b5dcd17`
- Submission id: `53c96b77-c5a3-4226-937b-9808ac4a3970`
- Correlation id: `2bca3ac6-b64c-4e26-bf7b-25efe8d27b56`
- Message id: `874a9d48-961e-40c6-a5e4-ae646329c81b`

Confirmed business delta:

- changed field: `trade_name`
- before: `ELANIC 22L CAT1 -EXT.FOOT PROSTHESIS`
- after: `ELANIC 22L CAT1 -EXT.FOOT PROSTHESIS UPDATED`

Notes:

- This is the first confirmed real scenario-derived `PATCH` accepted in Playground for the `Elan IC` subject.
- It provides evidence of a second PATCH scenario type beyond storage-condition edits.

##### B4. Scenario `UDI_DI.PATCH` for critical warnings

- Playground acceptance time: `2026-08-11T16:26:05.343+02:00`
- Message type: `UDI_DI.PATCH`
- Scenario id: `warning_add`
- Subject:
  - `Elan`
  - `Elan IC`
  - `ELANIC22L1S`
  - `05050649096501`
- `e:version`: `4`
- Outcome: `SUCCESS`
- Transaction id: `6aebefd6-4a73-47e4-96f1-23094c0a0167`
- Submission id: `06b987f7-4432-4780-9a31-c1fe12de3603`
- Correlation id: `d1c63bc4-2987-46fa-a4c9-7fc16ab630bf`
- Message id: `3a671c6e-61a8-450e-b638-5b4b2cad9ee5`

Confirmed business delta:

- changed field: `critical_warning`
- before: `CW010`
- after: `CW011`

Confirmed retained fields:

- retained trade name: `ELANIC 22L CAT1 -EXT.FOOT PROSTHESIS UPDATED`
- retained `SHC006`: `Minus 15C`
- retained `SHC007`: `Plus 50C`

Notes:

- This confirmed that the generated warning PATCH preserved the successful version `3` trade-name update rather than reverting to the original baseline value.
- This is the first confirmed successful `Critical Warnings` scenario PATCH for the `Elan IC` subject.

### Bulk Testing

No bulk Playground testing has been recorded yet.

## Confirmed Operational Findings

### Message schema version mismatch

On Sunday, August 9, 2026, the Playground validator rejected `m:Push version="3.0.30"` and required `3.0.32`.

Observed rejection:

- status: `BAD_REQUEST`
- code: `E-I-40000`
- validation message indicated that `m:Push@version` must have the fixed value `3.0.32`

Resulting current testing position:

- application default for Playground testing is currently `3.0.32`
- bundled local `MessageType.xsd` has been aligned locally to `3.0.32` for test validation consistency
- this should be treated as a reversible testing-era decision until EUDAMED documentation and local schema packs are fully reconciled

### Manufacturer actor mismatch

An initial Playground upload failed because the payload carried manufacturer actor code `UK-MF-000048777` while the logged-in submitting actor was `UK-MF-000033261`.

Observed rejection:

- status: `UNAUTHORISED_ERROR`
- code: `E-I-40000`
- message indicated that the payload actor did not match the submitting actor

Resulting current testing position:

- Playground testing uses `EUDAMED_MANUFACTURER_SRN_OVERRIDE=UK-MF-000033261`

### Authorised representative actor mismatch

An initial Playground upload then failed because the payload carried `ARActorCode` `DE-AR-000006292`, which the current Playground environment could not resolve.

Observed rejection:

- status: `SERVER_ERROR`
- code: `M-50000`
- message indicated that the actor could not be found

Playground testing then showed that:

- a non-EU manufacturer still requires an authorised representative in the payload
- the valid current actor identified in Playground was `DE-AR-000031681`
- actor name: `Blatchford Europe GmbH`

Resulting current testing position:

- Playground testing uses `EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE=DE-AR-000031681`
- `EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE=false`

## Tested Record Identification Position

For current Playground tracking, a tested subject should be identified using:

- product family
- product variant
- catalogue number
- primary UDI-DI
- source workbook
- source sheet
- source row index

Current working interpretation:

- the application currently treats one workbook row as one individual UDI-DI submission record

This interpretation remains subject to business and regulatory confirmation.

## Known Data Observation

Catalogue number is almost globally unique across the currently mapped dataset, but not perfectly unique.

Current finding:

- total mapped records checked: `8424`
- duplicate catalogue values found: `1`

Observed duplicate:

- catalogue number: `EC27LN7S`
- source sheet: `Echelon`
- source row `86` with primary UDI-DI `05050649030901`
- source row `242` with primary UDI-DI `05050649032462`

Implication:

- catalogue number is useful, but should not be treated as the only global identifier for tested-subject tracking

## Next Recommended Tests

- choose the next business-meaningful PATCH scenario or a fresh device lineage for further single-device testing
- record the next accepted `e:version`, exact changed field values, and outcome

## Maintenance Guidance

When further Playground tests are completed, update this document with:

- the tested subject identity
- the message type
- the exact `e:version` where applicable
- the outcome and timestamps
- the transaction and submission identifiers
- any important validation or environment findings
