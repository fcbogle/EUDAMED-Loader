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

### Subject 3

- Product family: `Elite`
- Product variant: `Elite2`
- Catalogue number: `EL22-24-1KIT-S`
- Primary UDI-DI: `05050649049491`
- Basic UDI-DI: `5050649ELITE2PX`
- Source workbook: `Template for Elite family EUDAMED.xlsx`
- Source sheet: `Elite2`
- Source row index: `3`
- Current status:
  - baseline `POST` tested successfully
  - baseline first real `PATCH` tested successfully for trade name
  - attempted `latex` `PATCH` at version `3` failed with Playground business-rule error `ERR-DTX-UDI-031-033.02`
  - attempted `sterile` `PATCH` at version `3` failed with Playground business-rule error `ERR-DTX-UDI-031-033.02`
  - `criticalWarnings` `PATCH` then tested successfully at version `3`
  - `baseQuantity` `PATCH` then tested successfully at version `4`

### Subject 4

- Product family: `Elite`
- Product variant: `Elite VT`
- Catalogue number: `EVT22L11S`
- Primary UDI-DI: `05050649110023`
- Basic UDI-DI: `5050649ELITEVTV4`
- Source workbook: `Template for Elite family EUDAMED.xlsx`
- Source sheet: `Elite VT`
- Source row index: `3`
- Current status:
  - parent `DEVICE.POST` tested successfully for the new `Basic UDI-DI`
  - attempted bulk parent `DEVICE.POST` then showed duplicate-parent rejection for later rows in the same wave
  - follow-on child `UDI_DI.POST` bulk upload then tested successfully for five sibling UDI-DI records under the accepted parent
  - these child UDI-DI registrations are now valid candidates for first `PATCH` testing at version `2`

### Subject 5

- Product family: `Epirus`
- Product variant: `Esprit`
- Catalogue number: `ESP22L1S`
- Primary UDI-DI: `05050649058189`
- Basic UDI-DI: `5050649ESPRITVZ`
- Source workbook: `Template for Epirus_Esprit EUDAMED.xlsx`
- Source sheet: `Esprit`
- Source row index: `3`
- Current status:
  - baseline `POST` tested successfully
  - this subject should now be excluded from future baseline `POST` waves unless deliberate re-test is required
  - this subject is now a valid candidate for first `PATCH` testing at version `2`

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

#### Device C: `Elite` / `Elite2` / `EL22-24-1KIT-S`

Device identity:

- Product family: `Elite`
- Product variant: `Elite2`
- Catalogue number: `EL22-24-1KIT-S`
- Primary UDI-DI: `05050649049491`
- Basic UDI-DI: `5050649ELITE2PX`

##### C1. Baseline `DEVICE.POST`

- Playground acceptance time: `2026-08-12T15:33:19.021+02:00`
- Message type: `DEVICE.POST`
- Subject:
  - `Elite`
  - `Elite2`
  - `EL22-24-1KIT-S`
  - `05050649049491`
- Outcome: `SUCCESS`
- Transaction id: `6ee04bdc-2dae-47cd-9d60-cd2d8cca0e90`
- Submission id: `ec9c3495-94da-45d0-8997-ffd2980a2c1c`

Notes:

- This established a third tested device lineage in Playground.
- The successful payload used manufacturer actor `UK-MF-000033261` and service `DEVICE.POST`.
- The next planned step for this subject is the first `UDI_DI.PATCH` at `e:version = 2`, derived from this accepted `POST`.

##### C2. Scenario `UDI_DI.PATCH` for trade name

- Playground acceptance time: `2026-08-12T15:41:40.673+02:00`
- Payload creation time: `2026-08-12T13:38:49+00:00`
- Message type: `UDI_DI.PATCH`
- Scenario id: `trade_name_edit`
- Subject:
  - `Elite`
  - `Elite2`
  - `EL22-24-1KIT-S`
  - `05050649049491`
- `e:version`: `2`
- Outcome: `SUCCESS`
- Transaction id: `ca0fdb5d-4ef0-4fed-9d02-dafeb961528c`
- Submission id: `9e2b1417-3481-466a-99ca-398bc1c827af`

Confirmed business delta:

- changed field: `trade_name`
- before: `ELITE2 ST SIZE 22-23-24 #1 KIT`
- after: `ELITE2 ST SIZE 22-23-24 #1 KIT UPDATED`

Notes:

- This is the first confirmed successful `UDI_DI.PATCH` for the `Elite2` subject after the accepted baseline `POST`.
- This accepted version `2` `PATCH` now becomes the required base state for any later `PATCH` at version `3+` on this same device lineage.

##### C3. Scenario `UDI_DI.PATCH` for latex

- Playground acceptance time: `2026-08-12T15:53:42.722+02:00`
- Payload creation time: `2026-08-12T13:51:02+00:00`
- Message type: `UDI_DI.PATCH`
- Scenario id: `latex_edit`
- Subject:
  - `Elite`
  - `Elite2`
  - `EL22-24-1KIT-S`
  - `05050649049491`
- `e:version`: `3`
- Outcome: `PROCESSED_WITH_ERRORS`
- Transaction id: `e0980a52-75cb-47fd-9275-6f4a41ccf149`
- Submission id: `0834941e-d18d-4075-8745-cd49d6990726`

Attempted business delta:

- changed field: `latex`
- before: `false`
- after: `true`

Observed Playground rule:

- field: `latex`
- error: `ERR-DTX-UDI-031-033.02: Containing latex is not updatable.`

Notes:

- The payload was processed but rejected at EUDAMED business-rule level.
- This does not create a new accepted device state and must not replace the accepted version `2` trade-name PATCH as the current base state.
- The next candidate `PATCH` for this subject should still derive from the accepted version `2` state and continue to use `e:version = 3` until a later scenario succeeds.

##### C4. Scenario `UDI_DI.PATCH` for sterile

- Playground acceptance time: `2026-08-12T16:05:05.363+02:00`
- Payload creation time: `2026-08-12T14:02:41+00:00`
- Message type: `UDI_DI.PATCH`
- Scenario id: `sterile_edit`
- Subject:
  - `Elite`
  - `Elite2`
  - `EL22-24-1KIT-S`
  - `05050649049491`
- `e:version`: `3`
- Outcome: `PROCESSED_WITH_ERRORS`
- Transaction id: `0bda8430-519a-4559-a05c-5d107a70872b`
- Submission id: `b5f43481-3a59-434b-9319-39007940a673`

Attempted business delta:

- changed field: `sterile`
- before: `false`
- after: `true`

Observed Playground rule:

- field: `sterile`
- error: `ERR-DTX-UDI-031-033.02: Device labelled sterile is not updatable.`

Notes:

- The payload was processed but rejected at EUDAMED business-rule level.
- This does not create a new accepted device state and must not replace the accepted version `2` trade-name PATCH as the current base state.
- The next candidate `PATCH` for this subject should still derive from the accepted version `2` state and continue to use `e:version = 3` until a later scenario succeeds.

#### Device D: `Epirus` / `Esprit` / `ESP22L1S`

Device identity:

- Product family: `Epirus`
- Product variant: `Esprit`
- Catalogue number: `ESP22L1S`
- Primary UDI-DI: `05050649058189`
- Basic UDI-DI: `5050649ESPRITVZ`

##### D1. Baseline `DEVICE.POST`

- Playground acceptance time: `2026-08-14T17:08:36.957+02:00`
- Message type: `DEVICE.POST`
- Subject:
  - `Epirus`
  - `Esprit`
  - `ESP22L1S`
  - `05050649058189`
- Outcome: `SUCCESS`
- Transaction id: `9460fa42-fae4-4858-a565-dbe0134a0afd`
- Submission id: `4bf695e2-0c23-4549-8bbf-e98c7d0b7931`

Notes:

- This confirmed a successful new single-device `DEVICE.POST` for the `Epirus / Esprit` lineage after the single `POST` workspace was updated to auto-select the next valid candidate from the selected family and variant.
- The accepted parent `Basic UDI-DI` is `5050649ESPRITVZ`.
- The tested record should now be treated as a known registered Playground subject for follow-on `PATCH` testing.

##### D2. Scenario `UDI_DI.PATCH` for trade name

- Playground acceptance time: `2026-08-14T17:13:58.939+02:00`
- Message type: `UDI_DI.PATCH`
- Scenario id: `trade_name_edit`
- Subject:
  - `Epirus`
  - `Esprit`
  - `ESP22L1S`
  - `05050649058189`
- `e:version`: `2`
- Outcome: `SUCCESS`
- Transaction id: `60bc8111-de28-4733-9adb-8162ef8b0070`
- Submission id: `4ea4066f-7cab-4e07-9d9f-5313e2171152`

Confirmed business delta:

- changed field: `trade_name`
- before: `ESPRIT 22L CAT1-EXT. FOOT PROSTHESIS`
- after: `ESPRIT 22L CAT1-EXT. FOOT PROSTHESIS UPDATED`

Notes:

- This confirms the first real accepted `UDI_DI.PATCH` for the `Epirus / Esprit / ESP22L1S` subject.
- This accepted version `2` PATCH now becomes the base state for any later version `3+` PATCH on this same device lineage.

##### C5. Scenario `UDI_DI.PATCH` for critical warnings

- Playground acceptance time: `2026-08-12T16:09:26.945+02:00`
- Payload creation time: `2026-08-12T14:07:30+00:00`
- Message type: `UDI_DI.PATCH`
- Scenario id: `warning_add`
- Subject:
  - `Elite`
  - `Elite2`
  - `EL22-24-1KIT-S`
  - `05050649049491`
- `e:version`: `3`
- Outcome: `SUCCESS`
- Transaction id: `c17b16f2-a973-4cdd-a897-0e9873c92fc5`
- Submission id: `f8e08b5f-36ed-4440-8ca3-9b547851a90e`

Confirmed business delta:

- changed field: `critical_warning`
- before: `CW010`
- after: `CW011`

Confirmed retained fields:

- retained trade name: `ELITE2 ST SIZE 22-23-24 #1 KIT UPDATED`
- retained `SHC006`: `Minus 15C`
- retained `SHC007`: `Plus 50C`

Notes:

- This confirms that a later successful version `3` PATCH can still be accepted after earlier version `3` attempts were processed with errors and did not advance state.
- This accepted version `3` PATCH now becomes the required base state for any later `PATCH` at version `4+` on this same device lineage.

##### C6. Scenario `UDI_DI.PATCH` for base quantity

- Playground acceptance time: `2026-08-12T16:14:47.844+02:00`
- Payload creation time: `2026-08-12T14:13:06+00:00`
- Message type: `UDI_DI.PATCH`
- Scenario id: `base_quantity_edit`
- Subject:
  - `Elite`
  - `Elite2`
  - `EL22-24-1KIT-S`
  - `05050649049491`
- `e:version`: `4`
- Outcome: `SUCCESS`
- Transaction id: `b2184ab0-b9b1-4131-a2e3-708b4465a809`
- Submission id: `cead7982-dbcc-46f3-b143-67d2ccfdb79e`

Confirmed business delta:

- changed field: `base_quantity`
- before: `1`
- after: `2`

Confirmed retained fields:

- retained trade name: `ELITE2 ST SIZE 22-23-24 #1 KIT UPDATED`
- retained critical warning: `CW011`
- retained `SHC006`: `Minus 15C`
- retained `SHC007`: `Plus 50C`

Notes:

- This is the first confirmed successful `Base Quantity` scenario PATCH in Playground.
- This accepted version `4` PATCH now becomes the required base state for any later `PATCH` at version `5+` on this same device lineage.

##### C7. Scenario `UDI_DI.PATCH` for status code

- Playground acceptance time: `2026-08-12T16:19:08.562+02:00`
- Payload creation time: `2026-08-12T14:17:38+00:00`
- Message type: `UDI_DI.PATCH`
- Scenario id: `status_code_edit`
- Subject:
  - `Elite`
  - `Elite2`
  - `EL22-24-1KIT-S`
  - `05050649049491`
- `e:version`: `5`
- Outcome: `PROCESSED_WITH_ERRORS`
- Transaction id: `a70fcafb-a194-43cd-9187-dc60056fa501`
- Submission id: `64600d0d-b76d-45fc-aa5c-cedf0fb73a5f`

Attempted business delta:

- changed field: `status_code`
- before: `ON_THE_MARKET`
- after: `NO_LONGER_PLACED_ON_THE_MARKET`

Observed Playground rules:

- field: `marketInfoLink`
- error: `Market information is not applicable when device's status is: "Not intended for the EU market" or "No longer placed on the EU market"`
- field: `marketInfoLink`
- error: `Market info is not allowed when changing status from "On the Market" to "No Longer Placed on the EU Market"`

Notes:

- The payload was processed but rejected at EUDAMED business-rule level because it still carried `marketInfos` for a status transition where those market information links are not allowed.
- This does not prove that status itself is never updatable; it shows that the current generated PATCH shape is invalid for this specific status change.
- This does not create a new accepted device state and must not replace the accepted version `4` base-quantity PATCH as the current base state.

### Bulk Testing

#### BT1. Bulk parent `DEVICE.POST` wave for `Elite VT`

- Playground response time: `2026-08-12T21:49:59.327+02:00`
- Message type: `DEVICE.POST`
- Product family: `Elite`
- Product variant: `Elite VT`
- Parent Basic UDI-DI: `5050649ELITEVTV4`
- Outcome: `PROCESSED_WITH_ERRORS`
- Transaction id: `bd91b270-79af-4f5c-b61f-eb7ac507a6e6`
- Submission id: `897671e3-bbc9-4148-8737-ec31545e112f`

Observed outcome:

- one parent registration was accepted successfully
- later rows in the same bulk parent wave were rejected because the same `Basic UDI-DI` was being recreated

Observed Playground rule:

- field: `basicUdiDatas[0].basicUdi`
- message: `The device identifier code 5050649ELITEVTV4 already exists for the selected issuing agency GS1`

Notes:

- This confirmed that repeated fresh `DEVICE.POST` creation is not valid for multiple sibling devices sharing the same new parent `Basic UDI-DI`.
- This test established the required split:
  - parent creation first via `DEVICE.POST`
  - child registration afterwards via `UDI_DI.POST`

#### BT2. Bulk child `UDI_DI.POST` wave for `Elite VT`

- Playground response time: `2026-08-12T23:05:04.590+02:00`
- Message type: `UDI_DI.POST`
- Product family: `Elite`
- Product variant: `Elite VT`
- Parent Basic UDI-DI: `5050649ELITEVTV4`
- Outcome: `SUCCESS`
- Transaction id: `474d9442-9288-400b-897f-2d8268c421af`
- Submission id: `5a61396a-7563-4ceb-a6d4-b9ea7396276c`

Accepted child UDI-DI registrations:

- `05050649110030`
- `05050649110078`
- `05050649110061`
- `05050649110047`
- `05050649110054`

Notes:

- This confirmed that standalone child-device registration using `UDI_DI.POST` is accepted by Playground after the parent `Basic UDI-DI` has already been created.
- This is the first confirmed successful bulk child registration wave recorded in Playground from the application.
- Current validated bulk registration order is now:
  1. `Bulk Basic UDI POST`
  2. `Bulk UDI-DI POST`
  3. `Bulk PATCH`

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

### Latex is not updatable by `PATCH`

On Wednesday, August 12, 2026, Playground processed an `Elite2` version `3` `UDI_DI.PATCH` attempt and returned a business-rule error for `latex`.

Observed rejection:

- outcome: `PROCESSED_WITH_ERRORS`
- code: `ERR-DTX-UDI-031-033.02`
- message: `Containing latex is not updatable.`

Resulting current testing position:

- `latex` should not be treated as a supported candidate PATCH scenario
- failed `latex` attempts must not advance the tracked accepted device version

### Sterile is not updatable by `PATCH`

On Wednesday, August 12, 2026, Playground processed an `Elite2` version `3` `UDI_DI.PATCH` attempt and returned a business-rule error for `sterile`.

Observed rejection:

- outcome: `PROCESSED_WITH_ERRORS`
- code: `ERR-DTX-UDI-031-033.02`
- message: `Device labelled sterile is not updatable.`

Resulting current testing position:

- `sterile` should not be treated as a supported candidate PATCH scenario
- failed `sterile` attempts must not advance the tracked accepted device version

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
