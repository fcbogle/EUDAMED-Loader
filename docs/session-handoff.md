# Session Handoff

## Current Objective

Continue refining the XML workspaces so the UI clearly separates:

- `EUDAMED Testing`
- `EUDAMED Generation`

while keeping `Patch XML` as a controlled testing workflow that:

- requires a reviewed `Post + Patch` baseline for the exact selected record
- derives later scenario `PATCH` drafts from that proven first child `PATCH`
- preserves device lineage by carrying the selected parent record identity through scenario generation
- shows explicit before/after business comparison before XML generation
- shows toggle-based comparison between baseline and derived `PATCH` XML
- requires the user to enter the `e:version` integer for each later scenario draft
- keeps candidate PATCH testing conservative and separate from accepted generation patterns

## Latest Confirmed Decisions

- Baseline `POST` remains version `1`.
- Equivalent first child `PATCH` remains version `2`.
- Later scenario `PATCH` drafts inherit from that first proven `PATCH`.
- The user must enter the next scenario `PATCH` version explicitly based on the EUDAMED playground state.
- `Patch XML` must not unlock until `Post + Patch` has been generated and reviewed for the same selected catalogue number in the current session.
- Scenario generation must target the exact selected parent record, not just the first `POST` row in the variant.

## Current Implemented Behavior

### EUDAMED Testing

Current pill order:

- `Post + Patch`
- `Patch XML`
- `Market Info`
- divider
- `Single XML`
- `Batch XML`

Shared-device testing group:

- `Post + Patch`
- `Patch XML`
- `Market Info`

General XML tools:

- `Single XML`
- `Batch XML`

### Post + Patch

- Uses the currently selected XML-ready `POST` record.
- Generates:
  - one baseline `POST`
  - one equivalent first child `PATCH`
- Validates both locally against the schema set.
- Provides download as a pair package.

### Patch XML

Current implementation is generated, not fixture-backed.

It now:

- uses the exact selected `POST` parent record identified by:
  - `product_family`
  - `product_variant`
  - `catalogue_number`
- requires the user to generate and review `Post + Patch` first for that same record
- blocks scenario drafting until that reviewed baseline pair exists in the current session
- derives scenario drafts from the baseline first child `PATCH`
- supports the active scenarios:
  - `trade_name_edit`
  - `warning_add`
  - `storage_condition_edit`
- requires explicit user-supplied `PATCH` version input
- shows:
  - baseline-versus-draft business comparison
  - draft readiness messaging
  - baseline-versus-derived XML toggle
  - generated XML change summary after preview
- validates generated XML locally and supports download

Important limitation:

- PATCH scenario status remains UI state only
- it is not persisted

### Market Info

- Uses the selected XML-ready record / shared testing anchor
- Generates one standalone `MARKET_INFO.PUT` message
- Validates locally and supports download

### Single XML / Batch XML

- Still operate from the broader XML-ready family/variant selection model
- Do not use the shared baseline-pair gate

## Current PATCH Workflow

1. Select product family, variant, and the XML-ready record to use as the parent `POST`.
2. Open `Post + Patch` and generate the baseline pair.
3. Review the baseline `POST` and equivalent first `PATCH`.
4. Open `Patch XML`.
5. Confirm the same parent catalogue number is shown and the baseline pair is marked reviewed.
6. Choose one approved scenario type.
7. Enter the next `PATCH` version integer.
8. Enter only the scenario-specific change values.
9. Review the before/after business summary.
10. Generate the derived scenario `PATCH`.
11. Compare:
   - baseline first `PATCH`
   - derived scenario `PATCH`
12. Review local XSD validation and download if needed.

## Implemented Guardrails

- Generated scenario `PATCH` preview/download now require `catalogue_number` in the request contract.
- Backend record selection now resolves an exact XML-ready `POST` record for:
  - family
  - variant
  - catalogue number
- `Patch XML` stays blocked unless the reviewed baseline pair in memory matches the same:
  - product family
  - product variant
  - catalogue number
- The UI no longer allows random scenario drafting from a variant without a reviewed baseline pair.

## Current Scenario Scope

Active generated scenarios:

- `Trade Name Edit`
- `Critical Warnings`
- `Storage Condition Edit`

Deferred / inactive scenario:

- `Secondary Identifier Add`
  - still incomplete
  - not exposed as an active generated scenario

## Current XML Facts

- Accepted testing baseline remains:
  - `POST -> DEVICE.POST`
  - `PATCH -> UDI_DI.PATCH`
- Scenario-derived later `PATCH` payloads are built from the baseline first child `PATCH`.
- Non-scenario fields should stay aligned with the reviewed baseline pair.
- Expected scenario deltas are limited to:
  - `e:version`
  - the scenario-approved target field(s)
- Catalogue number is currently represented in the XML as:
  - `udidi:referenceNumber`

## Documentation Alignment

The current docs now need to describe:

- generated `Patch XML`, not fixture-backed `Patch XML`
- exact parent-record lineage
- reviewed baseline-pair gating
- before/after comparison as a current feature, not a future idea

Files refreshed in this pass:

- `docs/session-handoff.md`
- `frontend/src/content/docs/xml-generation.md`
- `frontend/src/content/docs/eudamed-testing-generation-ui.md`

## Still Missing

- persistence for PATCH scenario status (`EUDAMED Candidate` / `EUDAMED Accepted`)
- persistence for baseline-family acceptance state
- automatic promotion of accepted PATCH scenarios into `EUDAMED Generation`
- explicit `POST Batch` / `PATCH Batch` redesign
- scenario-driven `PATCH Batch` generation
- broader scenario library beyond the current three active generated scenarios
- completion of `secondary_identifier_add`
- external confirmation that candidate scenarios are operationally accepted by EUDAMED

## Recommended Next Step

Focus next on operational clarity rather than more XML shape changes:

1. decide whether accepted scenario PATCH patterns should ever appear in `EUDAMED Generation`
2. design persistence for baseline review / scenario acceptance state
3. decide the future of:
   - `Single XML`
   - generic `Batch XML`
   - explicit `POST Batch`
   - explicit scenario-driven `PATCH Batch`
