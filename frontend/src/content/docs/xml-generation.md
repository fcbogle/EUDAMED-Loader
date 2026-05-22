# XML Generation

## Purpose

The `XML Generation` area is where approved canonical data is transformed into schema-aware EUDAMED payloads. This stage should only become active after workbook interpretation and canonical validation are stable.

## Current Decisions

- XML generation remains downstream of workbook analysis and canonical review
- the current first upload scope is `MDR` `UDI-DI` device details plus market information
- the current schema focus is `UDIDIType.xsd`
- `Basic UDI` records have already been loaded manually and should be treated as upstream reference context in this phase
- XML generation should project from canonical domain models rather than directly from workbook fields
- the current implemented backend path generates a single-record wrapped `Push` message for `Echelon`
- the single-record XML path is currently schema-valid against the imported local EUDAMED service/schema set
- database persistence is not required for the current XML design phase
- no approved Playground actor is available yet, so first-phase XML handling should assume manual review and controlled test submission paths

## What This Section Should Hold

- XML preview and download
- XSD validation status
- payload packaging details
- generation audit information
- explicit first-phase assumptions such as `MDR only`, `UDIDIType.xsd`, and manual submission constraints

## Design Intent

XML generation is an output stage, not a place to repair workbook issues. If data quality or mapping problems are discovered here, the workflow should point back to the earlier workbook or canonical stages.

The XML layer should consume a stable canonical contract. It should not need to understand workbook-specific header variants, normalization noise, or ad hoc source cleanup rules.

For the current phase, XML work should be designed around a controlled first-load package for `UDI-DI` records only. If a future phase expands to other legislation, other object families, or machine-to-machine submission, that should be treated as a separate scope decision rather than assumed now.

## Current Implemented State

- single-record `Echelon` XML preview is implemented
- the current preview path:
  - selects one validation-ready `Echelon` row
  - applies shared `Basic UDI` context
  - renders a wrapped `Push` message
  - validates the message against the local EUDAMED XSD set
  - allows XML download from the UI
  - includes normalized `Storage Conditions` and `Critical Warnings` when present for the selected `Echelon` row
- batch generation is not implemented yet

## Push Message Design

The current XML output is not a loose device fragment. It is a wrapped EUDAMED service `Push` message.

That matters because the schema expects two layers:

- a service-message wrapper
  - message metadata such as `messageID`, `correlationID`, `creationDateTime`
  - `sender` and `recipient`
  - a `payload`
- a business payload inside that wrapper
  - for the current `Echelon` path, one `device:Device` entry
  - rendered with `xsi:type="device:MDRDeviceType"`
  - containing:
    - `device:MDRBasicUDI`
    - `device:MDRUDIDIData`

So when the documentation says the current `Echelon` path includes the wider XML-facing field set, it means the app now tracks enough canonical detail to populate both:

- the `MDRBasicUDI` side
  - risk class
  - basic identifier
  - manufacturer and authorised representative context
  - MDR-specific applicable-property fields
- the `MDRUDIDIData` side
  - UDI-DI identifier
  - basic UDI linkage
  - nomenclature code
  - reference number
  - sterile / sterilization / reuse / latex / reprocessed flags
  - market information

Without that wider field set, the app could still describe mappings conceptually, but it could not produce a schema-valid wrapped `Push` message for real review and download.

## Enum Strategy

The XML generator does not invent enum values on the fly. It consumes explicit normalization rules already reviewed in the canonical/validation layers.

Current `Echelon` mappings:

- `Lower limit of temp` -> `SHC006`
- `Upper limit of temp` -> `SHC007`
- `Consult instructions for use` -> `CW010`

Those rules are stored in:

- `config/normalization/storage_handling_condition_primary.yaml`
- `config/normalization/storage_handling_condition_secondary.yaml`
- `config/normalization/critical_warning_type.yaml`

When these sections are emitted:

- the enum code is written into the schema field
- free-text workbook descriptions are carried as comments
- for non-`OTHER` enum values, comment language is set to `ANY` as required by the XSD notes

## Current Constraints

- the current enum coverage is intentionally narrow and dataset-specific
- if future workbook phrases appear outside the current three reviewed values, new normalization rules will be needed before those phrases should be emitted into XML
- future batch generation should build on the same validated single-record payload design rather than inventing a separate path

## Expected Outputs

- previewable single-record XML payloads
- XSD validation results
- downloadable `.xml` output for controlled manual submission/testing
- later:
  - chunked batch message generation
  - zip packaging
  - richer optional structure handling where the canonical model is complete enough
