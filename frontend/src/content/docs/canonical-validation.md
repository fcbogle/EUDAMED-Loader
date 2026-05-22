# Canonical Validation

## Purpose

The `Canonical Validation` area is the mapping-review checkpoint for the first-phase canonical design. It is now `Echelon`-specific and acts as the readiness gate between canonical mapping and XML generation.

## Current Decisions

- this tab is for `Echelon`-specific canonical readiness review
- the current focus is first-phase `MDR` `UDI-DI` preparation
- the tab should show the effect of applying shared Basic UDI context before XML generation
- the tab should make review risk visible without overwhelming the user with all row-level detail at once
- header coverage and record completeness are both now part of the review story

## What The User Does Here

- review the before/after effect of `Basic UDI-DI` enrichment on `Echelon` rows
- inspect common blockers rather than scanning all rows individually
- review source-field coverage against the current canonical/XML-facing path
- identify which areas are fully represented, partially represented, or still deferred
- confirm which items need later schema or operational clarification

## Current Validation Scope

- all `Echelon` workbook rows inherit the same `Basic UDI-DI` family context
- completeness is measured against the wider XML-facing field set now tracked by the backend validation service
- the current bundle includes:
  - record completeness before and after enrichment
  - common missing-field summaries
  - sheet-level summaries
  - representative sample records
  - source-field coverage by workbook header

## Out Of Scope For This Tab

- full batch XML generation
- submission workflow execution
- enum normalization for every repeated or optional schema structure
- pretending that repeated workbook template areas are fully modeled when the current implementation still treats them conservatively

## Design Intent

The `Canonical Validation` tab should help a reviewer answer:

- what changes when shared `Basic UDI-DI` context is applied?
- which rows are complete enough to enter XML generation?
- how much of the source workbook is represented by the current canonical/XML-facing path?
- which workbook areas are still only partially modeled?
- what should be resolved before expanding the XML package scope beyond the current single-record path?

## Source Field Coverage

The `Source Field Coverage` section is header-level, not row-level.

It answers:

- which Echelon workbook headers are represented in the current canonical/XML-facing path
- which headers are only partially represented because they imply richer repeated structures
- which headers are not yet represented or intentionally deferred

For the current `Echelon` family:

- indicator-only areas such as clinical size applicability, CMR presence, and endocrine-disrupting presence are treated as represented because all rows currently indicate `No`
- the remaining partials are the genuinely structured repeat areas:
  - storage conditions
  - critical warnings
