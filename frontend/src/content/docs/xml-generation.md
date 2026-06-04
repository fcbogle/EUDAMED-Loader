# XML Generation

## Purpose

The `XML Generation` area is where XML-ready canonical data is transformed into schema-aware EUDAMED payloads. This stage should only become active after `Canonical Validation` shows that the selected variant has XML-ready data available for generation.

## Current Decisions

- XML generation remains downstream of workbook analysis, canonical review, and canonical validation
- the current first upload scope is `MDR` `UDI-DI` device details plus market information
- the generated artifact is a wrapped service `Push` message rooted at `data/schemas/service/Message.xsd`
- the in-project EUDAMED schema pack is now aligned to `3.0.30`
- `Basic UDI` records remain upstream reference context and are now resolved through the aligned canonical-validation field set
- XML generation now starts at `Product Family` and `Product Variant` level rather than at workbook-family level
- the current implemented generic slices are:
  - `Single XML`
    - one auto-selected XML-ready sample row
    - one wrapped `Push` message
  - `Variant Batch XML`
    - all XML-ready rows for one selected product variant only
    - chunked wrapped `Push` messages at up to `300` rows per file
- database persistence is not required for the current XML design phase

## What The User Does Here

- review XML scope and readiness derived from `Canonical Validation`
- select a `Product Family`
- select a `Product Variant`
- choose `Single XML` or `Variant Batch XML`
- for single mode, review the auto-selected XML-ready sample row
- for batch mode, review the selected batch chunk for the chosen variant
- generate a wrapped `Push` message preview
- validate that preview against the local schema set
- download the reviewed XML file or variant batch package

## Current Implemented State

- the XML tab now consumes the aligned `Canonical Validation` record set rather than the old Echelon-only validation bundle
- the current generic single-record path:
  - selects one auto-selected XML-ready row inside one selected product variant
  - uses the aligned canonical field set as the XML source contract
  - renders a wrapped `Push` message
  - validates the message against the local EUDAMED XSD set
  - allows XML download from the UI
- the current generic variant-batch path:
  - selects all XML-ready rows inside one selected product variant
  - chunks them into wrapped `Push` message files at up to `300` rows per file
  - previews one selected chunk at a time
  - validates each chunk against the local EUDAMED XSD set
  - allows variant-batch package download from the UI
- `POST` and `PATCH` now flow from the selected variant context through distinct default submission profiles
- the selected variant and effective `POST` / `PATCH` state now both come directly from the current authoritative `BasicUDIs.xlsx` workbook
- generated messages now emit `m:Push/@version = 3.0.30`
- default `POST` generation now emits `DEVICE.POST` with a fuller `device:Device` payload
- default `PATCH` generation now emits `UDI_DI.PATCH` with direct `device:UDIDIData`
- generated UDI-DI sections emit `e:state = REGISTERED`
- generated `PATCH` payloads emit `e:version` from the canonical `basic_device.source_version_marker`
- normalized `Storage Conditions` and `Critical Warnings` are carried forward when present for the selected XML payload scope
- `numberOfReuses` now uses `-1` when the workbook indicates that the concept is not applicable

## Design Intent

XML generation is an output stage, not a place to repair workbook issues. If data quality or mapping problems are discovered here, the workflow should point back to:

- `Workbooks`
- `Canonical`
- `Canonical Validation`

The XML layer should consume a stable canonical contract. It should not need to understand workbook-specific header variants, normalization noise, or ad hoc source cleanup rules.

The real generation unit is now:

- one `Product Variant`

Records should only be grouped inside the same selected variant.

## Push Message Design

The current XML output is not a loose device fragment. It is a wrapped EUDAMED service `Push` message.

That means the payload has two layers:

- a service-message wrapper
  - `messageID`
  - `correlationID`
  - `creationDateTime`
  - `sender`
  - `recipient`
  - `payload`
  - `version = 3.0.30`
- a business payload inside that wrapper
  - one or more payload entries depending on the active submission profile
  - default `POST` profile:
    - `device:Device`
    - `xsi:type="device:MDRDeviceType"`
    - containing:
      - `device:MDRBasicUDI`
      - `device:MDRUDIDIData`
  - default `PATCH` profile:
    - `device:UDIDIData`
    - `xsi:type="udidi:MDRUDIDIDataType"`
  - carrying entity lifecycle metadata where currently projected:
    - `e:state`
    - `e:version` for `PATCH`

## Submission Operation Control

The XML layer now treats the updated `BasicUDIs.xlsx` workbook as the single source for submission intent.

Current source ownership is:

- `BasicUDIs.xlsx`
  - variant linkage
  - `Basic UDI-DI`
  - current `POST` / `PATCH` state
  - source version marker
  - supporting Basic UDI reference fields

For the current workbook structure, the application derives submission intent from sheet membership:

- `Upload(BasicUDI not registered)` => `POST`, version marker `1`
- `Update(BasicUDI registered)` => `PATCH`, version marker `2`

## Current Generic Projection

The current generic single-record path now projects from the aligned canonical-validation field set, including:

- `basic_device.device_model`
- `basic_device.risk_class`
- `basic_device.type`
- `basic_device.active`
- `basic_device.administering_medicine`
- `basic_device.implantable`
- `basic_device.measuring_function`
- `basic_device.reusable`
- `manufacturer.manufacturer_srn`
- `basic_device.authorised_representative_srn`
- `device_record.identifier`
- `device_record.basic_udi_identifier`
- `device_record.production_identifier`
- `device_record.sterile`
- `device_record.sterilisation_before_use`
- `device_record.number_of_reuses`
- `device_record.base_quantity`
- `device_record.market_availabilities`
- `device_record.storage_conditions`
- `device_record.warnings`

This is the main reason the earlier Canonical and Canonical Validation alignment work had to be completed before XML generation could be generalized.

## Schema Validation

Generated XML is validated against the local service-message schema set rooted at:

- `data/schemas/service/Message.xsd`

The UI surfaces:

- valid / invalid status
- schema path used
- validation errors when present

Local XSD validity is necessary but not sufficient for live EUDAMED acceptance.

The current project has already shown why:

- the earlier `device:Device` payload shape validated locally against the schema pack
- but EUDAMED still rejected `UDI_DI.PATCH` because the XML body did not match the selected service contract

So the effective contract for this path should be understood as:

- schema validity
- service selection
- operation semantics
- service-specific business expectations that may be enforced beyond what the XSD alone proves

## Current Open Questions

- the broader live service-contract evidence is now tracked separately in `EUDAMED Service Contract Findings`, because successful QMS submissions have shown more than one viable `POST` service/payload profile
- the current default design is now `DEVICE.POST` and `UDI_DI.PATCH`, but `PATCH` version strategy still needs further real-world confirmation

## Current Batch Design

The current batch path:

- keeps the same `Product Family` -> `Product Variant` selection flow as single XML
- includes all XML-ready rows for the selected variant only
- chunks output when needed
- previews one selected chunk at a time
- avoids mixing sibling variants in one payload package

## Expected Outputs

- previewable single-record XML payloads
- previewable variant-batch XML payloads
- XSD validation results
- downloadable `.xml` output for controlled manual submission/testing
- downloadable variant-batch `.zip` packages
