# XML Generation

## Purpose

The `XML Generation` area is where approved canonical data is transformed into schema-aware EUDAMED payloads. This stage should only become active after workbook interpretation and canonical validation are stable.

## Current Decisions

- XML generation remains downstream of workbook analysis and canonical review
- the canonical layer should first support the Device schema split between `BasicDevice` and `DeviceRecord`
- XML generation should project from canonical domain models rather than directly from workbook fields
- database persistence is not required for the current XML design phase

## What This Section Should Hold

- XML preview and download
- XSD validation status
- payload packaging details
- generation audit information

## Design Intent

XML generation is an output stage, not a place to repair workbook issues. If data quality or mapping problems are discovered here, the workflow should point back to the earlier workbook or canonical stages.

The XML layer should consume a stable canonical contract. It should not need to understand workbook-specific header variants, normalization noise, or ad hoc source cleanup rules.

## Expected Outputs

- previewable XML payloads
- XSD validation results
- package artifacts for manual submission
- a clear boundary before any future M2M transport work
