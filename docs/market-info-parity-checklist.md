# Market Info Parity Checklist

## Purpose

Bring single-device `Market Info` and `Bulk Market Info` into line with the current implementation pattern used by:

- single-device `POST`
- single-device `Patch XML`
- `Bulk Basic UDI POST`
- `Bulk UDI-DI POST`
- `Bulk PATCH`

This checklist is based on the repo state on Friday, August 30, 2026.

## Current Parity Position

Already aligned:

- dedicated preview and download backend routes exist for single and bulk `Market Info`
- single and bulk `Market Info` support local XSD validation
- single and bulk `Market Info` support success XML upload
- single and bulk `Market Info` use the same broad preview-card interaction model as the other XML workspaces
- bulk `Market Info` already follows the same chunked ZIP package pattern as the other bulk operations

Not yet aligned:

- no dedicated operation-assessment contract exists for single or bulk `Market Info`
- success XML upload does not refresh a `Market Info` assessment in the same way as `POST` and `PATCH`
- single `Market Info` and bulk `Market Info` still rely on bespoke assessment cards instead of the shared assessment flow
- bulk `Market Info` reuses posted-parent and posted-device selection logic indirectly rather than through an explicit shared contract
- the parity claim in `docs/session-handoff.md` should not be treated as complete until the items below are finished

## Parity Checklist

### 1. Backend assessment model

- Add `single_market_info` and `bulk_market_info` to `OperationAssessmentType`.
- Add request models for:
  - single `Market Info` assessment by `product_family`, `product_variant`, optional `catalogue_number`
  - bulk `Market Info` assessment by `product_family`, `product_variant`, optional `basic_udi_di`
- Define evidence payload expectations for Market Info assessments:
  - registered device anchor presence
  - current accepted market-info version
  - current market-country set
  - available posted parent groups
  - eligible posted child count
  - excluded-count / mismatch reasons for bulk scope

Acceptance criteria:

- `OperationAssessmentType` can represent all active XML operations, including Market Info.
- Market Info readiness can be expressed as `available`, `attention`, or `blocked` using the same model family as POST/PATCH.

### 2. Backend assessment service

- Implement `assess_single_market_info(...)` in `OperationAssessmentService`.
- Implement `assess_bulk_market_info(...)` in `OperationAssessmentService`.
- Reuse existing Market Info business rules rather than inventing a second rule path:
  - registered testing anchor required for single `Market Info`
  - posted parent group required for bulk `Market Info`
  - posted child devices required for bulk `Market Info`
  - bulk cohort state mismatch should surface as `attention` or `blocked` through assessment, not only during preview generation
- Make assessment summaries explicit about:
  - what anchor/group was resolved
  - what version basis will be used
  - why the operation is blocked or partial
  - what the recommended next action is

Acceptance criteria:

- A frontend consumer can assess Market Info without generating XML first.
- Preview-time blockers that are knowable ahead of generation are surfaced through assessment.

### 3. Backend router/API surface

- Add router endpoints:
  - `/xml/assess-single-market-info`
  - `/xml/assess-bulk-market-info`
- Add matching frontend API client methods.
- Keep payload shape consistent with existing assessment endpoints.

Acceptance criteria:

- The frontend can fetch Market Info assessments through the same API style used by POST/PATCH.
- Assessment failures return clean `400` responses for invalid requests and structured blocked states for valid-but-ineligible requests.

### 4. Success XML refresh parity

- Update `useSuccessXmlUpload` so single `Market Info` refreshes its assessment after success XML upload.
- Update `useSuccessXmlUpload` so bulk `Market Info` refreshes its assessment after success XML upload.
- Ensure the refresh path also updates any Market Info-specific derived UI state that depends on accepted baseline data.

Acceptance criteria:

- After uploading success XML, Market Info workspaces refresh through the same assessment cycle as POST/PATCH.
- The action message does not overstate refresh behavior.

### 5. Single Market Info assessment UI

- Replace the bespoke single `Market Info` assessment card with the shared assessment-panel flow, or extend the shared panel so it supports Market Info cleanly.
- Preserve the Market Info-specific metrics that matter operationally:
  - candidate catalogue
  - Device UDI-DI
  - current countries
  - draft countries
  - current market-info version
  - next generated market-info version
- Keep Market Info-specific explanatory copy, but drive availability from the formal assessment response rather than ad hoc anchor checks.

Acceptance criteria:

- Single `Market Info` reads like the same operation framework as POST/PATCH.
- Availability, blocking reasons, and next action are sourced from one assessment contract.

### 6. Bulk Market Info assessment UI

- Add a proper bulk Market Info assessment stage, parallel to bulk POST and bulk PATCH.
- Show the same style of assessment outputs:
  - status pill
  - summary metrics
  - blocking reasons
  - recommended next action
- Include Market Info-specific bulk metrics:
  - available parent groups
  - selected parent group
  - eligible posted child count
  - selected child count
  - current version basis
  - generated version range
  - excluded devices due to market-state mismatch

Acceptance criteria:

- Bulk `Market Info` no longer relies only on preview-time validation to explain readiness.
- The operator can tell whether bulk Market Info is viable before generating XML.

### 7. Shared selection/readiness plumbing

- Decide whether bulk `Market Info` should keep reusing bulk PATCH selection helpers or whether shared posted-scope helpers should be renamed and made operation-neutral.
- If refactored, avoid changing business rules; only improve naming and shared intent.
- Ensure single and bulk Market Info use the same country normalization path already established in the backend.

Acceptance criteria:

- Shared helper naming matches actual cross-operation usage.
- No duplicate scope-selection logic is introduced.

### 8. Preview panel convergence

- Decide whether `MarketInfoPreviewPanel` and `BulkMarketInfoPreviewPanel` should stay separate or be folded into the same shared preview primitives used by PATCH and bulk operations.
- If they stay separate, make the divergence intentional and minimal.
- Align refresh treatment so Market Info panels and PATCH/bulk panels expose the same refresh semantics.

Acceptance criteria:

- The codebase has a clear reason for any remaining preview-component split.
- Refresh behavior is visually and structurally consistent across operations.

### 9. Testing

- Add backend tests for:
  - `assess_single_market_info`
  - `assess_bulk_market_info`
  - Market Info assessment refresh after success XML upload
  - bulk Market Info mismatch and exclusion reporting
- Add frontend tests once a runner exists, or document the temporary manual verification matrix if no runner is introduced yet.
- Extend manual verification to cover:
  - single Market Info blocked state
  - single Market Info available state
  - bulk Market Info blocked with no parent
  - bulk Market Info blocked with no posted devices
  - bulk Market Info attention/blocked on mismatched accepted market-country states
  - post-success refresh of visible accepted baseline

Acceptance criteria:

- Market Info assessment behavior is regression-tested to the same standard as other active operations, as far as current tooling allows.

### 10. Documentation cleanup

- Update `docs/session-handoff.md` after parity work lands.
- Separate these labels clearly:
  - implemented
  - assessment-backed
  - Playground-confirmed
  - known risk
- Avoid claiming full parity until assessment, refresh, and shared workflow alignment are actually complete.

Acceptance criteria:

- Handoff and architecture docs describe Market Info consistently.

## Suggested Implementation Order

1. Add backend assessment types, service methods, and router endpoints.
2. Add frontend API methods and wire assessment refresh after success XML upload.
3. Replace single and bulk Market Info bespoke assessment cards with the formal assessment flow.
4. Tighten shared helper naming only after behavior is stable.
5. Add tests.
6. Update handoff and architecture docs.

## Definition Of Done

Market Info parity is complete when:

- every active XML operation has a formal assessment contract
- Market Info success XML upload refreshes assessment state the same way as POST/PATCH
- single and bulk Market Info expose blocking reasons and recommended next actions before XML generation
- assessment, preview, validation, download, and success capture behave as one coherent workflow family
- docs no longer overstate or understate Market Info parity
