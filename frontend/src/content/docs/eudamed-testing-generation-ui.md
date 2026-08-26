# EUDAMED Testing And Generation UI Note

## Purpose

This note describes the current UI direction for:

- operationally accurate XML assessment
- controlled XML preview and validation
- successful Playground outcome capture
- separation between testing workflows and accepted-only generation workflows

## Top-Level Areas

Two top-level areas remain:

- `EUDAMED Testing`
- `EUDAMED Generation`

`EUDAMED Testing` is the active operator workspace for assessment, preview, validation, download, and success-XML upload.

`EUDAMED Generation` remains the accepted-only area.

## Current EUDAMED Testing Modes

The current testing modes are:

- `POST`
- `Patch XML`
- `Market Info`
- `Bulk Basic UDI-DI POST`
- `Bulk Device UDI-DI POST`
- `Bulk PATCH`

The older `Post + Patch` and `Single XML` labels are no longer the current user-facing design.

## Current Workspace Pattern

The active UI direction is to keep each operation workspace aligned around the same pattern:

- an assessment card
- a preview card
- a compact metadata strip
- explicit action buttons
- XML structure and raw XML review
- success upload where the workflow supports it

This pattern has already been applied substantially to single `POST` and single `PATCH` and is being extended across the bulk workspaces.

## Status Labels

Only two business-status labels should be presented consistently:

- `EUDAMED Candidate`
- `EUDAMED Accepted`

Intended meaning:

- `EUDAMED Candidate`
  - ready for local review and Playground testing
  - not yet confirmed as accepted by EUDAMED
- `EUDAMED Accepted`
  - confirmed through user-provided returned success XML
  - suitable to act as tracked accepted lineage

## `POST` Workspace

Single `POST` is now a unified workspace that can produce:

- the next Basic UDI-DI parent-seeding registration
- or the next Device UDI-DI child registration

The UI should explain which situation applies and should not present a misleading generic device candidate when the Basic UDI-DI parent is already tracked as registered.

The workspace should therefore:

- assess availability first
- explain whether the next candidate is parent-seeding or child-only
- generate preview only for the current next valid candidate
- allow success-XML upload after confirmed Playground success

## `Patch XML` Workspace

Single `PATCH` is a controlled scenario-driven workspace.

The UI should:

- identify the next eligible accepted-state device
- show the scenario being prepared
- display concise before/after business meaning
- generate the derived PATCH from the latest successful tracked version
- allow success-XML upload after confirmed Playground success

This workspace is not intended to be a freeform PATCH editor.

## Bulk Workspaces

Bulk workspaces should follow the same UI language as the single-device workspaces while preserving operation-specific controls.

Important distinctions remain:

- `Bulk Basic UDI-DI POST` is parent-only
- `Bulk Device UDI-DI POST` is child-only
- `Bulk PATCH` depends on tracked accepted device state

Bulk status messaging should stay tied to the selected operation, not broad XML-ready counts that can mislead the operator.

## Success Upload Direction

Where success upload is available, the UI should make three things clear:

- the returned XML is evidence of success
- upload updates tracked SQLite operational state
- the workspace should refresh so the next available candidate and remaining counts change immediately

## Why This UI Direction

The UI is no longer just a document viewer around generated XML. It is an operational testing surface.

That means the interface must:

- reflect backend-assessed truth
- explain regulatory meaning clearly
- distinguish parent, child, and PATCH lineage correctly
- stay visually consistent across single and bulk workflows
