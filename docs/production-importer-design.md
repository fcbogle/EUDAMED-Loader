# Production importer design — for owner review

Design checkpoint: 9 October 2026. No Production importer, database initialization
or schema change is implemented by this document.

## Agreed behaviour

- One codebase, the same SQLite table structure and the same application workflows
  in Dev and Prod. Production uses its own configured database and storage paths.
- Preserve Dev's current raw-template importer and Import Workbooks behaviour.
- Production consumes the prepared workbook and companion audit. Import only data
  rows with Review Required exactly No; skip Yes rows and report them for later work.
  Reject unexpected/missing review values rather than silently include them.
- Missing optional information URLs do not block inclusion. The 940 affected
  device rows now have No flags; the URL is blank in prepared data and its original
  placeholder remains in the audit. Country choices are Germany for Elan MAX,
  Germany/France for MAX Liners and Sleeves, with Germany first placement.
- Preserve Upload Success XML, per-device accepted-state progression, single/bulk
  POST/PATCH/Market Info separation and version safeguards.
- Use one current pair: `data/prod/import_file/production-import.xlsx` and
  `production-import.audit.json`. Fixed-name preparation is agreed but not yet
  implemented; the latest actual pair still has the 20261009-114955-299236 suffix.

Current expected first-import input: 9,674 To Register and 360 Registered rows.
Eligible: 9,672 + 356 = 10,028. Skipped: two + four = six. These are workbook
filter counts, not a claim that all 10,028 devices are already XML-ready.

## Proposed operator flow

Reuse the existing Submission Data panels, status card, import button position,
loading/error presentation, database monitoring and post-import refresh. Both
current button locations must use the same environment-aware controller.

| Backend-confirmed environment | Button | Source |
| --- | --- | --- |
| Dev | Import Workbooks | Existing configured raw-template directory |
| Prod | Import Production Workbook | Configured current workbook/audit pair |
| Unconfirmed | Disabled import | Confirm backend environment first |

For the first local implementation, read the configured server-side pair rather
than introduce browser file uploads. This follows the existing import button's
behaviour and avoids a second input-selection mechanism. Show filenames and
environment before confirmation; the browser cannot override either.

1. Click Import Production Workbook to run a read-only assessment.
2. Show eligible To Register/Registered counts, six skipped rows with reasons,
   new/existing identities, XML-ready/blocked projection counts, current import
   status and relevant Summary notes. Optional URL inclusion notes are information.
3. Confirm import of the assessed content. Changed files, changed database state
   or an expired assessment require a fresh assessment.
4. Show committed counts and a downloadable import report. Refresh the existing
   source/identity/canonical/registration monitoring panels after success.

Assessment must not instantiate services whose constructors create tables or
directories. If no Prod database exists, assess against an empty read model.
Database initialization occurs only at the agreed first local Prod startup/import.

## Backend selection and API

Add an importer selector using validated `Settings.environment`. Dev delegates
to `WorkbookImportService`; Prod delegates to `ProductionWorkbookImporter`.
Both use their environment's configured database, never a browser-supplied path.
Prod rejects a Dev-style run request without a valid assessment confirmation.

- Keep `POST /api/workbook-imports/run` as the commit entry point and preserve the
  current Dev request/response contract.
- Add `POST /api/workbook-imports/assess` for Production assessment.
- Extend the Prod run response with created/unchanged/skipped counts and a report
  reference. Existing shared import metadata remains available to monitoring.
- Add configurable Prod-only current-workbook/audit paths under the validated
  Prod root. Keep Dev's current path configuration intact. A missing/mismatched
  Prod pair is an actionable error, never a fallback to raw-template import.

Bind the assessment token to backend environment, both file hashes, the database
change marker and expiry. Keep token state transient; no new database table is
needed for confirmation. Verify again under the write transaction before commit.
Capture the assessed input bytes so later replacements cannot change a running
import. Concurrent confirmation must not duplicate an import.

## Validation and row eligibility

Validate the pair before applying the No-only filter:

- Workbook SHA-256 must match the audit. Audit format/version, required sheets,
  headers and source references must be consistent. Reject formula-based control
  or identity values, duplicate output identities and invalid review/status values.
- Require To Register, Registered and Summary; Summary is informational and is
  never imported as devices. Duplicate original occurrences can remain in audit;
  each prepared device identity must appear only once across the two data tabs.
- Confirm identity by issuing entity plus UDI-DI and parent by issuer plus Basic
  UDI-DI. Preserve identifiers as text; never use catalogue numbers as identity.
- To Register eligible rows need agreed Not registered classification. Registered
  eligible rows need matching export identity, parent, complete recoverable device
  snapshot and separately supplied Market Info version/state. Unknown fields must
  not become defaults represented as historical acceptance.
- A Yes row is skipped entirely: no device/canonical/accepted-state creation or
  mutation for that row. Record the exclusion in batch notes and the import report.
  Existing database records for a subsequently skipped row remain unchanged.
- No is necessary but not sufficient when input integrity is inconsistent. A No
  row with contradictory identity or missing required baseline evidence invalidates
  the assessment rather than being silently imported or silently recategorized.
- Business-field gaps that prevent XML generation can remain visible as blocked
  canonical readiness, provided identity and persistence data are coherent. Do not
  silently drop Accessories/new models from imported identity counts.

The audit is an integrity/provenance companion, not a cryptographic approval from
EUDAMED. Preserve source export hashes, page/envelope metadata and all accepted
fields; any workbook corrections require updating the pair coherently.

## Reuse of the existing database

Use the existing tables in both environments. No separate Prod database model or
new table set is proposed. Reuse schema initialization and existing indexes.

| Existing area | Production importer responsibility |
| --- | --- |
| import_batch | Record source_type production_workbook, operator, time and pair hashes/counts in existing notes metadata. |
| source_workbook / source_row | Record the prepared workbook, row positions and payload, retaining original source lineage and approved adjustments in payload JSON. |
| device_subject | Create/link stable device identities and their current source rows; verify issuer evidence as part of subject matching. |
| canonical_device_record / canonical_field_value / canonical_projection_snapshot | Adapt eligible proposed values to the existing canonical shape and validation rules; persist ready and blocked records with full coverage accounting. |
| testing_subjects | Link registered identities and materialize current accepted device/Market Info projections using existing snapshot columns. |
| testing_events | Record distinct export-baseline import evidence, with existing event_kind, state_after_json and raw_event_json provenance fields. Actual acknowledgement history continues unchanged. |
| generated_packages / testing_batches | No synthetic generated packages or acknowledgement batches are created by baseline import. Later XML downloads/acknowledgements use the existing flow. |

Preserve source-derived negative registration evidence in current source-row JSON
and import provenance so Prod counts can distinguish approved Not registered from
Unknown. Do not interpret the legacy default unregistered flag as proof of absence.

The current Dev importer builds source identity, refreshes links and rebuilds the
canonical projection in separate transactions. Prod should prepare in memory and
commit source, identity, canonical and accepted baseline writes in one transaction.
Do not call Dev's broad delete/rebuild routine for Prod. Persist the current complete
projection without deleting retained devices when a later workbook omits them.

## Accepted export baseline and Success XML integration

This is the main shared-code adaptation, not just a different Excel reader.
Current registration and bulk-cohort queries require SUCCESS events with
DEVICE.POST/UDI_DI.POST/UDI_DI.PATCH message types. Current PATCH descriptions and
some version branches also assume a locally accepted POST followed by PATCH.

Proposed explicit baseline event vocabulary, stored in existing text/JSON columns:

- event_kind `BASELINE_IMPORT`, status `IMPORTED`, message_type
  `PRODUCTION_EXPORT.SNAPSHOT` (internal history metadata, never a transport operation).
- Record current device and parent versions, current Market Info version/countries,
  identity, import batch and exported snapshot provenance. Do not create message,
  correlation, transaction or submission identifiers that did not exist.
- Materialize current snapshot/version fields. Historical POST/PATCH success flags
  and versions must not assert an upload that was never recorded. Central evidence
  resolution must recognise the imported baseline instead of fabricating success rows.

Add shared registration/accepted-state predicates that recognise either a genuine
successful acknowledgement or a valid imported accepted snapshot. Apply them to
single selection, bulk cohorts, readiness, registration counts and read models;
preserve Dev's existing results when no imported events exist.

For PATCH, use the imported current device version and full accepted snapshot as
the starting baseline. A current device at v2 proposes v3; it does not require an
invented v1 POST or v2 PATCH event. Equivalent First Patch remains restricted to
the applicable v1 baseline. Use accurate labels such as Imported accepted baseline
rather than Latest successful PATCH when the evidence is an export.

Keep parent, device and Market Info versions separate. A child's registration
establishes the exported parent link; a Not registered child alone says nothing
about whether its parent is registered. Registered parents without children need
explicit parent-level production evidence before selecting child-only POST.

Upload Success XML remains the existing parser, identity matching, generation
context correlation, event persistence and idempotency mechanism. After a real
Prod ZIP generation/upload, its successful acknowledgement advances the same
accepted-state columns. A later acknowledgement must preserve accepted non-target
fields and Market Info countries; delayed/duplicate responses keep current safeguards.

History and counts must distinguish imported baseline evidence from actual
submission successes. Imported registrations increase registered-device counts,
not successful POST/PATCH operation counts. Summary warnings about baseline age
and incomplete source coverage remain visible.

## Canonical adaptation

Reuse existing canonical fields, normalized code references, validation and XML
projection builders. Build an explicit field mapping from prepared columns/audit
to those fields; do not rebuild raw workbooks or depend on dated filenames.

Use explicit parent identities for MAX Liners/Sleeves despite their shared source
sheet. Resolve family/model metadata consistently; retain all original fields in
source JSON. Report unsupported XML fields/models as readiness blockers, with
source/identity coverage counts, rather than assume importer eligibility equals
generation eligibility. Mapping coverage for all supplied device types must be
reviewed during implementation against the actual current canonical model.

Manufacturer/representative actors must come from validated Production settings
or trustworthy accepted export evidence as appropriate. Legacy tracekey/Playground
sample SRNs must not fill Production gaps. Omit unavailable optional URLs; do not
render Not available yet as a URL.

## First release and repeat imports — recommendation to approve

Focus on initial population and additive retries:

- First import: create eligible source/device projections and registered baselines.
- Identical pair rerun: report already imported; no duplicated devices, baseline
  events or import state mutation. Pair identity includes audit hash as well as workbook.
- Corrected skipped devices/new identities: assess and add eligible new identities;
  preserve previously imported unchanged devices.
- Changed data for an existing identity: stop for a differences report in the first
  release. Do not introduce automatic updates until their review contract is agreed.
- Compare normalized device/source payloads, ignoring preparation timestamps and
  output ZIP metadata, so a newly generated but equivalent workbook is unchanged.
- Missing identities: retain and report them; no automatic deletion.
- Never overwrite newer locally accepted versions with an older or ambiguous export.
  Handle conflicting same-version payloads as a review requirement.

Preparation and database import are separate actions. Import does not regenerate
the workbook or revise Review Required flags. Keep fixed-name workbook/audit updates
coherent through temporary staging, a single writer and hash validation. Replacing
two filenames is not inherently atomic; readers must reject/retry mixed pairs.
Fail clearly when the current workbook is locked. Retain originals and record input
hashes/snapshots in the import history even after the current pair is overwritten.

## Implementation order and acceptance checks

1. Agree this design and first-release repeat-import policy. Finish fixed-name
   workbook/audit preparation and select the current verified pair.
2. Add profile-bound importer selection and a read-only assessment, with Dev
   regression coverage and synthetic Prod file/identity/filter tests.
3. Implement the existing-schema persistence adapter and explicit baseline evidence
   resolution. Verify complete source coverage, atomic rollback and additive retries.
4. Reuse the UI controls with the Prod button label, assessment/confirmation panel,
   clear skipped-row results and existing monitoring refresh.
5. Test the critical chain end-to-end with synthetic records and isolated SQLite:
   baseline import -> correct POST/PATCH/Market Info readiness -> ZIP generation ->
   Upload Success XML -> accepted snapshot/version refresh -> next operation.
   Include bulk operations, retained countries/fields, delayed and duplicate responses.
6. Run the full backend/frontend suites and production build. Validate the Prod
   profile read-only, then agree first local Prod initialization and reviewed import.

For the current pair, assessment should report 10,028 eligible / six skipped before
any additional integrity failures. Verify all eligible identity/source rows persist,
ready/blocked canonical counts account for every device, registered evidence is
attributable to exports, optional URL omission does not block the 940 devices and
no Dev database or files change. No real EUDAMED upload or M2M transport is introduced.

## Repository integration points inspected

- `backend/app/routers/profiling.py`: current run route directly invokes Dev importer.
- `backend/app/services/workbook_import.py`: source, identity, projection, monitoring
  and schema initialization; current rebuild clears projection tables.
- `backend/app/services/testing_state_store.py`, `accepted_state.py`,
  `testing_read_model.py`, `registration_summary.py`: accepted snapshots and
  acknowledgement-centric registration/cohort queries.
- `backend/app/services/xml_generation.py`: PATCH v2/later baseline selection and labels.
- `backend/app/config.py`: validated Dev/Prod paths and actors.
- `frontend/src/App.tsx`, `api.ts`: existing button locations, run request and refresh.

Review points: configured-file UI flow, explicit imported-baseline event vocabulary
with no physical schema change, additive first-release repeat-import policy and
the shared evidence-resolution changes needed to preserve the tested workflows.
