# Session Handoff

## Current Objective

Continue refining the XML workspaces so the UI clearly separates:

- `EUDAMED Testing`
- `EUDAMED Generation`

while keeping `Patch XML` as a controlled testing workflow that:

- requires a reviewed `Post + Patch` baseline in the current session before scenario generation unlocks
- derives later scenario `PATCH` drafts from that proven first child `PATCH`
- preserves device lineage by carrying the chosen parent `POST` record identity through scenario generation
- shows explicit before/after business comparison before XML generation
- shows toggle-based comparison between baseline and derived `PATCH` XML
- requires the user to enter the `e:version` integer for each later scenario draft
- keeps candidate PATCH testing conservative and separate from accepted generation patterns

## Latest Confirmed Decisions

- Baseline `POST` remains version `1`.
- Equivalent first child `PATCH` remains version `2`.
- Later scenario `PATCH` drafts inherit from that first proven `PATCH`.
- The user must enter the next scenario `PATCH` version explicitly based on the EUDAMED playground state.
- `Patch XML` remains accessible as a workspace, but scenario generation and download stay blocked until `Post + Patch` has been generated and reviewed for the matching parent record in the current session.
- For the current increment, parent `POST` selection is:
  - the exact selected record if that record is an XML-ready `POST`
  - otherwise the first available XML-ready `POST` in the selected variant
- Deriving later scenario `PATCH` drafts from the reviewed first child `PATCH` is acceptable for the initial testing phase.
- Workbook-drift detection or workbook-refreshed scenario regeneration can be considered later, after initial testing.

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

- Uses the parent `POST` record determined by current selection logic:
  - the exact selected record if it is an XML-ready `POST`
  - otherwise the first available XML-ready `POST` in the selected variant
- Generates:
  - one baseline `POST`
  - one equivalent first child `PATCH`
- Validates both locally against the schema set.
- Provides download as a pair package.

### Patch XML

Current implementation is generated, not fixture-backed.

It now:

- uses the current parent `POST` selection identified by:
  - `product_family`
  - `product_variant`
  - `catalogue_number`
- requires the user to generate and review `Post + Patch` first for that parent record
- keeps the `Patch XML` workspace visible, but blocks scenario generation and download until that reviewed baseline pair exists in the current session
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

- baseline-pair review state is in-memory only for the current session
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

1. Select product family, variant, and the XML-ready record to review.
2. Open `Post + Patch` and generate the baseline pair.
3. Review the baseline `POST` and equivalent first `PATCH`.
4. Open `Patch XML`.
5. Confirm the parent catalogue number shown in `Patch XML` and confirm the baseline pair is marked reviewed.
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
- Backend generated-scenario preview/download resolve an exact XML-ready `POST` record for:
  - family
  - variant
  - catalogue number
- `Patch XML` scenario generation stays blocked unless the reviewed baseline pair in memory matches the same:
  - product family
  - product variant
  - catalogue number
- If the currently selected XML-ready row is not itself a `POST`, the current UI still falls back to the first available XML-ready `POST` in the selected variant.
- The UI no longer allows scenario generation from a variant without a reviewed baseline pair.

## Current Scenario Scope

Active generated scenarios:

- `Trade Name Edit`
- `Critical Warnings`
- `Storage Condition Edit`

## Current XML Facts

- Accepted testing baseline remains:
  - `POST -> DEVICE.POST`
  - `PATCH -> UDI_DI.PATCH`
- Scenario-derived later `PATCH` payloads are built from the baseline first child `PATCH`.
- This is intentional for the initial testing phase so scenario changes remain narrow and traceable against one reviewed baseline.
- Non-scenario fields should stay aligned with the reviewed baseline pair.
- Expected scenario deltas are limited to:
  - `e:version`
  - the scenario-approved target field(s)
- Catalogue number is currently represented in the XML as:
  - `udidi:referenceNumber`

## Documentation Alignment

The current docs now need to describe:

- generated `Patch XML`
- current parent-record lineage
- reviewed baseline-pair gating
- before/after comparison as a current feature, not a future idea
- baseline-first scenario derivation for the initial testing phase

Files refreshed in this pass:

- `docs/session-handoff.md`
- `frontend/src/content/docs/xml-generation.md`
- `frontend/src/content/docs/eudamed-testing-generation-ui.md`
- `frontend/src/content/docs/eudamed-service-contract-findings.md`

## Still Missing

- persistence for PATCH scenario status (`EUDAMED Candidate` / `EUDAMED Accepted`)
- persistence for baseline-family acceptance state
- persistence for baseline-pair review / existence state
- automatic promotion of accepted PATCH scenarios into `EUDAMED Generation`
- explicit `POST Batch` / `PATCH Batch` redesign
- scenario-driven `PATCH Batch` generation
- broader scenario library beyond the current three active generated scenarios
- external confirmation that candidate scenarios are operationally accepted by EUDAMED
- workbook-drift detection between the reviewed baseline pair and newer workbook state
- any later decision on workbook-refreshed scenario PATCH regeneration

## Recommended Next Step

Focus next on operational clarity rather than more XML shape changes:

1. decide whether accepted scenario PATCH patterns should ever appear in `EUDAMED Generation`
2. design persistence for baseline review / scenario acceptance state
3. decide the future of:
   - `Single XML`
   - generic `Batch XML`
   - explicit `POST Batch`
   - explicit scenario-driven `PATCH Batch`
