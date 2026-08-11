# EUDAMED Testing And Generation UI Note

## Purpose

This note describes the current UI direction for separating:

- XML patterns being tested or reviewed
- XML patterns considered ready for actual EUDAMED upload preparation

The goal is to keep candidate XML patterns available for review and external testing without making them appear operationally ready.

## Top-Level Areas

Two top-level areas now exist:

- `EUDAMED Testing`
- `EUDAMED Generation`

`EUDAMED Testing` is the workspace for comparison, candidate scenario review, preview, validation, and export.

`EUDAMED Generation` is the workspace for accepted-only XML generation patterns.

## Status Labels

Only two status labels are currently used:

- `EUDAMED Candidate`
- `EUDAMED Accepted`

Intended meaning:

- `EUDAMED Candidate`
  - available for local review and external EUDAMED testing
  - not yet confirmed as accepted by EUDAMED
- `EUDAMED Accepted`
  - user-confirmed as accepted by EUDAMED
  - suitable for operational generation workflows

Current UI behavior:

- PATCH scenario status is user-editable in the UI
- the accepted baseline `Post + Patch` pair is treated as `EUDAMED Accepted`
- the three active PATCH scenarios start as `EUDAMED Candidate`

## EUDAMED Testing Workspace

The former `XML Generation` area is now `EUDAMED Testing`.

Current pill order:

- `Post + Patch`
- `Patch XML`
- `Market Info`
- divider
- `Single XML`
- `Batch XML`

This layout intentionally separates:

- shared registered-device testing tools
- general XML tools

### Shared Registered-Device Testing Group

These three modes now relate to the same registered device:

- `Post + Patch`
- `Patch XML`
- `Market Info`

They use a shared `Registered Device Anchor`, currently surfaced in the UI only for these three modes.

The anchor panel is intended to show that all three XML patterns relate to the same registered device after successful POST registration.

### General XML Tools

These two modes remain general XML generation/review tools:

- `Single XML`
- `Batch XML`

They do not use the registered device anchor.

They still work from the broader XML-ready validation selection model:

- `Product Family`
- `Product Variant`
- and, for single-record generation, one selected record

## Patch XML Scope

`Patch XML` is part of `EUDAMED Testing`, not a separate top-level area.

Current scope remains deliberately narrow:

- one candidate PATCH scenario at a time
- generated preview and download
- no freeform PATCH editing
- strict dependency on a reviewed `Post + Patch` pair for the exact selected record

Current redesign direction now implemented:

- build on the existing generated `Post + Patch` pair for the selected record
- treat the first child `PATCH` from that pair as the lineage starting point
- resolve the latest successful tracked state for that same device before generating later scenario PATCH drafts
- require the user to enter the version integer for each scenario PATCH draft
- show business-field before/after comparison before generation
- show toggle-based XML comparison between:
  - current accepted base state
  - derived scenario `PATCH`

Active candidate scenarios:

- `trade_name_edit`
- `warning_add`
- `storage_condition_edit`

Current implementation direction:

- scenario-driven UI
- scenario metadata rather than per-scenario hardcoded screens
- one selected parent `POST` plus equivalent first `PATCH` per selected record
- explicit, user-supplied scenario PATCH version input
- exact lineage preserved through `catalogue_number`
- scenario drafting blocked until `Post + Patch` has been generated and reviewed for that same record

## PATCH Version Rule

The current intended version model is:

- baseline `POST` is version `1`
- baseline equivalent first `PATCH` is version `2`
- every later scenario PATCH draft requires a user-entered integer version
- every later scenario PATCH draft must be greater than the latest successful tracked version for that device

The user should provide the scenario PATCH version because the user can inspect the current version state in the EUDAMED playground.

The UI should therefore:

- display the current accepted base version for the selected device lineage
- collect the proposed scenario PATCH version as an explicit input
- never silently auto-increment it

## PATCH Comparison Direction

The current `Patch XML` workspace is now comparison-driven and record-driven.

Current comparison areas:

- parent `POST` and current accepted device-state context
- scenario-specific editable fields only
- before/after business values
- toggle-based XML comparison between baseline and derived scenario PATCH

## EUDAMED Generation Workspace

`EUDAMED Generation` is a separate top-level area alongside `EUDAMED Testing`.

This workspace exposes only `EUDAMED Accepted` XML patterns.

Current state:

- `Post + Patch` is available here
- candidate PATCH scenarios are not yet available here

## Visibility Rule

Current operating rule:

- `EUDAMED Testing` may show both `EUDAMED Candidate` and `EUDAMED Accepted`
- `EUDAMED Generation` shows only `EUDAMED Accepted`

Suggested user message remains:

`Only EUDAMED Accepted XML patterns are available here. Use EUDAMED Testing to review and promote candidate patterns.`

## Why This Split

This keeps the UI aligned with the current project phase:

- the application is still a preparation and review tool
- several PATCH scenarios are still candidate patterns rather than operationally proven flows
- local schema validity and internal comparison do not prove EUDAMED acceptance by themselves

The interface should therefore make a clear distinction between:

- XML patterns under test
- XML patterns ready for real upload preparation
