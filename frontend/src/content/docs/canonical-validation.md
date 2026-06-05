# Canonical Validation

## Purpose

This tab shows whether in-scope workbook rows can support the current canonical and XML-facing field contract after variant linkage to `BasicUDIs.xlsx`.

## Current Implementation

- scope: all non-accessories family workbooks
- unit of validation: one source row
- grouping: `Product Family` -> `Product Variant` -> sample row
- both `POST` and `PATCH` records are shown
- canonical completeness and XML readiness are shown separately

Reference data currently supplies:

- Basic UDI-DI linkage
- submission operation
- source version marker
- core Basic UDI properties
- market availability context

Supplemental enrichment currently supplies:

- manufacturer SRN
- authorised representative SRN

## Important Note

The validation field set is close to the canonical review artifact, but it is not yet a strict one-to-one reflection of the declared Pydantic canonical models. Some XML-facing aliases still exist in the validation and XML layers.

## Current Scope

- in scope:
  - `Echelon`
  - `Elan`
  - `Elite`
  - `Epirus / Esprit`
  - `Navigator / Javelin / Linx`
- excluded from active mapping:
  - `Template for Accessories_Footspares EUDAMED.xlsx`

## Current Output

- family summaries
- variant summaries
- blocker summaries
- sample rows
- field-level evidence
- repeated-item previews for market availability, storage conditions, and warnings
