# EUDAMED Testing And Generation UI Note

## Purpose

This note captures the current UI direction for separating XML testing from XML generation that is intended for real EUDAMED use.

The goal is to keep candidate XML patterns available for review and experimentation without making them appear operationally ready for upload preparation.

## Agreed Top-Level Areas

Two top-level areas should exist:

- `EUDAMED Testing`
- `EUDAMED Generation`

`EUDAMED Testing` is the workspace for comparison, candidate scenario review, XML preview, and shape validation.

`EUDAMED Generation` is the workspace for generation patterns that are considered ready for actual EUDAMED upload preparation.

## Status Labels

Only two status labels are currently required:

- `EUDAMED Candidate`
- `EUDAMED Accepted`

Intended meaning:

- `EUDAMED Candidate`
  - pattern is available for XML review and external testing
  - pattern is not yet confirmed as accepted by EUDAMED
- `EUDAMED Accepted`
  - pattern has user-confirmed evidence of EUDAMED acceptance
  - pattern may be used in operational XML generation flows

Status should be user-editable in the UI.

Default rule:

- new PATCH scenarios start as `EUDAMED Candidate`

Initial known accepted rule:

- the current `Post + Patch` pair starts as `EUDAMED Accepted`

## EUDAMED Testing Workspace

The existing `XML Generation` area should be renamed to `EUDAMED Testing`.

Initial pill set:

- `Post + Patch`
- `Single XML`
- `Market Info`
- `Batch XML`
- `Patch XML`

This workspace may show both candidate and accepted patterns.

Its purpose is:

- XML comparison
- candidate PATCH scenario review
- preview and diff inspection
- schema validation
- export for external testing

## Patch XML Scope

`Patch XML` should be introduced inside `EUDAMED Testing`, not as a separate top-level area.

First-release scope should remain narrow:

- one record at a time
- one PATCH scenario at a time
- scenario-driven generation
- no freeform PATCH editing

Initial scenarios:

- `trade_name_edit`
- `warning_add`
- `storage_condition_edit`

The design should be easy to extend with additional scenarios later.

Recommended implementation direction:

- define PATCH scenarios from configuration or manifests
- keep the UI driven by scenario metadata rather than hardcoded per-scenario screens

## EUDAMED Generation Workspace

`EUDAMED Generation` should be a separate top-level area alongside `EUDAMED Testing`.

This workspace should expose only `EUDAMED Accepted` patterns.

Initial expectation:

- `Post + Patch` is available here
- candidate PATCH scenarios are not available here until the user marks them `EUDAMED Accepted`

## Visibility Rule

The current operating rule should be:

- `EUDAMED Testing` can show both `EUDAMED Candidate` and `EUDAMED Accepted`
- `EUDAMED Generation` should show only `EUDAMED Accepted`

If the accepted-only workspace looks sparse initially, use a short explanatory note rather than showing disabled candidate options.

Suggested note:

`Only EUDAMED Accepted XML patterns are available here. Use EUDAMED Testing to review and promote candidate patterns.`

## Why This Split

This split keeps the application aligned with the current project phase:

- the application is still a preparation and review tool
- several PATCH scenarios are still candidate patterns rather than operationally proven flows
- local schema validity and fixture comparison do not by themselves prove EUDAMED acceptance

The UI should therefore make a clear distinction between:

- XML patterns being tested or reviewed
- XML patterns ready for real EUDAMED upload preparation

## Immediate Next Step

The next implementation step should be to introduce the structural UI split before expanding PATCH generation logic:

1. Rename `XML Generation` to `EUDAMED Testing`
2. Add the new top-level `EUDAMED Generation` area
3. Add the `Patch XML` pill inside `EUDAMED Testing`
4. Surface `EUDAMED Candidate` and `EUDAMED Accepted` status labels in the UI
5. Restrict `EUDAMED Generation` to accepted patterns only
