# Session Handoff

Updated September 9, 2026. This document describes the implemented design and the remaining work. Historical Playground evidence is labelled separately; it must not be read as a live database inventory.

## Repository And Delivery Context

- Branch observed during this refresh: `feature/testing-batches-audit`.
- Latest implementation commit: `355d910` — `Consolidate XML workflows and confirm review through ZIP downloads`.
- The implementation is committed. This handoff refresh is a separate documentation change; use `git status --short` for subsequent worktree status.
- The application prepares, validates and packages EUDAMED XML, then records manually uploaded Playground acknowledgements. It does not submit XML through EUDAMED M2M transport.
- Retain the existing UI layout and buttons. Preserve distinct operation-specific rules rather than combining all registration and update flows into one generic batch mode.
- SQLite remains the active application store. The next priority is operational verification and gradual relational identity cleanup, not replacing the database or restructuring the UI.

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

Bulk scope controls support all eligible/posted devices, next 10, next 25, selected catalogue numbers and imported catalogue lists. Backend eligibility still governs the resulting selection. The configured batch limit defaults to 300; callers must respect the operation's count validation rather than assume arbitrary batch sizes are accepted.

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
- [useBulkPostedCohorts.ts](../frontend/src/useBulkPostedCohorts.ts) uses backend posted-parent and posted-device queries for Bulk PATCH and Market Info.
- Workbook row-count estimates and parent sample-catalogue lists no longer substitute for actual eligible cohorts.
- Family/identity normalization is shared through [identity.py](../backend/app/services/identity.py); text/alias matching still exists as a compatibility mechanism.

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

## Configuration And Local Validation

- Backend baseline: Python 3.11; FastAPI/Pydantic with the current SQLite services. Frontend: React/TypeScript/Vite.
- Configured message schema default: `EUDAMED_MESSAGE_SCHEMA_VERSION=3.0.32`. The bundled Message schema was aligned after the recorded August 9 Playground rejection of `3.0.30`. This describes repository configuration and recorded evidence, not a newly verified public EUDAMED release.
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

Documentation-only refresh verification: all 9 local links and `git diff --check` passed. The frontend production build passed without the previous bundle-size warning: removing superseded Markdown brought the bundled JavaScript below the 500 kB warning threshold. The Documentation tab imports this file, so its size affects that build. The backend suite was not rerun for this prose-only change.

Next priorities:

1. Manually verify previews, ZIP review feedback, draft edits, exact-device selection and acknowledgement refresh across the six visible workspaces, including navigation while an upload is in flight.
2. In controlled Playground testing, verify retained countries in PATCH after Market Info changes, mixed-baseline bulk Market Info, mixed success/error responses, duplicate uploads and delayed older acknowledgements. Use downloaded payloads with recorded generation context; previews alone do not create that history.
3. Review legacy accepted records with missing/partial snapshots before claiming complete source-drift protection. Choose a trusted recovery approach rather than filling historical acceptance from current workbook data.
4. Gradually replace remaining text-based identity lookups with `device_subject_id` joins, preserving existing data and lineage. Broader canonical/submission persistence remains a separate design increment.
5. Consider a production mode for externally registered/PATCH-classified devices only after trusted accepted-state/version sourcing is defined. Do not weaken current Playground guardrails to achieve it.
6. Extend scenario coverage only with supporting validation and Playground evidence. Automated submission/M2M transport remains out of scope.

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
