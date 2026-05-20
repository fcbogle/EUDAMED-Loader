# Canonical Validation

## Purpose

The `Canonical Validation` area is the mapping-review checkpoint for the first-phase canonical design. It does not validate workbook rows or XML instances yet. Instead, it highlights where the mapping definition still depends on assumptions, derived context, or unresolved source evidence.

## Current Decisions

- this tab is for mapping validation, not record-level validation
- the current focus is first-phase `MDR` `UDI-DI` preparation
- the tab should make review risk visible without overwhelming the user with all mapping detail at once
- `derived`, `gap`, `needs clarification`, and controlled-value review areas should be easy to isolate

## What The User Does Here

- review fields that are not purely direct mappings
- challenge or accept first-phase assumptions
- identify fields with missing or unconfirmed source evidence
- confirm which items need later schema or operational clarification

## Initial Validation Scope

- fields classified as `derived`
- fields classified as `gap`
- fields with decision status `needs_clarification`
- fields classified as `normalized`
- fields that rely on assumptions or external context

## Out Of Scope For This Tab

- row-by-row workbook validation
- XML instance validation
- payload generation checks
- submission workflow validation

## Design Intent

The `Canonical Validation` tab should help a reviewer answer:

- what is not a straightforward direct mapping?
- what still depends on external context or assumptions?
- what is not yet fully evidenced by the workbook source?
- what should be resolved before later row-level transformation or XML generation work
