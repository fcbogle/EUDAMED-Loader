# XML Generation

## Purpose

The `XML Generation` area is where approved canonical data is transformed into schema-aware EUDAMED payloads. This stage should only become active after workbook interpretation and canonical validation are stable.

## Current Decisions

- XML generation remains downstream of workbook analysis and canonical review
- the current first upload scope is `MDR` `UDI-DI` device details plus market information
- the current business content focus is `UDI-DI`, but the generated artifact is a wrapped service `Push` message rooted at `data/schemas/service/Message.xsd`
- `Basic UDI` records have already been loaded manually and should be treated as upstream reference context in this phase
- XML generation should project from canonical domain models rather than directly from workbook fields
- the current implemented backend path generates a single-record wrapped `Push` message for `Echelon`
- the single-record XML path is currently schema-valid against the imported local EUDAMED service/schema set
- database persistence is not required for the current XML design phase
- no approved Playground actor is available yet, so first-phase XML handling should assume manual review and controlled test submission paths

## What The User Does Here

- generate a single-record XML preview for one validation-ready `Echelon` row
- validate that preview against the local schema set
- download a reviewed single-record XML file
- generate a batch preview for validation-ready `Echelon` rows
- inspect one selected batch chunk at a time
- validate the selected batch chunk against the local schema set
- download a batch `.zip` package containing XML files and a manifest

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
- batch preview and download are implemented for validation-ready `Echelon` rows
- batch output is chunked into wrapped `Push` messages with a maximum of `300` `device:Device` entries per file
- batch download is packaged as a `.zip` containing:
  - one XML file per generated chunk
  - a `manifest.json` summary of included rows, excluded rows, chunk counts, and file names
- the current UI presents this flow as a step-by-step guide:
  - validate canonical
  - generate single XML
  - validate against schema
  - download single XML
  - generate batch XML
  - validate batch against schema
  - download batch package

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

## Batch Generation Design

Batch generation follows the same wrapped `Push` message design as single-record generation.

The local EUDAMED message schema allows up to `300` `device:Device` entries in one `payload`.

For the current implementation this means:

- the app first filters to validation-ready `Echelon` rows only
- blocked rows are excluded from the batch package
- eligible rows are chunked into groups of at most `300`
- each chunk becomes its own schema-validated wrapped `Push` message
- the UI previews one selected chunk at a time instead of rendering every batch file inline
- download produces a `.zip` package rather than a single oversized XML file

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
- batch preview validates one selected chunk in the UI at a time, even though the downloaded package may contain multiple XML files
- future packaging may still expand to include richer audit artifacts, but the current implementation focuses on XML files plus a simple manifest

## Expected Outputs

- previewable single-record XML payloads
- previewable batch-chunk XML payloads
- XSD validation results
- downloadable `.xml` output for controlled manual submission/testing
- downloadable batch `.zip` packages for controlled manual submission/testing
- later:
  - richer optional structure handling where the canonical model is complete enough
