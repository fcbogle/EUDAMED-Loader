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

- As of Sunday, August 9, 2026, the live EUDAMED Playground validator rejected `m:Push version="3.0.30"` and required `3.0.32` instead.
- The repo has therefore been hotfixed to default `EUDAMED_MESSAGE_SCHEMA_VERSION` to `3.0.32` for current Playground testing.
- The bundled local `MessageType.xsd` fixed `m:Push@version` value has also been hotfixed from `3.0.30` to `3.0.32` so local validation and tests remain aligned with current Playground behavior.
- This is intentionally captured as a reversible config decision because the public EUDAMED technical documentation page still showed XSD version `3.0.30` at the time of testing.
- Playground upload testing on Sunday, August 9, 2026 also revealed an actor mismatch guard:
  - generated XML carried `UK-MF-000048777`
  - logged-in Playground actor was `UK-MF-000033261`
  - EUDAMED rejected the upload because `MFActorCode` / sender actor must match the submitting actor
- The repo now supports a testing-only override via `EUDAMED_MANUFACTURER_SRN_OVERRIDE` so Playground XML can be aligned to the logged-in actor without rewriting the underlying source/reference data.
- Playground testing then revealed a second actor-reference issue:
  - generated XML carried `ARActorCode` `DE-AR-000006292`
  - Playground could not resolve that actor in the current environment
- The repo now supports `EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE=true` so `ARActorCode` can be omitted for controlled Playground testing when the referenced AR is not available there.
- Search results in Playground then identified the current AR actor for the logged-in manufacturer context as `DE-AR-000031681` (`Blatchford Europe GmbH`).
- The repo now supports `EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE` so Playground XML can carry a valid AR actor without mutating the underlying legacy reference data.
- On Sunday, August 9, 2026, a `DEVICE.POST` upload then succeeded in Playground using this working actor combination:
- On Sunday, August 9, 2026, a `DEVICE.POST` upload succeeded in Playground using this working actor combination:
  - `EUDAMED_MESSAGE_SCHEMA_VERSION=3.0.32`
  - `EUDAMED_MANUFACTURER_SRN_OVERRIDE=UK-MF-000033261`
  - `EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE=DE-AR-000031681`
  - `EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE=false`
- On Sunday, August 9, 2026, the baseline equivalent first-child `UDI_DI.PATCH` from the generated `Post + Patch` pair also succeeded in Playground with `e:version = 2`.
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
- Provides explicit separate `POST` and `PATCH` ZIP downloads after preparation from one download action.
- As of Sunday, August 9, 2026, the baseline `POST` and equivalent first-child `PATCH` have both been accepted successfully in Playground for at least one tested device lineage.

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
- The first confirmed accepted Playground baseline pair was proven on Sunday, August 9, 2026:
  - `DEVICE.POST` -> `SUCCESS`
  - `UDI_DI.PATCH` with `e:version = 2` -> `SUCCESS`
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

## Current Schema-Version Note

- Local default message schema version is now `3.0.32`.
- Previous repo default was `3.0.30`.
- Local bundled `data/schemas/service/Message/MessageType.xsd` fixed value is also now `3.0.32`.
- Previous bundled fixed value was `3.0.30`.
- Optional testing override now exists:
  - `EUDAMED_MANUFACTURER_SRN_OVERRIDE`
  - intended for Playground actor alignment only
  - should remain easy to remove or change later
- Optional testing suppression now exists:
  - `EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE`
  - intended for Playground-only compatibility when the AR actor is not resolvable there
  - should remain easy to remove or change later
- Optional testing override now also exists:
  - `EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE`
  - intended to point XML generation at a Playground-valid AR SRN such as `DE-AR-000031681`
  - preferred over suppression when EUDAMED business rules require an AR for the submitting manufacturer
- Reason for temporary/default switch:
  - actual Playground validation error `E-I-40000` on Sunday, August 9, 2026 required `m:Push@version="3.0.32"`
- Public technical documentation observed during the same session still stated `v 3.0.30` for the published `XSD schemas.zip`.
- Treat this as a controlled operational hotfix until the local schema pack is fully refreshed, the published documentation catches up, or a later EUDAMED validator change requires another version adjustment.

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
