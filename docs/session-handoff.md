# Session Handoff

Updated September 19, 2026. This document distinguishes implemented behavior, dated audit findings and proposed work. Historical Playground evidence and export counts must not be read as a live database inventory.

## Repository And Delivery Context

- Branch observed during this refresh: `feature/testing-batches-audit`.
- Latest implementation commit observed: `61e368c` — `fix: align model searches across review workspaces`. `355d910` introduced the earlier XML consolidation and ZIP-review rules.
- The implementation is committed. This handoff refresh is a separate documentation change; use `git status --short` for subsequent worktree status.
- The application prepares, validates and packages EUDAMED XML, then records manually uploaded Playground acknowledgements. It does not submit XML through EUDAMED M2M transport.
- The owner approved a combined Device Model selector and aligned review filters. Preserve distinct operation-specific rules and exact-device selection when evolving these controls.
- SQLite remains the active application store. Near-launch priorities include operational verification, bulk-generation performance and a trusted production baseline. Separate production deployment/import is not yet implemented. The first request-local XML performance improvements described below are implemented; real operator end-to-end timing remains to be measured.

Follow [AGENTS.md](../AGENTS.md) for collaboration requirements. The owner has explicitly approved the ZIP-review design described below; that decision is resolved.

## XML Workspaces And Message Boundaries

| Workflow | Current behavior |
| --- | --- |
| POST | Presents the next eligible device for the selected family/variant. Uses `DEVICE.POST` to seed an unregistered Basic UDI-DI; uses child-only `UDI_DI.POST` when that parent is already registered. Excludes already registered Device UDI-DIs. |
| Patch XML | The single-device PATCH workspace. Assessment, baseline, scenario, download and acknowledgement refresh retain the exact selected catalogue/device identity. Generates `UDI_DI.PATCH`. |
| Market Info | Generates standalone `MARKET_INFO.PUT` for a registered device. Country changes and Market Info versioning are separate from device PATCH lineage. |
| Bulk UDI-DI POST | Generates child-only registration messages under accepted Basic UDI-DIs. Already registered children are excluded. The visible Bulk POST control selects this flow. |
| Bulk PATCH | Applies one scenario to selected registered children, resolving each device's accepted state independently. Download resolves the records included by its generated preview, rather than silently restoring excluded records. |
| Bulk Market Info | Applies an explicit target country list to selected registered children. Different accepted starting countries and versions are supported by both assessment and generation. Each device uses its own next Market Info version. |

These are the six visible XML workspaces. Bulk Basic UDI POST remains a separate supported backend/API operation that generates parent registrations; its inaccessible frontend branch was removed. Do not restore that UI without a new owner request. The old generic Single XML frontend branch is also removed. Backend single-record and directly tested generic batch compatibility helpers remain; the generic batch helper functions are not decorated HTTP routes.

Use **Basic UDI-DI** for the shared regulatory parent and **Device UDI-DI** for the device identifier. `primary_udi_di` is the existing internal/API field name for Device UDI-DI. Catalogue numbers identify source/operator selections, not the EUDAMED entity itself.

Bulk scope controls support all eligible/posted devices, next 10, next 25, selected catalogue numbers and imported catalogue lists. Bulk UDI-DI POST additionally supports **Next 100 records**; do not assume that option exists in every bulk operation. Backend eligibility still governs the resulting selection. The configured batch limit defaults to 300; callers must respect the operation's count validation rather than assume arbitrary batch sizes are accepted.

## September 19 UI Changes And Current Handoff

The owner plans further manual testing followed by sending the reconciliation workbook and Questions tab to Quality. Treat the application as ready for final testing and Quality review, not as evidence of an approved production release. Source currency, missing workbook data, production registration discrepancies and the accepted baseline still need confirmation.

### Device Model Selection

- [DeviceModelSelector.tsx](../frontend/src/components/DeviceModelSelector.tsx) replaces the two-stage family-then-variant panels in all six XML workspaces: Single POST, Single PATCH, Bulk POST, Bulk PATCH, Single Market Info and Bulk Market Info.
- Each row is one existing family/variant pair, labelled by model, with family, available Basic UDI-DIs, device count and XML-ready/blocked counts. Select a model directly, including Echelon VAC, without first selecting Echelon. The list scrolls and offers text search plus an optional family filter.
- Searching the XML selector narrows its choices; it does not silently change the active generation scope. Select a row to change scope. Family/variant fields, API parameters, canonical mappings and database identities remain intact; no database migration or new model entity was introduced.
- [DeviceModelFilter.tsx](../frontend/src/components/DeviceModelFilter.tsx) supplies combined model selection with **All models** in Device Subjects, Canonical Model, Registration State, Testing Summary and EUDAMED Activity. Same-name models in different families remain distinct.

### Live Review Searches

- Canonical Model search now filters Source Sheet to Basic UDI, the selected record shown in Canonical Mapping, and scope counts. It searches family/model/Basic UDI-DI, rather than just narrowing the dropdown. Canonical Mapping remains a field view of the selected matching record, not a list of every matching child.
- Registration State has one live search instead of two competing search boxes. Rows and summary counts follow the search; status and actionable-only filters continue to apply.
- Testing Summary search filters model rows, success/readiness counts, recent successful testing and testing events. Changing search resets event pagination and expanded event detail. Recent subjects are filtered before choosing the latest five.
- In these three review screens, entering nonblank search clears an older family/variant selection so it cannot hide another model's matches. Selecting a model clears search; clear/reset restores the appropriate unsearched scope. Matching ignores case and surrounding whitespace and supports partial identifiers. No match produces empty results.
- Device Subjects and EUDAMED Activity still use search to narrow model choices; choosing a model applies its family/variant pair. Activity retains its Apply filters step and independent Basic UDI-DI filter. Do not describe every search box as live result filtering.
- Registration Footprint and Testing Summary use stable grid layouts with reserved search-feedback space. Browser verification remains necessary at desktop and narrow widths.
- Testing Summary subject/event requests retain their existing 10,000-item limits. Searched success counts derive from loaded successful events; the UI labels them as loaded-event-only when that limit is reached. This is not unlimited server-side search or proof of complete historical coverage.

### Environment Banner

[EnvironmentBanner.tsx](../frontend/src/components/EnvironmentBanner.tsx) appears at the top of every application page. It reads `GET /api/environment` from the connected backend: Dev displays **PLAY / EUDAMED Playground**, Prod displays **PRODUCTION / EUDAMED Production**. Pending or failed lookup stays **UNCONFIRMED**, with Retry on failure; it does not guess the environment from the browser build. The endpoint returns the profile name, configured message schema version and package label without exposing actor settings or storage paths. The banner shows the schema version prominently alongside Derived package (the bundled Dev profile), Official package (the bundled Prod profile), or Custom package (other paths). These labels describe configured package provenance, not an EUDAMED recommendation or runtime integrity certification.

The banner **scrolls with the page**. Sticky positioning was deliberately removed at the owner's request. It is an indicator, not an environment switch or proof of data provenance. Frontend API wiring still uses `http://localhost:8000/api`; deployment-specific frontend routing remains work to confirm before release.

Frontend-only edits normally need a browser refresh under Vite Dev, not a backend restart. Changes to backend profile configuration require restarting the backend with the intended profile.

## Review, Generation And Acceptance

The owner confirmed four rules, now implemented:

1. Generating a preview is a check. It does not record review and does not require a previous ZIP download.
2. Requesting a ZIP download confirms review of the exact contents successfully packaged for that download.
3. Changing a draft afterward requires another ZIP download to record review of the changed contents. Earlier receipts remain historical evidence only.
4. Only a successful EUDAMED acknowledgement advances accepted device or Market Info state.

All eight ZIP download paths use `XmlGenerationService._build_and_record_package`: single POST, scenario PATCH, single Market Info, bulk Basic UDI POST, bulk UDI-DI POST, bulk PATCH, bulk Market Info and the generic batch compatibility helper. Raw XML-only downloads do not create ZIP-review receipts.

The shared recorder stores review evidence in `generated_packages`:

| Field | Meaning |
| --- | --- |
| `package_sha256` | Fingerprint of the exact ZIP returned by the download operation. |
| `reviewed_at` | Review timestamp for successful preparation of an explicitly requested ZIP. |
| `review_basis` | `zip_download` for these review receipts. |
| `reviewed_members_json` | File names and SHA-256 hashes of every archive member, including the manifest. |
| `manifest_json` | Operation, selection and scenario metadata supplied by that package workflow. |

Package creation metadata alone does not prove review: `record_generated_package` defaults to `confirms_review=False`. The ZIP download helper explicitly opts in only after archive construction succeeds. Failed archive preparation records no receipt. XML bodies and ZIP archives are not copied into this metadata table; retain downloaded artifacts for later inspection.

The three review columns are nullable and added through the existing SQLite schema-initialization mechanism. Existing package rows are not backfilled as reviewed. The legacy `reviewed_post_baselines` table remains a historical POST-download indicator, maintained after successful POST ZIP preparation. Neither it nor the compatibility assessment field `reviewed_post_baseline_present` proves review of a current PATCH draft.

The optional reviewed-POST generation gate has been removed. Frontend readiness distinguishes **accepted baseline loaded** from review, and download feedback confirms review of that ZIP. No new review button or preview-as-review state is required. Accepted registration, version, scenario and unresolved Market Info rejection guardrails remain.

## Accepted State And PATCH Lineage

[accepted_state.py](../backend/app/services/accepted_state.py) is shared by XML generation and testing read models. It resolves accepted POST, device/PATCH and Market Info snapshots from SQLite, with compatibility handling for older records.

- New POST generation contexts capture the complete `DeviceXmlRecord` projection, including nested storage conditions, warnings and market countries. A generated context becomes accepted only through the matching successful acknowledgement.
- Version 2 PATCH derives from the accepted POST baseline. Equivalent First Patch changes the version without a business-field edit; a supported scenario can instead make its targeted first update.
- Later scenario PATCHes use the latest tracked accepted PATCH fields over the accepted POST projection. Non-target fields should retain accepted values, not silently adopt later workbook edits.
- Every PATCH repeats the separately resolved accepted Market Info country list. A later accepted Market Info update takes precedence over the original POST countries and source-workbook countries.
- PATCH/Market Info baseline loading requests the accepted projection via `accepted_baseline=True`. Acknowledgement refresh reloads that baseline for the selected device.
- Bulk PATCH uses the same per-device derivation path; it does not impose one shared accepted version on a cohort.

Older accepted entries may have only partial snapshots or no snapshot. Compatibility fallback still exists for unavailable historical fields. The system cannot reconstruct data that was never recorded, and current workbook values must not be described as proven historical acceptance. Complete historical-state backfill is not finished.

September 16 review fixes: when a newer accepted device or Market Info version has no matching payload snapshot, historical snapshots remain stored but are not exposed as the current accepted state. Single PATCH readiness and generation block; Bulk PATCH excludes affected devices. Restore matching generation context and re-import the acknowledgement to repair the snapshot, or complete a new Market Info update when only the country baseline is missing. A same-version duplicate acknowledgement can repair a stale snapshot without duplicating the acknowledgement event. Legacy POST-only fallback remains supported.

Current testing eligibility remains Playground-centric and relies on tracked successful registration. Workbook classification as `PATCH` alone does not establish a trusted accepted baseline for the controlled scenario workspace. Production handling of already registered devices without locally generated POST history is future design work.

## Market Info Rules

Market Info has its own accepted country snapshot and version. A successful `MARKET_INFO.PUT` does not advance the accepted device/PATCH version.

- Shared country normalization resolves names/aliases to the supported country-code representation.
- The next proposed Market Info version uses `max(accepted Market Info version, observed EUDAMED version floor) + 1`.
- A version-scheme error may establish a higher observed floor. That floor prevents a stale follow-up version; it does not prove acceptance of proposed countries.
- Single Market Info enforces the observed floor when validating the supplied version. Bulk Market Info derives the next version separately for every device.
- Different accepted starting countries are not a bulk eligibility mismatch when one explicit target list is supplied. The earlier deferred mixed-baseline decision is resolved.
- An unresolved `marketInfoLink` PATCH rejection blocks PATCH until a later successful Market Info acknowledgement is recorded for that device.
- Accepted Market Info countries differing from workbook countries are not themselves a reason to block PATCH.

Keep the selector-driven country editor and current/proposed country display consistent between single and bulk Market Info. Accepted state displayed after acknowledgement comes from SQLite, not the user's most recent unsent draft.

## Acknowledgements And Event History

The upload endpoint accepts single- and multi-entity acknowledgements for `DEVICE.POST`, `UDI_DI.POST`, `UDI_DI.PATCH` and `MARKET_INFO.PUT`, including success/error outcomes. Record every returned acknowledgement before generating a related follow-up operation.

- Ordinary previews do not persist generated submission context. ZIP download paths record generated contexts using the envelope IDs in the packaged XML.
- Generated event rows are append-only. Repeated downloads can create distinct generated events; merely previewing twice does not establish two submitted/accepted states.
- Bulk Market Info download records each included device against the actual downloaded chunk's shared correlation/message IDs.
- Success matching first tries subject, message type, correlation ID and message ID. It can then match the same correlation ID when the acknowledgement uses a different message ID.
- An identified acknowledgement with no matching correlation does not attach to an arbitrary latest draft. The uncorrelated legacy fallback requires absent acknowledgement IDs and exactly one candidate generated event.
- Duplicate acknowledgement imports are idempotent. Late/older successes remain in history without rolling newer accepted state back. Duplicate processing can repair missing projections where trustworthy generated context exists.
- An acknowledgement may provide a tracked version without enough generated context to recover its payload. Do not invent an accepted snapshot from another draft.
- Rejections record history and, where applicable, observed version evidence; they do not accept the rejected payload.

`testing_events` retains legacy status values such as `GENERATED` and `SUCCESS`, with `event_kind` distinguishing generated context and acknowledgement events. Do not change casing or historical interpretation casually.

## Readiness And Frontend State

`OperationAssessmentService` owns operation-specific readiness. `/api/xml/operation-readiness` supplies per-record dashboard/registration flags using the same assessment rules. Assessment responses include status, blocking reasons, recommended action, eligible count, identity scope and supporting evidence.

- Initial loading and acknowledgement refresh share [xmlAssessmentRequest.ts](../frontend/src/xmlAssessmentRequest.ts).
- Upload completion checks operation, family, variant, catalogue and parent identity before applying results to the visible workspace. An old upload must not overwrite a newly selected device's state.
- Preview completion also checks selection, operation, scenario inputs, versions, chunk and accepted-state refresh. Changed scope, overlapping requests and unmounting invalidate older responses, errors and completion updates, including when the operator returns to the original selection.
- [useBulkPostedCohorts.ts](../frontend/src/useBulkPostedCohorts.ts) uses backend posted-parent and posted-device queries for Bulk PATCH and Market Info.
- Workbook row-count estimates and parent sample-catalogue lists no longer substitute for actual eligible cohorts.
- Family/identity normalization is shared through [identity.py](../backend/app/services/identity.py); text/alias matching still exists as a compatibility mechanism.
- Registration State now distinguishes loading/unavailable assessments from genuinely blocked operations, surfaces readiness errors and suppresses misleading counts while readiness is unavailable. Device lookups are indexed by variant/catalogue, retaining family-alias matching. This fixes the earlier all-Blocked display during pending/failed readiness requests without changing eligibility rules; browser confirmation remains outstanding.

Retain the current tabs, shared preview cards, XML structure navigation, before/after scenario comparisons and refresh feedback. Scenario input validation and preview availability are separate from ZIP review and EUDAMED acceptance.

## PATCH Scenario Availability

The enabled state in `frontend/src/App.tsx` and backend scenario guards are authoritative; an XML builder existing in the code does not mean the UI allows that scenario or EUDAMED accepts it.

| Scenario | Current operator availability |
| --- | --- |
| Equivalent First Patch | Enabled; version 2 with no business-field edit. |
| Trade Name Edit | Enabled. |
| Critical Warnings | Enabled; controlled code, with a required comment for `CW999`. |
| Storage Condition Edit | Enabled; existing condition comments, currently focused on `SHC006` and `SHC007`. |
| Base Quantity | Enabled; positive integer. |
| Status Code | Enabled for testing, with failure status recorded in the scenario configuration; do not describe it as universally accepted. |
| Sterile; Latex | Disabled in the UI following Playground `ERR-DTX-UDI-031-033.02` rejection; bulk generation also blocks these scenarios. |
| Production Identifier; Sterilization; Reprocessed; Number Of Reuses; MDN Codes | Listed as candidates but not enabled/implemented for the operator workflow. |

Scenario-level labels such as candidate/accepted describe testing evidence for a scenario. They are not review receipts or proof that a particular generated device update was accepted.

## SQLite And Source Data

Default application database: `data/testing/testing-state.sqlite3`, overridable with `EUDAMED_TESTING_STATE_DB_PATH`. Backups default to `data/testing/backups`, with configurable retention. New tests use isolated databases and synthetic fixtures rather than altering application state.

| Area | Implemented tables |
| --- | --- |
| Import/source identity | `import_batch`, `source_workbook`, `source_row`, `device_subject`, `device_identity_issue` |
| Canonical projection | `canonical_device_record`, `canonical_field_value`, `canonical_projection_snapshot` |
| Accepted testing projections and events | `testing_subjects`, `testing_events` |
| Batch lineage and outcomes | `testing_batches`, `testing_batch_devices` |
| ZIP generation/review and legacy history | `generated_packages`, `reviewed_post_baselines` |

Workbooks remain upstream inputs. Import persists source rows, links device identities, records conflicts/drift and builds the canonical projection. XML testing services require the imported projection; direct workbook fallback remains in compatibility/non-import-required service paths. Re-import when source or mapping corrections must reach the persisted projection.

The source status aliases `ON_THE_EU` and `ON_THE_EU_MARKET` normalize to `ON_THE_MARKET`. Completeness is not equivalent to XSD validity; inspect local message validation before Playground upload.

Submission Data uses SQLite import/snapshot/monitoring information; it should not be described as a live direct-Excel inventory. Registration State and Testing Summary expose operational readiness and testing history. Batch history and its backfill service are implemented, not merely proposed schema.

`device_subject` is the intended stable application identity. Testing subjects and legacy reviewed POST rows have `device_subject_id` links, but some resolution still uses family/variant/catalogue text and aliases. Existing compatibility fields such as `post_success`, `latest_successful_version` and `latest_successful_state_json` remain in use. Relational consolidation is incremental and incomplete.

## Workbook Classification And Production Direction

The current `BasicUDIs.xlsx` uses two sheets: `Upload(BasicUDI not registered)` maps to POST and `Update(BasicUDI registered)` maps to PATCH. `BasicUdiReferenceService` matches source worksheet names to Device Model and propagates the classification to child rows. Source version markers 1/2 are also assigned by this sheet mapping; they are not verified production versions. The older single-sheet format reads explicit Operation/Version columns. Some field provenance labels still name those older columns.

Parent registration does not prove child registration. Workbook POST/PATCH labels express source intent; accepted EUDAMED device identity/state must govern production eligibility. Workbooks supply proposed data, not proof of acceptance.

The current environment is now called **Dev** (targeting Playground). September 19 configuration work adds separate Dev/Prod startup profiles in one codebase: `.env.dev` and `.env.prod`, explicit schema selection, isolated storage paths and startup checks. Run `python -m app.run --environment dev --check-config` from `backend/` for read-only validation. Dev retains its existing database and source paths; Prod requires explicit configuration and actor identities. See [environment profiles](environment-profiles.md). UI environment labels are implemented. Controlled production database initialization/import and full generation verification against both profiles remain pending. No production database or acceptance data was created. Do not copy Playground successes into production acceptance.

Establish Production through a controlled, reviewed import/reconciliation of complete production exports: preserve originals, validate scope/pagination/encoding, match UDI-DI plus issuing entity and parent links, then store accepted fields, separate parent/device/Market Info versions, country lists, dates and provenance. Confirm registered parents without children are covered too. Missing identities in an unverified export remain unknown. Imports must not overwrite newer acceptance or silently preserve stale pending packages. Export reconciliation is a dated snapshot, not continuous synchronization; M2M remains deferred. Imported acceptance needs its own explicit provenance path, not fabricated POST acknowledgements.

### Production Hold And Incremental Loader Direction

The owner has decided to wait for Quality to confirm the master workbook structure before creating the Production environment or database. The proposed frontend-only Production preview was cancelled before any changes were made. Dev remains available for testing. Do not initialize Production or copy the Dev database as part of loader planning.

After workbook confirmation, design a reusable incremental loader for subsequent workbooks using the same structure. The requested watermark should identify successfully imported device identities and row content, not simply the last Excel row number: rows can be reordered, inserted or moved between sheets.

Proposed import contract, to be finalized with the owner before implementation:

| Row classification | Proposed action |
| --- | --- |
| New device identity | Propose adding the device. |
| Existing identity with unchanged content | Skip; repeated imports must not create duplicates. |
| Existing identity with changed content | Present differences for review before updating proposed source data. |
| Duplicate or conflicting identity | Block affected rows and report the conflict. |
| Previously imported identity absent from the workbook | Report the absence; do not automatically delete the device. |

- Identify parents by Basic UDI-DI plus issuing entity, and children by Device UDI-DI plus issuing entity. Validate each child's parent assignment; catalogue numbers and Excel row positions are provenance, not the import identity.
- Record the workbook fingerprint, sheet/row provenance, device identity, normalized row-content fingerprint and import batch for each successful import. Define normalization and fingerprint rules against the Quality-approved structure so formatting or row order does not masquerade as a device change.
- Commit imported data and its watermark together. Failed imports must not advance the watermark. Reimporting identical content must be idempotent. Decide whether valid rows can be committed alongside blocked rows, and document retry behavior, before implementation.
- Proposed operator flow: upload workbook, validate, review differences, confirm import, then download the results report.
- Workbook imports update proposed source/canonical data only. They must not overwrite accepted EUDAMED registration, device/PATCH versions or Market Info state. Establishing the trusted Production accepted baseline remains a separate reconciliation/import responsibility.
- Extend the existing SQLite import batches, source lineage and stable device identity where suitable; first assess what the current importer already supports. This direction does not authorize a replacement database, a new canonical model or an implemented loader yet.

Next sequence: obtain Quality's workbook-structure confirmation; review loader mapping, identity, validation, watermark and transaction rules with the owner; implement and verify with synthetic fixtures; then agree controlled Production initialization and baseline population.

### Recorded Production Export Review — September 2026

Local files live in `docs/xml_eudamed/`, now ignored and untracked; earlier Git commits still contain them. No registration-state import was performed.

- September 11 export: 15 files, 360 distinct Device UDI-DIs, 30 distinct Basic UDI-DIs, all registered, manufacturer `UK-MF-000048777`.
- Pages 0–6 contain 50 devices each; page 7 contains 10. All eight declared populated pages are present, with no duplicate device identities. Pages 8–14 are empty responses beyond the result set. The earlier example used 20 records/page and declared 18 pages; the newer export uses 50/page.
- Complete for the returned query, subject to confirmation of its filters and the production portal inventory. This does not prove coverage of all registered parents without children.
- Device versions: 17 at v1, 316 at v2, 27 at v3. Market Info: 354 at v1, three at v2, three missing explicit version/state. All devices contain country lists.
- Missing Market Info metadata: `05050649091223` (`p239443`), `05050649091216` (`P239143`), `05050649091162` (`P019267`), under `5050649COMPACTSAKLM3`, in `APP-DTX-000103955.xml`. Each lists Germany with original-placement true. Preserve unknown versions; absence does not prove no prior changes or invalid registration.
- `APP-DTX-000103944.xml` and `APP-DTX-000103948.xml` declare UTF-8 but contain Windows-1252 apostrophes. Inspection used an explicit encoding override without changing originals. Controlled import must handle and report this explicitly.
- Export schema is 3.0.30; outgoing Dev configuration is 3.0.32 and Prod configuration is 3.0.30. Import compatibility must be verified separately. Production actor configuration must not inherit the earlier Playground SRN `UK-MF-000033261`.
- Comparison with stored workbook import 4, dated September 3: 2,529 distinct PATCH-classified canonical devices, all Echelon. Only four export identities match that PATCH set; one matches POST (`EVAC22L1S`, production device v2); 355 have no matching imported canonical identity. Conversely, 2,525 PATCH identities are absent from the export. These are dated identity-reconciliation findings, not proof those devices are unregistered. Assurance-team confirmation of scope and classification is outstanding.

## Bulk POST And Bulk PATCH Performance Direction

The owner expects initial operational batches of about 100 devices. The approved first performance stage is implemented for single POST, Bulk Basic UDI POST, Bulk UDI-DI POST and Bulk PATCH, preserving the current UI and regulatory controls. See [benchmark method, timings and limitations](xml-generation-performance-2026-09-16.md).

Before the performance change, code inspection found:

- Bulk PATCH calls `_build_generated_patch_preview` per device; its selector reloads the complete canonical bundle, reconstructing all imported records and summaries. It also renders/validates individual baseline and derived XML before batch assembly/validation.
- `download_bulk_udidi_post` invokes its preview builder, then repeats selection, projection, rendering and validation for the actual archive. A displayed preview followed by download therefore renders the POST batch three times across those requests.
- `download_bulk_patch` similarly invokes bulk preview, then resolves selected records and builds device scenarios again before final batch rendering.
- Generation contexts are written using separate per-device database transactions; accepted-state reads are also repeated.
- XSD compilation is already cached by `XmlValidationService._message_schema`. ZIP compression and network transfer have not been identified as dominant costs.

Read-only measurement on September 16: fetching and reconstructing 8,423 canonical records took 4.277 seconds initially and 2.400 seconds on a repeat run (including 2.250/2.341 seconds for JSON decoding and model validation). This excludes additional summary construction and is not an end-to-end benchmark. It indicates why repeated whole-dataset loading can make 100-device PATCH generation take minutes; do not promise a speedup before measuring complete workflows.

Implemented first stage:

1. Synthetic service benchmarks cover single POST and bulk sizes 10, 50 and 100, with separate preview/ZIP and XSD-cold/warm runs. Raw timing/call-count artifacts are linked in the report. Network transfer and browser display are not measured.
2. Load canonical data once per operation request and index catalogue identities. Nested generation calls share that bundle; the next request reloads it.
3. Operation-specific preparation returns one selected batch, validated XML members and matching generation contexts. Downloads package those same bytes rather than invoke preview and rebuild the batch.
4. Prefetch family/variant acceptance subjects and registration flags in one SQLite snapshot. Commit generation events, batch membership and ZIP review evidence together. Validation, archive and audit failures leave no partial generation history; conflicting concurrent acceptance returns refresh/retry guidance.
5. Preserve per-device baseline/derived PATCH validation and validate the final packaged batch. Separating presentation-only calculation is deferred; no additional validation reduction was made.

On the 1,000-record simplified synthetic fixture, warm 100-device PATCH preview improved from about 4.804 to 0.108 seconds and ZIP preparation from 9.699 to 0.099 seconds. Bulk Basic UDI POST ZIP improved from 0.208 to 0.071 seconds; Bulk UDI-DI POST ZIP from 0.198 to 0.066 seconds. These are single local observations, not production latency promises. Single POST ZIP time was effectively unchanged at this scale.

Cross-request reuse of a preview artifact for download is a later, separate decision. It requires expiry and invalidation for changed selection, scenario inputs, source/import state, accepted device/Market Info state and relevant configuration. Preview must never become review or acceptance merely because it is cached.

Acceptance criteria: unchanged operation eligibility, per-device next versions, retained accepted countries after Market Info changes, exclusions, acknowledgement correlation and ZIP-review semantics; meaningful regression tests for drift and failures; measured preview/ZIP improvements for both 100-device POST and PATCH batches. No database-platform migration, background-job system, new UI workflow or M2M implementation is implied.

## Configuration And Local Validation

- Backend baseline: Python 3.11; FastAPI/Pydantic with the current SQLite services. Frontend: React/TypeScript/Vite.
- Dev uses `data/schema_profiles/dev-3.0.32-derived` and message version 3.0.32. This preserves the historical 3.0.30-derived bundle whose Message schema version was edited after the August 9 Playground rejection; it is not an official 3.0.32 package. Prod uses the downloaded official `data/schema_profiles/prod-3.0.30`. Both packages compile; four files differ. Provenance, file hashes and the comparison are recorded in [schema profile documentation](../data/schema_profiles/README.md). The legacy `data/schemas` directory is retained but is no longer the default.
- Testing actor controls: `EUDAMED_MANUFACTURER_SRN_OVERRIDE`, `EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE`, and `EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE`.
- Actor overrides must match the actual Playground context; do not assume historical test SRNs remain appropriate for a different environment.
- Do not implement upload/M2M transport or introduce production assumed-registration rules as incidental cleanup.

## Recorded Playground Evidence

Detailed execution evidence belongs in [eudamed-playground-test-report.md](eudamed-playground-test-report.md). The following findings were retained from earlier sessions; no fresh live Playground or application-database verification was performed during this documentation refresh.

- August 9, 2026: a `DEVICE.POST` and an equivalent first `UDI_DI.PATCH` at version 2 succeeded after message-schema and actor alignment. This established the initial POST/version-1 and PATCH/version-2 testing sequence.
- August 11, 2026: `Elan / Elan IC / ELANIC22L1S` succeeded with a critical-warning PATCH at version 4, changing `CW010` to `CW011` while retaining the previously accepted trade name.
- Earlier EliteVT tests established successful child-only `UDI_DI.POST` waves and subsequent bulk PATCH under an accepted Basic UDI-DI. Epirus/Esprit child registrations also exposed the family-alias exclusion bug, which was corrected.
- The Navigator/Javelin/Linx sequence recorded before the September 4 handoff established the Market Info safeguard: PATCH without repeated `marketInfos` was rejected; a Market Info update removing Austria accepted 29 of 30 rows, while `LINX22L1S` reported an existing version 2. A subsequent single Market Info version 3 succeeded, followed by a 31-device Linx Bulk PATCH success.
- At that recorded point, `LINX22L1S` had Market Info version 3 and PATCH version 4. These are historical outcomes, not current inventory or guaranteed present eligibility.

Previously recorded Playground action labels:

| Message | Recorded Playground option |
| --- | --- |
| `DEVICE.POST` | Upload of Legacy / Regulation Device / SPP (Basic UDI and UDI-DI / Master UDI-DI) |
| `UDI_DI.POST` | Upload of UDI-DI/Master UDI-DI for existing Basic UDI-DI |
| `UDI_DI.PATCH` | Update of UDI-DI/Master UDI-DI |
| `MARKET_INFO.PUT` | Update Market Information |

Choose the action by service/operation rather than single versus bulk packaging. Retain the downloaded ZIP/XML and import the response before proceeding with dependent changes.

## Verification And Next Work

Latest September 19 UI verification: **48 frontend Node tests passed** and the TypeScript/Vite build passed. Coverage includes model pair selection, Basic UDI search, clearing/resetting scopes, environment lookup and event-pagination reset. These are component/helper/hook checks, not full browser end-to-end tests. The existing Vite warning for a JavaScript chunk over 500 kB remains. Removing banner stickiness was a subsequent CSS-only edit checked with `git diff --check`. No new full backend run was performed for these frontend changes.

Environment work previously passed the full backend suite (199 tests, 239.30 seconds); the focused profile suite subsequently passed 25 tests, and the banner/profile focused run passed 27. Keep those dated results distinct from the latest frontend run.


September 16 performance-stage verification: the complete backend suite passed (175 tests, 238.90 seconds), all 28 frontend tests passed, and the production build passed with the existing bundle-size warning. The 25 new synthetic preparation regressions include HTTP response contracts and transaction rollback/concurrency checks. The performance report contains before/after service timings; live browser/network and representative imported-data measurements remain outstanding.

September 16 correctness-fix verification: the complete backend suite passed (150 tests, 245.21 seconds), all 28 frontend Node tests passed, and the TypeScript/production build passed with the existing bundle-size warning. New regression coverage exercises missing latest accepted payloads, single/bulk PATCH blocking, duplicate-acknowledgement recovery, delayed previews in all six workspaces, changed inputs, overlapping requests and unmounting. These are automated checks; browser interaction and live Playground verification remain outstanding.

Last implementation verification recorded on September 9:

- Full backend run: 147 tests passed.
- Focused ZIP-review run: all 15 tests passed, including the accepted-state regression added while the full run was running; 148 distinct backend tests were exercised across those runs.
- Frontend: all 11 Node-based tests passed. These exercise TypeScript helpers/hook behavior without a browser; they are not full browser interaction tests.
- Production build passed at that point, with a Vite bundle-size warning. TypeScript unused-local/parameter checks are enabled.
- Browser visual comparison and live Playground testing of the latest consolidation/review changes remain outstanding.

Useful commands from the repository root:

```bash
.venv/bin/python -m pytest backend/tests -q
npm --prefix frontend test
npm --prefix frontend run build
git diff --check
```

Subsequent readiness-fix verification: all 11 frontend tests and the production build passed, then below the 500 kB warning threshold. These tests are not browser confirmation. September 16 documentation verification: all nine local links resolved and `git diff --check` passed. The frontend build passed, but embedded documentation growth brought the JavaScript bundle to approximately 503.5 kB, restoring Vite's 500 kB warning. This is a bundle-size warning, not an XML-generation timing measurement. Backend tests were not rerun for this prose-only change.

Next priorities:

1. Verify model search/selection across all six XML operations and the review screens, unmatched Basic UDI-DIs, reset, recent testing/event pagination, stable controls and the non-sticky environment banner. Then manually verify previews, ZIP review feedback, draft edits, exact-device selection and acknowledgement refresh across the six visible workspaces, including navigation while an upload is in flight.
2. In controlled Playground testing, verify retained countries in PATCH after Market Info changes, mixed-baseline bulk Market Info, mixed success/error responses, duplicate uploads and delayed older acknowledgements. Use downloaded payloads with recorded generation context; previews alone do not create that history.
3. Review legacy accepted records with missing/partial snapshots before claiming complete source-drift protection. Choose a trusted recovery approach rather than filling historical acceptance from current workbook data.
4. Gradually replace remaining text-based identity lookups with `device_subject_id` joins, preserving existing data and lineage. Broader canonical/submission persistence remains a separate design increment.
5. Verify the implemented Bulk POST/PATCH performance work on a representative imported dataset and measure network/browser time before claiming 100-device launch performance.
6. Confirm export scope, reconcile workbook identities and resolve unknown Market Info versions before implementing the separate production deployment and controlled baseline import. Preserve Playground guardrails.
7. Extend scenario coverage only with supporting validation and Playground evidence. Automated submission/M2M transport remains out of scope.

The removed frontend branches, unused clients/types/state, generic preview component, duplicate normalization and old reviewed-POST gate should not be recreated. Retain historical archives unless their recovery/retention purpose has been deliberately resolved.

## Read-Only SQLite Checks

Use the configured database path. These queries inspect history; they do not generate, review or accept anything. Review-column queries require the updated application's schema initialization to have run.

```bash
sqlite3 -readonly -header -column data/testing/testing-state.sqlite3
```

```sql
-- Exact ZIP review receipts; NULL review fields denote historical/unreviewed creation.
SELECT id, created_at, flow, package_file_name, package_sha256,
       reviewed_at, review_basis, reviewed_members_json
FROM generated_packages
ORDER BY id DESC LIMIT 10;

-- Separate accepted device and Market Info versions; filter to the device under test.
SELECT id, device_subject_id, product_family, product_variant, catalogue_number,
       latest_successful_post_version, latest_successful_patch_version,
       latest_successful_market_info_version, latest_observed_market_info_version
FROM testing_subjects
ORDER BY id DESC LIMIT 20;

-- Download-generated context and acknowledgements, including batch/envelope lineage.
SELECT subject_id, event_index, message_type, event_kind, status, version,
       batch_id, scenario_id, correlation_id, message_id
FROM testing_events
ORDER BY id DESC LIMIT 30;
```

Implementation detail and regression scope: [XML workflow consolidation](code-consolidation-2026-09-09.md). The [SQLite event-logging proposal](sqlite-event-logging-schema-proposal.md) and [architecture draft](architecture-definition-draft.md) contain broader/historical design material; compare them with current code before treating proposed elements as missing features.

September 19 environment-profile verification: full backend suite 199 passed in 239.30 seconds; the focused profile suite subsequently passed 25 tests including an additional real-package Prod check that created no database or directories. Configuration and UI labelling are implemented; controlled production baseline import remains pending.
