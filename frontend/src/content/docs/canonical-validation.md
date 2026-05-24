# Canonical Validation

## Purpose

The `Canonical Validation` area is the mapping-review checkpoint for the first-phase canonical design. It is now `Echelon`-specific and acts as the readiness gate between canonical mapping and XML generation.

## Current Decisions

- this tab is for `Echelon`-specific canonical readiness review
- the current focus is first-phase `MDR` `UDI-DI` preparation
- the tab should show the effect of applying shared Basic UDI context before XML generation
- the tab should make review risk visible without overwhelming the user with all row-level detail at once
- header coverage and record completeness are both now part of the review story
- tracked validation fields and represented source headers are intentionally shown as different measures

## What The User Does Here

- review the before/after effect of `Basic UDI-DI` enrichment on `Echelon` rows
- inspect common blockers rather than scanning all rows individually
- review source-field coverage against the current canonical/XML-facing path
- identify which areas are fully represented, partially represented, or still deferred
- confirm which items need later schema or operational clarification

## Current Validation Scope

- all `Echelon` workbook rows inherit the same `Basic UDI-DI` family context
- completeness is measured against the wider XML-facing field set now tracked by the backend validation service
- the `Before Mapping Preview` shows the workbook-only row state
- the `After Mapping Preview` shows the same row after shared Basic UDI-DI enrichment is applied
- `Workbook Coverage Summary` is a separate header-level measure and should not be read as a row-completeness count
- the current bundle includes:
  - record completeness before and after enrichment
  - common missing-field summaries
  - sheet-level summaries
  - representative sample records
  - source-field coverage by workbook header

## Out Of Scope For This Tab

- running XML generation workflows from within this review tab
- submission workflow execution
- pretending that repeated workbook template areas are fully modeled when the current implementation still treats them conservatively

## Design Intent

The `Canonical Validation` tab should help a reviewer answer:

- what changes when shared `Basic UDI-DI` context is applied?
- which rows are complete enough to enter XML generation?
- how much of the source workbook is represented by the current canonical/XML-facing path?
- which workbook areas are still only partially modeled?
- what should be resolved before widening the current XML-facing scope further?

## Source Field Coverage

The `Source Field Coverage` section is header-level, not row-level.

It answers:

- which Echelon workbook headers are represented in the current canonical/XML-facing path
- which headers are only partially represented because they imply richer repeated structures
- which headers are not yet represented or intentionally deferred

This is why the pill counts in `Validation Scope` are intentionally split:

- tracked fields:
  - flat validation targets in the XML-facing subset
- required fields:
  - the tracked targets used for completeness scoring
- represented source headers:
  - workbook headers that currently have documented coverage somewhere in the canonical/XML-facing path

For the current `Echelon` family:

- indicator-only areas such as clinical size applicability, CMR presence, and endocrine-disrupting presence are treated as represented because all rows currently indicate `No`
- `Storage Conditions` and `Critical Warnings` are now also represented for the current dataset because:
  - the workbook groups are assembled into repeated item structures
  - the observed Echelon phrases have explicit schema enum mappings

## Enum Strategy In Validation

The validation view now uses a two-layer representation for repeated structures:

- raw workbook phrase:
  - what the source row actually says
- normalized schema code:
  - the enum value the XML generator will emit

For the current `Echelon` data, the normalized mappings are:

- `Lower limit of temp` -> `SHC006`
- `Upper limit of temp` -> `SHC007`
- `Consult instructions for use` -> `CW010`

This is why the selected-sample cards now show both the assembled item and the schema code. The purpose is to let a reviewer confirm:

- what the workbook said
- how the app interpreted it
- what code will be used in the XML
