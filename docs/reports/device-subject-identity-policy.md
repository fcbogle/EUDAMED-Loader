# Device Subject Identity Policy

## Historical policy status — reviewed 9 October 2026

The original proposal below predates the current identity resolver. Dev import now
classifies matches using primary UDI-DI or fallback labels, records explicit
identity issues/drift, and links source rows to device subjects. Source/device read
paths and reviewed/testing device-subject links exist. The original Current Import
Behavior, limitations and next-step sections are historical, not a description of
an unchanged simple upsert. Consult
[workbook_import.py](../../backend/app/services/workbook_import.py) and the
[current handoff](../session-handoff.md) before modifying identity logic.

Production preparation reconciles issuer plus UDI-DI (parent issuer plus Basic
UDI-DI). That issuer-aware contract must not be reduced to a bare code or catalogue
match. Application importer adaptation is still proposed in the
[Production importer design](../production-importer-design.md); this document does
not authorize changing Dev matching behavior or the database model.

## Purpose

This document defines the next database-design step for workbook import identity handling:

- keep all imported workbook rows in `source_row`
- collapse repeated representations of the same child device into one `device_subject`
- record ambiguity, conflict, and drift explicitly rather than silently overwriting meaning

This is the policy the importer should follow before additional workflow tables are linked to `device_subject_id`.

## Current Import Behavior

The current workbook import already does two distinct things:

- stores every imported row in `source_row`
- upserts one `device_subject` per normalized `subject_key`

Current `subject_key` behavior is simple:

- normalize `product_family`
- normalize `product_variant`
- use normalized `catalogue_number`
- if `catalogue_number` is missing, fall back to normalized `primary_udi_di`

Current limitations:

- `primary_udi_di` is not the primary match key when both identifiers are present
- conflicting identifiers are not surfaced as explicit identity issues
- drift across imports is absorbed into the latest `device_subject` row via `current_source_row_id`

## Intended Role Of `device_subject`

`device_subject` is the stable identity record for one child device.

It should represent:

- one regulatory/business device identity over time
- the join target for reviewed baseline state, testing state, accepted state, and submission history

It should not represent:

- one imported workbook row
- one XML event
- one PATCH version
- one acceptance result

## Identity Principles

1. Never delete or suppress raw source evidence during import.
2. Prefer strong regulatory identifiers over descriptive labels when they are present and trustworthy.
3. Treat workbook label drift as a reviewable data-quality issue, not automatic identity split.
4. Treat conflicting identifiers as explicit issues, not automatic merges.
5. Only create a new `device_subject` when the device identity is genuinely different.

## Matching Keys

### Strong Key

- `primary_udi_di`

This is the preferred identity key when present and non-blank.

### Fallback Key

- `product_family`
- `product_variant`
- `catalogue_number`

This is the operational fallback when `primary_udi_di` is missing or not yet usable.

### Parent Grouping Key

- `basic_udi_di`

This is not the child device identity key. It groups related child devices under one parent lineage.

## Import Decision Table

| Case | Incoming Row | Existing Match | Action | Outcome |
| --- | --- | --- | --- | --- |
| 1 | `primary_udi_di` present | same `primary_udi_di` exists | attach row to existing `device_subject` | same device, possible drift review |
| 2 | `primary_udi_di` blank | exactly one fallback tuple match exists | attach row to existing `device_subject` | same device by fallback identity |
| 3 | `primary_udi_di` blank | no fallback tuple match exists | create new `device_subject` | new unresolved-but-distinct subject |
| 4 | `primary_udi_di` blank | multiple fallback tuple matches exist | do not auto-resolve | create identity issue: ambiguous fallback match |
| 5 | `primary_udi_di` present | no `primary_udi_di` match and no fallback tuple match | create new `device_subject` | new device |
| 6 | `primary_udi_di` present | fallback tuple match exists but stored `primary_udi_di` differs | do not auto-merge | create identity issue: identifier conflict |
| 7 | `primary_udi_di` present | same `primary_udi_di` exists but tuple fields changed | attach to existing `device_subject` | same device, create drift issue |
| 8 | missing `primary_udi_di` and incomplete fallback tuple | no reliable identity basis | do not auto-match | create identity issue: insufficient identity data |

## Recommended Import Actions By Case

### Case 1: Exact Strong Match

Match on `primary_udi_di`.

Action:

- keep the row in `source_row`
- link it to the existing `device_subject`
- update `current_source_row_id`
- compare identity labels for drift

### Case 2: Exact Fallback Match

Use `product_family` + `product_variant` + `catalogue_number` only when `primary_udi_di` is absent.

Action:

- keep the row in `source_row`
- link it to the existing `device_subject`
- mark the match as fallback-derived if provenance tracking is added later

### Case 3: New Subject By Fallback

If `primary_udi_di` is blank and no fallback match exists:

- create a new `device_subject`
- keep the row in `source_row`

This is acceptable, but should remain easier to revisit if a later import provides `primary_udi_di`.

### Case 4: Ambiguous Fallback Match

If multiple subjects satisfy the fallback tuple:

- do not choose one silently
- keep the row in `source_row`
- create an issue record for manual review

### Case 5: New Subject By Strong Key

If `primary_udi_di` is present and matches nothing:

- create a new `device_subject`
- keep the row in `source_row`

### Case 6: Identifier Conflict

If the tuple suggests one subject but `primary_udi_di` suggests a different identity:

- do not overwrite identifiers automatically
- do not silently merge
- create an identity conflict issue

Default assumption: source drift or identity collision, not safe equivalence.

### Case 7: Drift On The Same Strong Identity

If `primary_udi_di` matches but `catalogue_number`, `product_family`, or `product_variant` changed:

- keep one `device_subject`
- keep the new row in `source_row`
- update `current_source_row_id`
- create a drift issue for review

### Case 8: Insufficient Identity Data

If both `primary_udi_di` and the fallback tuple are unusable:

- keep the row in `source_row`
- do not create or attach a `device_subject` automatically
- create an issue for manual review

## What Belongs On `device_subject`

Stable identity and join fields only:

- `id`
- `subject_key`
- `product_family`
- `product_variant`
- `catalogue_number`
- `primary_udi_di`
- `basic_udi_di`
- `current_source_row_id`
- `created_at`
- `updated_at`

## What Does Not Belong On `device_subject`

Mutable operational state should live elsewhere:

- reviewed/unreviewed baseline flags
- successful or failed Playground outcomes
- current accepted PATCH version
- XML payloads
- scenario-specific field changes
- submission history

Those belong in:

- `source_row`
- reviewed-baseline tables
- testing-state/history tables
- accepted-state snapshot tables
- submission/audit tables

## Recommended Supporting Table

Add an explicit issue table before deepening identity logic further.

Suggested initial shape:

`device_identity_issue`

- `id`
- `source_row_id`
- `device_subject_id` nullable
- `issue_code`
- `severity`
- `details_json`
- `created_at`
- `resolved_at` nullable
- `resolution_note` nullable

Suggested issue codes:

- `ambiguous_fallback_match`
- `identifier_conflict`
- `identity_label_drift`
- `insufficient_identity_data`

## Recommended Implementation Sequence

1. Keep `source_row` append-only.
2. Replace the current implicit `subject_key` rule with explicit match evaluation in code.
3. Prefer `primary_udi_di` first when present.
4. Fall back to `product_family` + `product_variant` + `catalogue_number` only when needed.
5. Add explicit identity-issue recording for ambiguity, conflict, and drift.
6. Add read endpoints for `device_subject` and `source_row`.
7. Only after the identity layer is stable, link reviewed-baseline and testing-state tables to `device_subject_id`.

## Immediate Practical Next Step

Implement importer-side match classification without changing the append-only `source_row` behavior.

That should produce one of these outcomes per row:

- `created_subject`
- `matched_existing_subject_by_primary_udi_di`
- `matched_existing_subject_by_fallback_tuple`
- `identity_issue_ambiguous`
- `identity_issue_conflict`
- `identity_issue_insufficient_data`

That is the point where the current workbook import stops being a simple upsert and becomes a reliable identity-resolution layer for the rest of the SQLite design.
