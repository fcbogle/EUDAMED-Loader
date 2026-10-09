# XML workflow consolidation — September 9, 2026

Historical implementation checkpoint, reviewed 9 October 2026. Later identity,
cohort, selection and count changes are recorded in [session-handoff.md](session-handoff.md).
Successful acknowledgements remain the implemented accepted-state path; supporting
exported Production baselines is proposed, not implemented.

## Scope and retained behavior

This implementation addresses the frontend-to-backend audit while retaining the six visible XML workspaces: POST, Patch XML, Market Info, Bulk UDI-DI POST, Bulk PATCH, and Bulk Market Info. Bulk Basic UDI POST remains a separate supported backend operation; its inaccessible frontend branch has been removed. SQLite, the canonical model, scenario choices, and manual Playground workflow remain in place.

## Changes

- `accepted_state.py` resolves accepted POST, PATCH, and Market Info snapshots for generation and read models. New POST generation contexts capture the complete XML projection, including nested storage and warning fields. PATCH overlays the latest accepted PATCH fields and the separately accepted Market Info countries onto that accepted POST projection, rather than silently adopting subsequent workbook edits.
- The baseline preview used by PATCH/Market Info requests the accepted projection. Acknowledgement refresh reloads that baseline for the selected catalogue number. Preview loading still performs no review write.
- Late success acknowledgements remain in event history without rolling back newer accepted version/state projections. Matching generation context requires matching correlation/envelope identity; an unrelated identified acknowledgement cannot accept the latest arbitrary draft. A single uncorrelated legacy draft remains a compatibility fallback for acknowledgements without identifiers.
- Bulk Market Info accepts different starting country lists and versions for an explicit shared target. Download records each device against the actual downloaded chunk's correlation/message IDs, so subsequent acknowledgements promote the corresponding snapshot.
- Dashboard and registration readiness use the same per-record backend assessments as XML workspace readiness. Bulk PATCH/Market Info selections use the existing posted-parent and posted-entry backend queries. Workbook row-count estimates and sample-catalogue fallbacks no longer stand in for eligible cohorts.
- Initial assessment and upload refresh share `requestXmlAssessment`. Upload completion checks that the selected operation, family, variant, catalogue and parent still match before applying results.
- Shared family/identity normalization replaces copies in generation, selection, testing state and read models.
- Removed unreachable Single XML/Bulk Basic UDI POST frontend branches, their state and preview component, unused API wrappers and preview types, and associated calculations. Active backend endpoints and directly tested compatibility helpers remain available.

## Review confirmed by ZIP download

The owner confirmed that generating a preview is a check; downloading its ZIP confirms suitable review. This applies to every XML ZIP workflow and requires no new UI button.

- All ZIP download paths record a review receipt through the shared package recorder after archive creation succeeds. `generated_packages.reviewed_at` and `review_basis = zip_download` identify that action. The existing archive SHA-256 and new `reviewed_members_json` fingerprint the exact ZIP and every contained file, including its manifest. XML bodies and archives are not duplicated in SQLite.
- Preview generation and generation-context logging do not record review. The optional reviewed-POST prerequisite was removed from PATCH generation. Accepted-registration, version and scenario guardrails remain.
- A receipt reviews only that package. Subsequent device, scenario, version or country edits have no review receipt until another ZIP is downloaded; previous receipts remain immutable history.
- Frontend readiness now says an accepted baseline is loaded, rather than reviewed. The historical POST review row is labelled as history. Download feedback confirms that review was recorded for the ZIP. No new workspace controls were added.
- Successful acknowledgements remain the only source of accepted EUDAMED state. ZIP review never promotes generated device or Market Info state to accepted state.

The SQLite change adds nullable review columns on initialization. Existing package rows are left unreviewed; historical creation records are not retrospectively treated as proof of review. The legacy per-device POST review table is maintained only as history, after successful ZIP preparation, and never proves review of a current draft.

## Compatibility and verification limits

Older accepted POST entries contain only partial snapshots, or no snapshot. Known accepted fields are retained where present; missing historical fields cannot be reconstructed from data never recorded. No backfill from the current workbook is represented as historical acceptance.

Tests use isolated SQLite databases and synthetic fixtures for the new state/acknowledgement cases. The existing backend suite additionally covers local XML/XSD generation. Frontend tests cover assessment dispatch, exact identity, stale upload completion, visible workspace labels, cohort fallback removal and preview readiness without prior ZIP review. TypeScript checks unused declarations during the normal production build. No new dependency was added.

No browser-based visual comparison or live Playground submissions were performed in this change. The existing Vite bundle-size warning remains a separate optimization item. Validation totals and current worktree/commit status are recorded in the session handoff.
