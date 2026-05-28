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
- compare canonical completeness with XML readiness
- review common blocker fields across the current scope
- inspect field-level canonical evidence for a selected sample row

## Current Validation Scope

- source rows are parsed from the in-scope workbook set
- each in-scope sheet is matched to a `BasicUDIs.xlsx` `Device Model`
- variant-level Basic UDI reference data supplies:
  - `Basic UDI-DI`
  - operation
  - basic device properties
  - market availability context
- `Manufacturer SRN` and `Authorised Representative SRN` are currently supplemented from the legacy tracekey workbook because the authoritative `BasicUDIs.xlsx` workbook does not yet carry those SRN values
- row completeness is measured against the current canonical-required field set
- XML readiness is now measured separately against the current XML-facing required field set
- completeness is currently not split into separate `POST` and `PATCH` rule sets
- repeated structures such as:
  - `Market Availability`
  - `Storage Conditions`
  - `Critical Warnings`
  are represented in the validation model and surfaced in the selected-sample view
- the validation field set is now aligned to the current Canonical review field set so Canonical Validation can act as the operational basis for later XML generation

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
- which rows are canonically understandable but still not yet XML-ready?
- what are the most common missing canonical fields?
- what are the most common missing XML-facing fields?
- what repeated structures are being assembled from the workbook or reference data?
- what does a selected sample row currently look like in canonical terms?

## Canonical Completeness Versus XML Readiness

The validation tab now separates two different review questions:

- `Canonical completeness`
  - are the fields needed for the current canonical review contract present?
- `XML readiness`
  - are the fields needed for the current XML payload shape present?

This matters because a row can now be canonically understandable while still not being ready for XML generation.

The current main example used during the redesign was `Manufacturer SRN`:

- it is an XML-facing requirement
- it is not currently carried by `BasicUDIs.xlsx`
- it is not currently carried by the in-scope device-row workbooks
- it is therefore supplemented from `data/basic_udi_reference/uat-eudamed_mdr_products_tracekey_sample_data.xlsx`
- QMS has confirmed that the current legacy SRN values are valid across the in-scope product families for the present preparation phase

At present this supplemental SRN enrichment removes the SRN XML blocker across the in-scope validation population. It should still be treated as a narrow supplemental source, not as a replacement for the new authoritative `BasicUDIs.xlsx` workbook.

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

## Current Integration

The validation tab now reflects the broadened multi-family canonical design, distinguishes canonical completeness from XML readiness, and mirrors the current Canonical field set. `XML Generation` now consumes that aligned validation output directly.

That means:

- validation is now family-aware and variant-aware
- validation now surfaces XML-facing blockers explicitly
- validation now provides the aligned Canonical field set that XML generation consumes
- XML generation now follows the same product-family and product-variant structure
- XML generation now supports:
  - `Single XML`
  - `Variant Batch XML`

## Current Downstream Use

The current XML generation flow now uses Canonical Validation as its operational gate.

The current direction in use is:

- choose a `Product Family`
- choose a `Product Variant`
- generate:
  - a single XML for an auto-selected XML-ready sample row
  - or a variant batch XML for all eligible rows in that variant
