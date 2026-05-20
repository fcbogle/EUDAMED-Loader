# XML Generation

## Purpose

The `XML Generation` area is where approved canonical data is transformed into schema-aware EUDAMED payloads. This stage should only become active after workbook interpretation and canonical validation are stable.

## Current Decisions

- XML generation remains downstream of workbook analysis and canonical review
- the current first upload scope is `MDR` `UDI-DI` device details plus market information
- the current schema focus is `UDIDIType.xsd`
- `Basic UDI` records have already been loaded manually and should be treated as upstream reference context in this phase
- XML generation should project from canonical domain models rather than directly from workbook fields
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

## Expected Outputs

- previewable XML payloads
- XSD validation results
- package artifacts for manual submission
- a clear boundary before any future M2M transport work
