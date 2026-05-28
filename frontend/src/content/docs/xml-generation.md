# XML Generation

## Purpose

The `XML Generation` area is where XML-ready canonical data is transformed into schema-aware EUDAMED payloads. This stage should only become active after `Canonical Validation` shows that the selected row is ready for XML generation.

## Current Decisions

- XML generation remains downstream of workbook analysis, canonical review, and canonical validation
- the current first upload scope is `MDR` `UDI-DI` device details plus market information
- the generated artifact is a wrapped service `Push` message rooted at `data/schemas/service/Message.xsd`
- `Basic UDI` records remain upstream reference context and are now resolved through the aligned canonical-validation field set
- XML generation now starts at `Product Family` and `Product Variant` level rather than at workbook-family level
- the current implemented generic slice is:
  - `Single XML`
  - one selected XML-ready row
  - one wrapped `Push` message
- `Variant Batch XML` is the next planned slice and is not yet part of the new generic path
- database persistence is not required for the current XML design phase

## What The User Does Here

- review XML scope and readiness derived from `Canonical Validation`
- select a `Product Family`
- select a `Product Variant`
- select one XML-ready row
- generate a single wrapped `Push` message preview
- validate that preview against the local schema set
- download the reviewed XML file

## Current Implemented State

- the XML tab now consumes the aligned `Canonical Validation` record set rather than the old Echelon-only validation bundle
- the current generic single-record path:
  - selects one XML-ready row inside one selected product variant
  - uses the aligned canonical field set as the XML source contract
  - renders a wrapped `Push` message
  - validates the message against the local EUDAMED XSD set
  - allows XML download from the UI
- `POST` and `PATCH` now flow from the selected variant context through `serviceOperation`
- repeated market-availability items are now projected into repeated `marketInfo` XML elements
- normalized `Storage Conditions` and `Critical Warnings` are carried forward when present for the selected row

## Design Intent

XML generation is an output stage, not a place to repair workbook issues. If data quality or mapping problems are discovered here, the workflow should point back to:

- `Workbooks`
- `Canonical`
- `Canonical Validation`

The XML layer should consume a stable canonical contract. It should not need to understand workbook-specific header variants, normalization noise, or ad hoc source cleanup rules.

The real generation unit is now:

- one `Product Variant`

So even when later batch generation is added, records should only be grouped inside the same selected variant.

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
- a business payload inside that wrapper
  - one `device:Device` entry in the current single-record path
  - rendered with `xsi:type="device:MDRDeviceType"`
  - containing:
    - `device:MDRBasicUDI`
    - `device:MDRUDIDIData`

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

## Next Slice

The next XML refactor slice is:

- `Variant Batch XML`

That later slice should:

- keep the same `Product Family` -> `Product Variant` selection flow
- include all XML-ready rows for the selected variant only
- chunk output when needed
- avoid mixing sibling variants in one payload package

## Expected Outputs

- previewable single-record XML payloads
- XSD validation results
- downloadable `.xml` output for controlled manual submission/testing
- later:
  - variant-batch XML previews
  - downloadable variant-batch packages
