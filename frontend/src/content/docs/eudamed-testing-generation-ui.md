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
- fixture-backed preview and download
- no freeform PATCH editing

Active candidate scenarios:

- `trade_name_edit`
- `warning_add`
- `storage_condition_edit`

Inactive scenario:

- `secondary_identifier_add`
  - still incomplete
  - not currently surfaced as an active generated scenario

Current implementation direction:

- scenario-driven UI
- scenario metadata rather than per-scenario hardcoded screens
- one shared registered-device base per fixture family

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
- local schema validity and fixture comparison do not prove EUDAMED acceptance by themselves

The interface should therefore make a clear distinction between:

- XML patterns under test
- XML patterns ready for real upload preparation
