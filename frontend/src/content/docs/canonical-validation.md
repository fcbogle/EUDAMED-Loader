# Canonical Validation

## Purpose

The `Canonical Validation` area is the readiness checkpoint between `Canonical` review and later `XML Generation`. It validates whether the in-scope workbook rows can be supported by the current canonical field set once variant-level `Basic UDI-DI` linkage from `BasicUDIs.xlsx` has been applied.

## Current Decisions

- this tab now covers all in-scope non-accessories product families
- the validation unit is a source row linked to a `Product Variant`
- readiness is summarized upward by:
  - `Product Family`
  - `Product Variant`
  - selected sample row
- `POST` and `PATCH` are both visible in the validation view
- the current implementation uses one shared canonical-required field set for both operations
- `Template for Accessories_Footspares EUDAMED.xlsx` remains explicitly out of scope while awaiting QMS mapping rules

## Product Scope

- in scope:
  - `Echelon`
  - `Elan`
  - `Elite`
  - `Epirus / Esprit`
  - `Navigator / Javelin / Linx`
- currently deferred:
  - `Template for Accessories_Footspares EUDAMED.xlsx`
  - QMS accessory and footspare mapping rules are awaited before this workbook is brought into active validation scope

## What The User Does Here

- review overall validation readiness across all in-scope product families
- drill down into one product family
- drill down further into one product variant
- inspect representative sample rows for that variant
- review common blocker fields across the current scope
- inspect field-level canonical evidence for a selected sample row
- compare workbook header coverage against the active canonical review path

## Current Validation Scope

- source rows are parsed from the in-scope workbook set
- each in-scope sheet is matched to a `BasicUDIs.xlsx` `Device Model`
- variant-level Basic UDI reference data supplies:
  - `Basic UDI-DI`
  - operation
  - basic device properties
  - market availability context
- row completeness is measured against the current canonical-required field set
- completeness is currently not split into separate `POST` and `PATCH` rule sets
- repeated structures such as:
  - `Market Availability`
  - `Storage Conditions`
  - `Critical Warnings`
  are represented in the validation model and surfaced in the selected-sample view

## Review Hierarchy

The validation tab is now organized as a drilldown:

1. all-family summary
2. selected family summary
3. selected variant summary
4. selected sample row evidence

This is intended to let QMS and business reviewers move from broad readiness visibility into specific row-level issues without starting from a single workbook tab.

## Design Intent

The `Canonical Validation` tab should help a reviewer answer:

- which product families are currently ready for deeper submission preparation?
- which product variants within a family are ready or blocked?
- what are the most common missing canonical fields?
- what repeated structures are being assembled from the workbook or reference data?
- what does a selected sample row currently look like in canonical terms?

## Workbook Coverage

`Workbook Coverage Summary` is still header-level, not row-level.

It answers:

- which source headers across the in-scope workbook set are represented in the canonical review path
- which headers are only partially covered
- which headers are not yet represented

This is intentionally separate from row completeness. A header may be documented in the canonical model even if some rows still fail completeness because required values are missing.

## QMS Header Review Note

The current in-scope workbook set contains a small number of header wording variations that appear to represent the same business meaning. The application now handles the known variants, but the differences are worth reviewing with QMS because they increase mapping risk unnecessarily.

### Primary Header Variant

The most important current example is the `UDI-DI code` source column.

Observed header variants:

- `UDI-DI code e.g. taken from 2nd page of DoC (Note: needs to be 14 digits long, add zero to front of code)`
- `UDI-DI code e.g. taken from ist page of DoC (Note: needs to be 14 digits long, add zero to front of code)`

Observed workbook usage:

- `Echelon`
  - uses the `2nd page of DoC` wording
- `Elan`
  - uses the `ist page of DoC` wording
- `Elite`
  - uses both forms across different sheets
- `Epirus / Esprit`
  - uses the `ist page of DoC` wording
- `Navigator / Javelin / Linx`
  - uses the `ist page of DoC` wording

Why this matters:

- this variation caused a false validation blocker before alias handling was added
- the underlying row data existed, but exact header matching initially failed
- standardizing the workbook header would reduce avoidable mapping logic

### Secondary Header Variant

The `Catalogue number` field also shows a wording variation:

- `Reference/ Catalogue number e.g . Taken from Product code in second page of DoC`
- `Reference/ Catalogue number e.g . Taken from Product code on second page of DoC`

This appears mainly as an `Echelon` variation and is less severe than the `UDI-DI code` case, but it is another example of equivalent meaning expressed with different template wording.

### General Wording Notes

Some workbook templates also contain recurring wording inconsistencies such as:

- `ist page of DoC`
- `Decription detail`
- `sterilsation`

These do not always break the current mapping path, but they are still useful to raise with QMS as candidates for workbook-template standardization.

### Source Evidence

Yes, these nuances can be seen directly in the input Excel workbooks. They are not inferred only from code or documentation. The current validation and mapping logic is based on the actual workbook headers observed in the source templates.

## Current Limitation

The validation tab now reflects the broadened multi-family canonical design. `XML Generation` does not yet fully do so.

That means:

- validation is now family-aware and variant-aware
- XML generation still needs its own redesign so that:
  - product family is selected first
  - product variants can then be selected
  - generation runs as:
    - `Single XML`
    - `Variant Batch XML`

## Near-Term Direction

The next implementation step after this validation redesign is to align `XML Generation` with the same product-family and product-variant structure.

The expected direction is:

- choose a `Product Family`
- choose one or more `Product Variants`
- generate:
  - a single XML for a selected variant row
  - or a variant batch XML for all eligible rows in that variant
