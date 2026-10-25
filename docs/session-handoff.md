# Session Handoff

Updated October 25, 2026. This document distinguishes implemented behavior, dated audit findings and proposed work. Historical Playground evidence and export counts must not be read as a live database inventory.

## Important — Dev Test Cleanup Changed Legacy POST-Review Entries

Final verification found an unintended Dev-only database change during the earlier
failed full test run: the existing cleanup fixture used a stale cached operational
path and cleared `reviewed_post_baselines`. Its exact pre-run row set is unknown.
Production's file hash/mtime/size remain unchanged. Submission-event counts and
the 215-device identity/version comparison still match the earlier inspection.

Test cleanup now uses a fixed temporary path, and a new pytest connection guard
blocks writes to non-temporary databases regardless of stale application settings.
No stale backup has been restored. The owner confirmed there is no newer Dev
backup/Time Machine snapshot; the known September 3 backup is not assumed current.
See `docs/dev-test-isolation-incident-2026-10-25.md` for evidence and safeguards.
This supersedes any statement that both databases remained unchanged through the
whole test exercise. File preparation itself does not call database services.
Review markers must be re-established through a fresh owner review, not recreated
as historical approvals. No review entries have been fabricated or restored.
A consistent post-incident safety copy now exists at
`data/testing/backups/testing-state-after-review-cleanup-20261025T120142Z.sqlite3`,
with a JSON sidecar. This protects remaining state; it does not recover the lost
entries. The earlier guarded complete Python run passed **313 tests in 241.76 seconds**
and caused no further Dev file changes. Production and all 12 source/copy
fingerprints were unchanged. At that check, **114 frontend tests** and the build
passed. The newer reconciliation verification is recorded below; owner browser
verification remains outstanding.

## October 25 — Test-isolation Fix Applied To Main

The owner explicitly requested fixing main now. The isolated patch was applied to
the original main checkout, changing only `backend/tests/conftest.py` and adding
`backend/tests/test_database_test_isolation.py`. No feature, application,
configuration or Production data changes were copied from development. All 34
focused isolation/configuration/profile checks passed on main, including the eight
isolation regressions. Dev and Production hashes, sizes and modification times
matched their pre-fix values after testing. The pre-existing root `.DS_Store`
change was left untouched.

The earlier restriction against running tests on unguarded main is superseded for
this local checkout. The test-only main changes are currently UNCOMMITTED; commit
and publish them separately before assuming other checkouts have the protection.
Suggested message: `Protect operational databases from test setup and cleanup`.
Development's same safeguards remain in place. The patch file is retained as
historical transfer evidence and should not be reapplied to the already fixed
checkout.

## October 25 — Production Test-isolation Follow-up

Owner stressed that the Dev cleanup incident must not recur against Production.
Development regressions now explicitly exercise direct Production path rejection,
read/write URI rejection, stale cached Production settings in legacy review
cleanup, and a temporary symlink redirect. No Production connection is opened by
these checks: the guard rejects before SQLite. Session setup additionally asserts
its exact temporary database/backup destinations before any unlink/initialization;
a regression proves a poisoned Production configuration fails before either.
All 42 targeted isolation/configuration/baseline tests pass.

IMPORTANT: inspection of the original `main` checkout found its old cleanup
fixture is still present. These uncommitted development protections do not apply
there yet. Do not run tests from `main` until the test-only fix has been promoted
and checked. `docs/production-test-isolation.patch` contains exactly the conftest
fix and regression file for that checkout; `git apply --check` passed against main,
but the patch has NOT been applied. No main application/configuration/database
files were modified. Production baseline changes remain separately unauthorised.

## October 25 — Owner-approved Dev Playground Baseline Applied

The owner authorised aligning Dev with the retained extracts, then testing and
reviewing fresh Playground XMLs. The controlled Dev import has now completed:
215 devices / 10 represented parents, with 215 distinct imported-baseline audit
events. These are `PLAYGROUND_EXPORT.SNAPSHOT` / `IMPORTED` evidence, not upload
successes. Current accepted reads and generation use the export-backed state;
Production evidence remains separately labelled and Production is unchanged.

Fresh assessment reports **215 Matches / 8,600 matching fields / zero differences
and missing local fields** within the supported comparison. All 1,284 historical
event rows and all 12 protected source/canonical/review/package/batch tables retain
their checksums. Actual SUCCESS totals remain 10 parent POST, 205 child POST,
137 PATCH and 65 Market Info. Review markers remain zero; none were fabricated.
The unique Esprit identity link was recorded explicitly. Prior ambiguous generic
versions and all before-state caches remain in audit evidence.

Run `a3de0e74d85e4108aa1b8f234b18f015` has a verified pre-change SQLite backup,
full change audit and verification ledger. Fresh report ID:
`105c7a775963404e98079d7be4204e9c`. Full paths, hashes, recovery limits and owner test
instructions are in `docs/dev-playground-baseline-applied-2026-10-25.md`.
This intentional approved update supersedes earlier read-only-only status and the
pre-alignment Dev fingerprint. The earlier test-cleanup incident remains recorded;
the update did not recover its missing historical review approvals.

Verification: full Python run **326 passed in 237.81 seconds**, followed by **57
focused tests** after final additions/registration-reader compatibility updates.
Existing FastAPI deprecation warnings remain. Runtime checks with all SQLite
connections forced read-only show 215 registered/PATCH-ready/Market Info-ready
devices and 10 registered parents. A LINX22L5SD version-5 preview retains quantity
1 and passes XSD validation; no generation/review/submission was logged. Database
hash was unchanged by verification. Frontend remains at its earlier 118-test/build
verification; no frontend code changed in this baseline increment.

Next: restart Dev and refresh its frontend, rerun baseline assessment, review key
values, test one manually reviewed device, retain exact submitted XML/ZIP and ACK,
and compare fresh exports before expanding the batch. No source folders were
removed, no Template edits/import were applied, and no Production migration or
M2M work was performed. All code changes remain uncommitted.

## October 25 — EliteVT Bulk PATCH Association Confirmed

Owner suggested the ten repeated EliteVT names came from Bulk PATCH. Read-only
queries confirm the exact ten-device cohort shares the August 14 successful
version-2 transaction `90bffe49-e7b6-41e8-aee4-3ce65a521b84`, independently listed
in test report BT4. This supports a common bulk origin, but the legacy scenario
is `equivalent_first_patch` and retains no payload/name-change delta, so the
specific repeated name's origin/intent is not proven. Findings and limitations
are appended to `docs/playground-baseline-assessment-2026-10-25.md`. No operational
state or generation behavior was changed.

## October 25 — LINX22L5SD Historical Quantity Investigation

Owner requested tracing `GS1 / 05050649085604` (`LINX22L5SD`). Read-only queries
found quantity 1 → 2 in the context associated with successful September 1 PATCH
version 3 (event 385), then retained quantity 2 at successful PATCH version 4
(event 775). Both generation/acknowledgement pairs match by correlation ID, but
acknowledgements contain no quantity values. The retained September 3 database
backup already contains version 4 with quantity 2, corroborating that this local
value predates current Import Management work. The October export has the same
device version 4 and trade name, but quantity 1.

Outgoing XML/ZIP bytes were not located in the checked project or usual download
locations; the database retains package metadata/hashes rather than outgoing
payload bytes. The owner confirmed the ZIPs are no longer available. Historical
generation code was inspected but is not proof of the missing submitted files.
Cause remains unresolved; do not assert external changes or an application/portal
defect without evidence. Preserve this exception for baseline review. Details,
event IDs, package hashes and limits are in
`docs/linx22l5sd-quantity-investigation-2026-10-25.md`. Both current operational
database hashes remain unchanged. No baseline or generation changes were made.

## October 25 — Assessment UI Prioritises Known Differences

Owner feedback: the missing-evidence total (6,660 fields) overshadowed the 23
known-value differences. The Dev assessment now leads with value differences,
affected-device count and total devices, followed by an immediately visible
before/after table containing only proven value differences. Field-type counts
and readable field labels support review. Missing evidence, matching counts,
snapshot completeness and scope notes are in a separate expandable explanation;
6,660 is explicitly a field count. The full device comparison and lineage notes
remain available, with version/identity concerns signposted separately.
Per-device summaries distinguish differences from unknown fields. This changes
presentation only; assessment logic, report downloads and databases are unchanged.
Frontend verification: 118 tests pass; TypeScript/Vite build passes with the
existing bundle-size warning. Owner browser verification remains outstanding.

## October 25 — Read-only Playground Baseline Assessment Implemented

The owner approved investigating alignment of Dev's accepted state with actual
Playground exports. The agreed reconciliation contract is in
`docs/playground-baseline-reconciliation-proposal-2026-10-25.md`. Only its first,
read-only assessment stage is now implemented; no baseline writes are enabled.

New `PlaygroundReconciliation` reads the existing Dev SQLite database using
`mode=ro`, `query_only` and one snapshot transaction, without store constructors
or migrations. Verified batch exports are compared by issuer-qualified device
identity against accepted device/POST/Market Info evidence. Proposed canonical
fields resolve identity only; they never substitute for accepted values. The
assessment separates differences, missing evidence and lineage/version concerns.

Dev Import Management → Step 3 now offers **Assess Playground baseline** and
Excel/audit downloads. This is separate from workbook import, whose assessment
and confirmation remain disabled. Report files are retained under each batch's
`reconciliation/<id>/` folder, with fingerprint-verified downloads. Batch selection
changes invalidate delayed UI responses. Production endpoints refuse this flow.

The actual 215-device report found 23 known-value differences (10 base quantities,
10 trade names, two Market Info versions, one warning comment), 1,917 matching
projected fields and 6,660 unknown local fields. Local device snapshots are 25
full, 100 partial and 90 missing/unusable. There are 124 update proposals and 91
records requiring explicit lineage/version review; none are applied. The earlier
generic-version comparison is not equivalent to qualified POST/PATCH evidence.

See `docs/playground-baseline-assessment-2026-10-25.md` for the retained report ID,
findings, limitations and owner review instructions. Both operational database
fingerprints remained unchanged by this assessment; the earlier review-marker
incident remains separately unresolved. Next: owner reviews the concrete report
before implementation/application of the controlled Dev baseline update. Do not
fabricate successful submissions or operator approvals, switch source paths,
remove legacy folders, or migrate Production as part of this stage.

Assessment verification: the full backend run passed **310 tests in 232.77
seconds**, with two existing FastAPI startup warnings. After the final duplicate-
identity and unreadable-database checks were added, all **16 affected backend
tests** passed again (including all eight reconciliation tests). The **nine
repository utility tests** passed separately. These runs cover all 321 current
Python tests. All **116 frontend tests** and the TypeScript/Vite build passed;
the existing bundle-size warning remains (860.09 kB). Final operational database
hashes, sizes and modification times match the pre-assessment/post-incident
fingerprints. All 12 original inputs and batch copies still match their manifest.
The retained Excel has 215 device rows, 8,600 field rows and five export rows.
No formal browser acceptance is implied, and no changes have been committed.

## October 25 — Dev Batch Selection, Checks And Workbook Creation Connected

The owner authorised connecting the first three file-preparation steps and will
perform browser verification after implementation. In a backend-confirmed Dev
environment, Import Management now selects existing manifest-backed batches,
displays real source-file/provenance/integrity information, runs real source
checks, and creates/downloads the review Import Workbook and linked audit.
This supersedes earlier statements that these actions remain UI previews.

`EUDAMED_DEV_INPUT_BATCH_ROOT` is a new optional Dev-only setting. The local ignored
development profile points it to the original project's
`data/dev/import-batches/`; existing input/database paths and all Production files
remain unchanged. The launcher prints the batch root during Dev configuration
checks. New `/api/dev-input-batches` endpoints refuse Production, validate batch
identity/manufacturer and file fingerprints, bind preparation to checked inputs
and the existing workbook exclusions, reject stale inputs, serialize preparation
and publish complete immutable pairs under `prepared/<id>/`. No database import
or state services are called by the file-preparation endpoints. The separately
authorised baseline assessment below reads SQLite through a read-only connection.

The shared existing workbook preparer gained optional filtering/output-label
parameters whose defaults preserve existing Production behaviour. Dev uses the
current Accessories/Footspares exclusion and makes no parent/market overrides.
Dev export-absent rows are labelled **Not evidenced by supplied exports**, not
asserted unregistered; To Register remains a preparation grouping requiring later
assessment. Source checks do not certify canonical or XML readiness.

Actual-batch verification created an Import Workbook with 8,209 To Register rows,
215 Registered rows and zero review-required rows under the preparation checks.
The final workbook, paired audit and ZIP were verified. Both operational database
files retained their SHA-256, size and modification time across that file-only
verification; the separate test-cleanup incident above was detected subsequently.
Original source copies and configured import paths were not switched or deleted.
Generated pairs remain local/ignored. Workbook database assessment/import, baseline
updates and Reporting generation remain disabled/deferred. Read-only baseline
comparison is now available as described above. New browser
uploads are not connected; this increment uses the existing copied Dev batch.

Owner test instructions are in `docs/dev-workbook-preparation-testing.md`.
Restart the Dev backend, refresh the development frontend, select batch
2026-10-25-001, check sources and create/download the pair. Main/Production must
remain separate. Earlier-format smoke-test artifacts are retained as drafts but
cannot be downloaded as current-format preparations; create a fresh pair.

Verification before the isolation guard: the full backend suite passed **311 tests in 238.88 seconds**
with two existing FastAPI startup deprecation warnings. All **114 frontend tests**
and the TypeScript/Vite build passed, with the existing >500 kB JavaScript warning
(849.39 kB at this check). New coverage includes Dev-only HTTP access, real paired
downloads, stale/mutated input rejection, scope retention, failed-preparation
cleanup, output integrity, export-absence wording, asynchronous UI selection
guards and React StrictMode loading. The default-path test now uses an empty
synthetic Dev profile rather than assuming the operator's local worktree paths.
The later guarded run passed **313 tests in 241.76 seconds**, with the same two
startup warnings and no further operational-file changes. No formal owner browser
acceptance of this functional increment is implied.

Actual final-format verification artifact: `8331d75d8e26443bbe904a8f91c69173`,
workbook `dev-import-20261025-113116-043599.xlsx`. Its companion audit is about
91 MB uncompressed; the paired ZIP is about 2.6 MB. User-created preparations
receive new immutable artifact IDs/filenames; these retained files are ignored
by Git. The separate Dev test-cleanup incident above remains unresolved; Production
is unchanged.

## October 25 — First Dev Batch Created And Inspected

Phase 1 of the agreed Dev-first file arrangement is now implemented. The batch
`data/dev/import-batches/2026-10-25-001/` in the original project folder contains
verified copies of six Templates, the Dev BasicUDIs.xlsx and five Playground
exports, plus a provenance manifest and source-assessment JSON. `prepared/` is
empty. No current source files, input configuration, database paths, baseline
state or Production files were moved or changed. The batch is excluded from Git
locally in the shared repository; the development branch also adds its ignore rule.

The new `backend/scripts/manage_dev_input_batch.py` utility creates a new batch
without replacing an existing one and performs read-only source inspection using
the existing preparation readers. It verifies file fingerprints before inspection
and opens no application databases. No UI processing buttons have been enabled.

Findings: all six Templates contain 8,773 row occurrences / 8,771 distinct device
identities. The 349 missing-parent findings and two duplicate identity occurrences
involve the already-excluded Accessories/Footspares workbook. With the explicit
inspection filter matching the current exclusion policy, the five active files
contain 8,424 distinct devices, no duplicate identities and no findings from these
structural checks. All 215 XML devices match active Template identities; there are
47 reference parent identities. This is not full XML-readiness or import assessment.
The excluded source is preserved; its import eligibility has not been changed.

See `docs/dev-input-batch-2026-10-25.md` for paths, commands, findings and the
integration/cleanup checklist. A notable retained dependency is the legacy
tracekey workbook in `data/basic_udi_reference/`: existing Dev reference and
canonical services still read it. Preserve it until its handling is explicitly
resolved; do not delete the old reference directory as incidental cleanup.

Verification: **27 focused backend tests passed** (batch safety/integrity plus
existing workbook-preparation regressions); `git diff --check` passed. No frontend
code changed and no full backend suite was rerun for this first batch utility.

Next: review these concrete findings and agree the selected-batch/preparation
integration, including preservation of the current exclusion and legacy-reference
behaviour. Then implement the processing/reporting steps in the agreed sequence.
The XML version exceptions remain investigation-only; no baseline update is
authorised yet. No obsolete folders were removed. Earlier future-tense batch
creation instructions below are superseded by this completed checkpoint.

## October 25 — Agreed Dev-First File Structure And Migration Direction

**Retain all current Dev and Production XML/Excel locations for now.** Introduce
and prove a new folder structure for Dev before retiring any superseded Dev input
folders. Production files and configuration must remain unchanged so the existing
application on `main` continues to work. No additional databases are planned;
both existing databases and their paths remain unchanged throughout this work.

### Phase 1 — Establish Dev Batch Inputs Without Moving Originals

Create a complete Dev input batch under the original project's data area, outside
the development worktree, for example:

```text
data/dev/import-batches/2026-10-25-001/
├── templates/       Copies of the current Dev Device Template Excel files
├── basic-udi/       Copy of the current Dev BasicUDIs.xlsx
├── eudamed-xml/     Copies of the five downloaded Playground XML exports
└── prepared/        Future Import Workbook and linked audit file
```

Preserve original filenames and verify copied bytes against their sources.
Retain batch provenance, environment, source dates and file fingerprints so later
preparation, assessment and reporting results can be traced to exact inputs.
Ensure operational batch inputs/outputs are excluded from Git. Merely creating
these folders does not change which inputs the existing importers use.

The current original inputs to retain are:

- Dev Templates: `data/source_excel/`.
- Dev parent reference: `data/basic_udi_reference/BasicUDIs.xlsx`.
- Playground exports: `data/testing/playground-extracts/25-10-2026/`.
- All Production inputs, including `data/prod/template/`, `data/prod/eudamed_xml/`
  and the prepared workbook/audit pair under `data/prod/import_file/`.

### Phase 2 — Implement And Test Against The New Dev Structure

Connect the Import Management and Reporting changes to an explicitly selected Dev
batch and test the complete workflow: source-file selection/receipt, checks,
Import Workbook/audit preparation, assessment, controlled database import,
registration snapshot generation and comparison with the retained Playground
exports. Preserve current accepted-state, identity, version and lineage controls.
Review material integration/mapping/validation decisions with the owner before
implementation, following `AGENTS.md`.

Use the existing Dev/Playground database, with an agreed backup before real import
testing; do not create another application database or overwrite its testing
history. Automated regressions continue to use isolated temporary test databases
and synthetic fixtures. Confirm repeat-import behaviour, exception handling,
reproducible reports and preserved evidence. No Dev process or test may write to
Production. Production operation remains on `main`, one environment at a time.

### Phase 3 — Retire Superseded Dev Input Folders After Success

Only after the new Dev structure and workflows pass verification and owner review,
update remaining Dev configuration/scripts/references to use the new locations.
Check retained audits and file references, verify preservation/backups, then
present the exact obsolete Dev input folders for owner-approved removal. Do not
delete originals merely because copies exist. **Never remove `data/testing/`: it
contains the existing Playground database and retained history.** Database files,
database backup folders and other retained evidence are outside input cleanup.

### Phase 4 — Repeat For Production As A Separate Controlled Change

After the Dev transition is successful, undertake the equivalent Production
folder, configuration, workflow-testing and input-retirement tasks with the owner.
Production adoption must be reviewed and released deliberately so `main` remains
usable; do not apply development path changes to Production in advance. Preserve
the existing Production database, registered devices and audit/acceptance history.
No Production file migration or deletion is authorised by this documentation update.

### Available Export Evidence And Immediate Next Work

The owner reported Playground operational again on October 25 and supplied five
exports, `APP-DTX-000119311.xml` through `APP-DTX-000119315.xml`, in the retained
Playground export folder above. Read-only review found all five pages
(50 + 50 + 50 + 50 + 15), 215 unique devices, 10 represented parents, schema
3.0.32 and manufacturer `UK-MF-000033261`. All 215 successful local device
identities match; 53 available Market Info country snapshots agree. Two EliteVT
version discrepancies and one missing local Elite Blade device version require
review before claiming full alignment. Details are in
`docs/playground-export-review-2026-10-25.md`; no state was repaired/imported.
The export folder is excluded through the shared repository-local Git exclude.

Next session: review this phased direction, prepare the copied Dev batch and
its provenance, then agree processing integration and test cases. **The batch
folders/copies, path changes and cleanup have not been implemented yet.** This
update changes documentation only. Production, existing Dev input files and both
databases were not changed. `git diff --check` passed; no application tests were
rerun for this prose-only update.

## Latest Restart Position — Owner-Accepted UI Baseline

Work remains in `.worktrees/development` on
`feature/import-management-reporting`. The UI work follows local commit
`810f52e` (navigation/banner refinement and development-isolation guidance).
The original checkout remains on `main` for Production. Use
`docs/development-and-production.md` for starting and switching environments;
the owner chose one environment running at a time. Development uses the existing
Playground database; Production has its own database containing registered devices
and **MUST remain untouched by development and tests**.

The owner has reviewed the screens and accepted the latest compact layout as the
UI baseline: two-level navigation, 22–24 px sans-serif banner titles, concise
single-line descriptions, active area/step labels, filled active submenu items,
compact status displays and a teal accent identifying the working panel.
Retain this hierarchy and theme when extending the application. Owner visual
acceptance is not formal validation or confirmation of every browser interaction.

The current Import Management UI has three separate stages:

1. **Import Source Files** — multiple Template Excel files, one Basic UDI-DI Excel
   reference and multiple EUDAMED XML extracts; local selection feedback only.
2. **Create Import Workbook** — source-check/exception layout and preparation of
   the proposed Excel workbook with To Register, Registered and Summary sheets,
   plus its linked application-managed audit file.
3. **Assess & Import Workbook** — prepared-input review, database assessment,
   exception review, confirmation and import-result layout.

Reporting now has UI previews for **Registration Snapshot** and **EUDAMED
Comparison**: model/status and outcome filters, separate parent/device registration
indicators, known/unknown versions, synthetic examples and local XML selection.
Import History is still a placeholder. Selected files and filters are held only
in browser memory; a reload clears them. No source contents are processed.

**These are UI previews, not working import/report services.** Upload, source
checks, workbook/snapshot creation, database assessment/import, comparison and
downloads remain disabled. Example counts and devices are explicitly synthetic,
independent of selected files and operational state. No endpoints, mappings,
validation rules, schema or database state were changed for this UI work.

Next: follow the October 25 Dev-first file-structure direction above. The owner
has supplied Playground exports; review those alongside copied Dev Template and
Basic UDI-DI inputs and agree integration/tests before enabling processing actions.
Preserve the existing Playground history and agree a backup before real import
testing. Export scope, pages, dates and environment matter; absence from an
incomplete export does not establish non-registration. Production is outside
this development/testing scope. Automated upload/M2M remains prohibited.

Latest implementation verification: **109 frontend tests passed**, including six
new Import Management/Reporting checks, and the TypeScript/Vite build passed.
The existing >500 kB JavaScript bundle warning remains. The latest full backend
run is still **293 passed in 237.31 seconds** from the earlier baseline check;
backend tests were not rerun for these frontend-only changes. This handoff refresh
is documentation-only and was checked with `git diff --check`. Older results and
intermediate UI descriptions below are dated checkpoints superseded by this section.

## October 24 — Workspace Focus And Compact Banner Hierarchy

Following owner visual review, banner titles now use the application sans-serif
at 22–24 px, with 15 px descriptions. Location text identifies the active area;
the three import pages show Import Management / Step N of 3. The active submenu
page has a subtle filled background as well as its underline. Primary working
panels have a slim teal left accent. The Dev/Prod identity banner is retained.

Large white banner status cards were replaced with compact status displays.
Import/Reporting previews show a relevant neutral empty-state badge; their preview
notice appears once below the banner. Operational counts, import controls and
readiness/warning conditions remain intact. Repeated panel titles were shortened
to Source files, Source checks and workbook, Prepared workbook and Snapshot scope.
This supersedes the earlier serif-title/status-card styling notes below.

Verification: all **109 frontend tests** and the TypeScript/Vite build passed;
the existing bundle-size warning remains. The owner accepted the resulting visual
layout; exhaustive interaction/accessibility verification remains separate.
No backend, database, Production code or environment configuration changed.

## October 24 — Reporting UI Previews

The owner authorised UI development for Registration Snapshot and EUDAMED
Comparison while waiting for Playground exports. Both now use the established
compact banners, panels, controls and status styles on the development branch.

Registration Snapshot provides model and device-status filters, an opt-in
synthetic preview, separate parent/device registration indicators and parent,
device and Market Info versions. Unknown remains independent from Unregistered;
a registered parent can have unregistered children. The preview is illustrative,
not the final model-specific Template worksheet layout. Excel creation is
disabled; saved-snapshot history is an explicit empty state. The intended output
retains one Template-style worksheet per model and snapshot provenance.

EUDAMED Comparison provides saved-snapshot selection (synthetic example only),
local multi-file XML selection, and opt-in synthetic results with outcome filters.
Results distinguish Matches, Difference found and Unable to compare; exceptions
show findings, required actions and an owner. Unconfirmed export coverage is
Unable to compare, never proof of non-registration. Examples remain independent
of selected files/snapshot. XMLs are not read or uploaded; comparison and report
download buttons remain disabled. Selections/filters persist during application
navigation, but are not saved across reloads. No real report is created.

Verification: **109 frontend tests** and the TypeScript/Vite build passed, with
the existing >500 kB bundle warning. Three new checks cover unknown/parent status,
filter retention, incomplete export coverage and disabled processing with local
file selection. Owner browser review is outstanding. No backend, schema,
dependencies, Production code or database state was changed.

## October 24 — Source Files And Assessment & Import UI Previews

Owner review clarified three distinct stages, now implemented as separate
numbered Import Management submenu pages: **1. Import Source Files**,
**2. Create Import Workbook**, and **3. Assess & Import Workbook**. Import History
remains separate. The redundant button-like progress labels were removed.
Step 1 contains file selection/upload feedback; Step 2 contains source checks,
exceptions and workbook preparation/download; Step 3 contains database assessment,
confirmation and results. Next/back controls connect the stages while retaining
local selections. These remain UI previews with processing disabled and synthetic
examples explicitly labelled. All 106 frontend tests and the build passed after
the three-stage refinement; owner browser review remains outstanding.

The owner authorised these two UI pages ahead of receiving the Playground XML
exports. This supersedes the earlier menu-only hold for **UI work only**; backend
upload, preparation and import implementation remains deferred.

Source Files now provides three local file selectors: multiple Device Template
Excel files, one Basic UDI-DI reference Excel file, and multiple EUDAMED XML
extracts. Filenames, sizes and local selection status are shown, with a basic
extension warning. Selection is not upload, content validation or acceptance.
Files remain in browser memory and are retained when navigating between the
application areas; refreshing clears the selection. No file bytes are read or
sent by this preview.

The agreed output is an Excel **Import Workbook**, retaining the existing
To Register, Registered and Summary structure and a linked application-managed
audit file. Creating that pair remains separate from database import.

Assessment & Import provides the prepared-input, assessment, exception-review,
confirmation and result layout. Both pages use existing panels, colours, buttons
and compact banners. Optional example views contain conspicuously labelled
synthetic totals and two fictional device exceptions, independent of selected
files or application records. Real upload/check/create/download/assess/import
buttons remain disabled; ticking the example review checkbox cannot enable an
import. Import History remains a placeholder; Reporting was subsequently expanded
into the UI previews described above.

Verification: **106 frontend tests** and the TypeScript/Vite build passed, with
the existing >500 kB bundle warning. New checks cover file selection and its
retention, extension feedback and disabled imports after example acknowledgement.
These are component checks; owner browser/layout review remains outstanding.
No backend, dependencies, schema, mapping rules, main application code or database
state were changed. All new UI work is on `feature/import-management-reporting`.

## October 24 — Development Navigation And Planned Workspaces

Banner descriptions and status-card explanations were subsequently shortened
across the workspaces. Documentation uses the owner's wording: “Select and view
implementation documentation” and “Select perspective to view”. Counts and
readiness conditions are unchanged; the summary count is explicitly described as
successful POST/PATCH events. Environment-specific submission/testing wording is
retained. All 103 frontend tests and the build passed after the copy update.

Implemented on `feature/import-management-reporting` in `.worktrees/development`:
the initial large grouped menu was replaced after owner visual review with a
compact two-level menu: Import Management, Data Views, EUDAMED, Reporting and Help.
Only the active area's pages are displayed underneath. The title block is shorter
and the repeated tagline is removed; both navigation rows wrap on small screens.
The selected area/page are highlighted and the last page used in each area is
retained while the application stays open. Reloading resets to Submission Data.
Following owner review, workspace banners were also reduced to consistent
28–32 px serif page titles, 16 px descriptions, less padding and smaller status
cards. Redundant introductory labels were removed from the banner titles.
The owner subsequently requested single-line descriptions and consistent banner
depth. Descriptions now stay unwrapped, with horizontal scrolling when needed
and keyboard focus support so the full sentence remains accessible. The previous
character-width caps were removed. After further owner review, the 192 px minimum
was reduced to 112 px with 12 px vertical padding. Banner status labels and badges
now share one row, with details underneath, removing the tall stacked card.
On narrow screens banners
can grow for stacked content and accessibility rather than clip controls.
Submission Data uses the same title/description scale while retaining its import
controls. Body, table and non-banner status-card styles were left unchanged.
All 103 frontend tests and the build passed after this visual refinement; browser
review remains with the owner. This refinement does not change database state.
The Dev/Prod banner remains visible, with environment-specific wording confined
to the EUDAMED submenu. Import Management has
Source Files, Assessment & Import, and Import History; Reporting has Registration
Snapshot and EUDAMED Comparison. Existing Data Views, environment-aware EUDAMED
Workspaces and Documentation navigation remain available.

Each new entry opens its own descriptive placeholder with a **Not yet available**
status. No upload, import, report generation or comparison actions were added.
The owner wants menu work completed now and Import Management/Reporting feature
implementation held until Playground XML exports are available. Future import
testing will use Template data and Playground exports, retaining the existing
Dev/Playground state and protecting Production.

Verification: all 103 frontend tests and the TypeScript/Vite build passed after
correcting the environment-guide reference below (it is a local file, not a
registered in-app documentation section). Five new navigation checks cover
contextual page visibility, active area/page indicators, last-page restoration
and Dev/Prod/unconfirmed EUDAMED labels. The existing >500 kB bundle warning
remains. Browser layout/click verification is still for owner review in Dev.
No backend changes, application starts, database operations or main-branch changes
were made for this menu update.

## October 24 — Development Worktree Established And Full Tests Passed

The owner confirmed **one environment at a time** and use of the **existing
Dev/Playground database** for the next development wave. This supersedes the
earlier open isolation-design decisions below. Production remains in the original
folder on `main`; the new worktree is `.worktrees/development`, on
`feature/import-management-reporting`, starting from
`018734a1f7e6d5651e5c7951ccb62b3ca0f45eb6`.

Use `docs/development-and-production.md` for branch and environment switching
instructions in the development worktree.
The development worktree has an ignored `.env.dev` retaining the existing
Playground actor configuration and explicit paths to the original
`data/testing/testing-state.sqlite3`, its backup directory and Dev source/reference
workbooks. It has independent Python/frontend dependencies, copied from the
installed baseline, and its own normalization/report/artifact paths. No database
was copied. The Production database remains `data/prod/application.sqlite3` in the
original folder. No runtime was started or stopped by this setup; the existing
Production backend was observed with that database open and was left running.

Both original profiles and the new worktree's Dev profile passed read-only
`--check-config` checks. These validate configuration/schema without opening
SQLite; runtime/browser switching remains for the owner to verify using the guide.
Both environments retain ports 8000/5173: stop both current processes and close
old application browser tabs before starting the other environment. Do not switch
the original Production checkout off `main` to develop features.

The full baseline Python suite passed **293 tests in 237.31 seconds** with two
existing FastAPI startup deprecation warnings. It ran to completion without a
short timeout, with inherited EUDAMED settings removed, Dev selected and temporary
database overrides; the session fixture also isolates its database. All **98
frontend tests** and the TypeScript/Vite build passed in both the original checkout
and the new development worktree. The existing bundle warning remains (790.59 kB
JavaScript). These are automated checks, not new Playground submissions.

Production database and associated `application.sqlite3*` files were fingerprinted
without opening SQLite before the tests/setup and checked afterwards: file hashes,
sizes and modification times were unchanged. Production `main` and its tracked
working files were unchanged. The nested worktree is excluded locally through
`.git/info/exclude`; no tracked ignore change was made on `main`. No commits,
remote pushes, merges, migrations or application feature changes were performed.
The new guide and this handoff update are pending changes on the development branch.

Next: verify owner-controlled environment switching, then agree menu subheadings
and the detailed Import Management/Reporting scope before feature implementation.
Development may update Playground state; it MUST NOT touch the Production database.

## October 24 — Next Development Wave And Production Isolation

The owner's next-session instruction is to **review and update the Git branching
strategy before beginning further application development**. The current branch
at this handoff is `main`. Create a new development branch for the next wave;
development must not change the current `main` branch or disturb the owner's
ability to start and use the existing Production application independently.
This section supersedes earlier next-action priorities where they conflict.

### Production Database — Mandatory Protection

**The Production database MUST remain untouched by development. It contains
registered devices and retained registration evidence.** Do not reset, seed,
reimport, migrate, replace or otherwise write to it as part of development,
automated tests or development startup. Normal owner-controlled Production
registration work remains a separate operational activity.

A Git branch alone does not isolate SQLite files, environment configuration,
generated artifacts or running processes. Before starting development services
or running tests, identify the actual Production database and all configured
state/output paths through read-only inspection. Agree the isolation arrangement
with the owner, including a separate development checkout/worktree or equivalent,
development database and configuration, and separate ports/output locations where
needed. Check resolved paths rather than assuming that a different branch or an
environment label protects Production. Use synthetic fixtures for development
and tests; do not copy live registration data into development without explicit
owner approval. Do not start the application against Production as a diagnostic
step, because startup itself may initialize or migrate state.

### Required Branching And Startup Guidance

Review the existing local branches, remotes, startup scripts and environment
configuration before proposing exact commands. Preserve the current Production
code baseline and record its commit; do not assume that the tip of `main` is a
formally approved release. Identify uncommitted changes before branching or
switching, and preserve them without silently including unrelated changes.
The workspace GitHub panel now uses remote `backup`; `origin` remains Azure
DevOps. Verify these mappings before giving push/pull instructions.

Provide the owner with clear, repeatable instructions for:

1. Starting the existing Production application from its preserved code and
   Production configuration, independently of development.
2. Creating and using the new development branch and isolated working directory,
   including starting the development application against its own database.
3. Identifying the active branch, environment and resolved database paths before
   running commands, and safely stopping/restarting each application.
4. Committing, pushing and reviewing development work, and the deliberate review
   and release steps required before any future integration into `main` or
   Production. Do not merge or deploy development changes automatically.

Exact branch names, commands and the isolation design still require review with
the owner. Do the read-only assessment and present the concrete arrangement
before material configuration, architecture or workflow changes, following
`AGENTS.md`. Do not interrupt a running Production service to set up development.

### Three Main Development Areas

After Production isolation is established, commence collaborative design and
development on the new development branch in these areas:

1. **Application menu bar:** include **Import Management** and **Reporting**, with
   appropriate subheadings/submenus agreed with the owner before implementation.
2. **Import Management:** develop the dedicated Enterprise Solutions workspace,
   using the October 22 requirements below as the starting business direction.
3. **Reporting:** develop the registration snapshot and EUDAMED comparison
   functions, using the October 22 requirements below as the starting direction.

The owner has requested this next development wave; earlier “discussion-only”
wording records the previous checkpoint. Detailed menu structure, scope, data
handling, report layouts and material implementation decisions still require
owner involvement. Preserve SQLite, accepted-state and lineage guardrails, the
existing registration workflows and the prohibition on upload/M2M work.

This handoff update records the instruction only. No development branch or
isolated runtime has been created, no Production startup procedure has been
verified, and no database or application behavior has been changed by this update.

## October 24 — Validation Document Completed And Sent

The owner confirmed that the Master Validation document is complete and has
been sent to Regulatory Affairs. Document completion is no longer an outstanding
weekend action. This confirmation does not establish Regulatory Affairs approval
or completion of individual verification activities; their status must follow
the completed document and supporting evidence. The October 22 review instructions
below are a historical checkpoint, superseded by this completion update.

## October 22 — Master Validation Document And Restart Handoff

The active task is collaborative review of the Master Validation document:
`docs/master validation/EUDAMED In-house XML application_FCB.docx`.
The supplied Word template has been populated and subsequently revised with the
owner. Continue reviewing sections with the owner; do not treat the document as
approved validation or an instruction to implement application changes.

### Document Handling And Owner Preferences

- Update the same Word file in place; do not create revision copies. The owner
  manages formal versioning and release fields.
- Always read the latest saved document before editing. The owner has made
  independent edits; never regenerate it from the initial population script.
- Check for Word's `~$*.docx` lock file. If open, prepare the change but wait for
  the owner to save and close before writing. Compare original bytes immediately
  before saving to avoid overwriting a concurrent edit.
- Preserve unrelated content, formatting, comments and approval/control fields.
  Existing editing used `.venv/bin/python`, `zipfile` and `lxml` without adding
  dependencies; only affected package parts were rewritten. Temporary helper
  scripts in `/tmp` are disposable, not authoritative project artifacts.
- Use plain business language. Describe receiving, checking, preparing, reviewing
  and importing data without scripting or implementation detail. Import work is
  owned by the **Head of Enterprise Solutions** acting for Enterprise Solutions;
  Operators retain submission and returned-response activities.
- Personal references to Frank Bogle were replaced with **Head of Enterprise
  Solutions**, including document metadata. References to this handoff and other
  working project documents were removed from the validation document. Keep
  controlled procedures, the WI and primary test evidence as appropriate.

### Completed Document Updates

The document covers purpose/scope, intended use, responsibilities, regulatory
applicability and risks, validation strategy, lifecycle/change control,
dependencies, approval, requirements traceability and evidence. Appendix A has
13 user/system requirements; Appendix B has 12 validation areas (VP-01–VP-12).
Existing approval fields remain for authorised completion; do not invent approval
or formal test passes.

- Section 1.1 explains the common codebase with separate Playground/Production
  configurations, reviewed XML download, separate manual portal upload and
  mandatory response import. No live EUDAMED connection or automatic sync.
- Sections 2.1/2.1.1/2.1.2 explain the business process and responsibilities.
  Process arrows were replaced with sentences. Source code is held in a
  **Blatchford standard software repository provided to the application developer
  by the company CTO**; the role name is Head of Enterprise Solutions. Candidate
  software reference 3ec14d4 is historical, not an approved release baseline.
- Import wording was also simplified in lifecycle/revalidation, Appendix A and
  VP-02, retaining source checks, repeat-import protection and post-import review.
- Section 2.2 explains EUDAMED schema/business-rule rejection, corrections at the
  Blatchford end and resubmission. Distinguish risk reduction for invalid XML from
  factual device-data accuracy: service acceptance cannot prove every supplied
  value is correct. Some business-rule documentation is published; do not claim
  that all rules are unavailable. Local XSD validation cannot reproduce every
  server-side check. Partial bulk success requires per-device response review.
- Section 3.1/3.1.1 describes extensive Playground UAT by the Head of Enterprise
  Solutions and focuses on successful outcomes. Unsuccessful submissions are
  described as feedback used to refine the application and retest. The owner
  asked to avoid a failure-count narrative in this section.
- Appendix B is now **Validation Test Coverage and Evidence**. Its blanket
  “Not executed” statements were replaced with coverage statements distinguishing
  completed Playground UAT, supporting automated checks and evidence or detailed
  checks still requiring confirmation. Single and bulk PATCH share the same 137
  successful outcomes; do not count these twice. Backup/restore demonstration is
  not established by the evidence reviewed. Final evidence linkage and approval
  remain outstanding; broad UAT does not prove every outlined negative case.
- Formatting was standardised: Arial body 11 pt, headings 14/12/11 pt, tables
  generally 10 pt, header/footer 9 pt, consistent paragraph/list/section spacing,
  repeated table headers and rows kept together. Preserve subsequent owner edits.

### Playground Counts Verified Read-Only On October 22

Counts came from `data/testing/testing-state.sqlite3`, not a new Playground run.
Retained dated outcomes span August 9–October 5, 2026. Generated/preview events
were excluded. No repeated successful subject/message-type/version combination
was found in this check. A bulk upload can yield many individual device outcomes.

| XML message | Recorded submission groups | Successful individual outcomes |
| --- | ---: | ---: |
| DEVICE.POST | 10 | 10 |
| UDI_DI.POST | 19 | 205 |
| UDI_DI.PATCH | 28 | 137 |
| MARKET_INFO.PUT | 10 | 65 |
| Total | 67 | 417 |

There are **215 distinct device records** across successful outcomes. Groups were
identified using retained correlation IDs, with submission/transaction IDs as
fallbacks. Of the 67 groups, 64 contain only recorded successes, two have mixed
outcomes and one contains errors only; 31 error outcomes are retained. These are
retained-history counts, **not a complete lifetime test total, a pass rate, 417
uploads or 417 formally approved protocol cases**. Earlier rejected attempts are
not all in the database; not all older successes have original response XML
attached. The final document summary table therefore lists only the successful
individual outcomes by message type, without the total-attempt column. Original
XML/responses and exact software/configuration versions must be linked where
available before accepting historical UAT as formal validation evidence.

The September 28 Javelin “no successful PATCH at that checkpoint” note below is
historical; the October 22 query includes later PATCH outcomes dated September 28.
Do not mistake earlier checkpoints for current database inventory.

### Verification And Next Action After Restart

All recent changes were document edits and read-only evidence queries. No
application behavior, registration data, dependencies or transport were changed;
no new automated suite or live Playground submission was run. DOCX ZIP/XML
integrity and targeted content/preservation checks passed. Visual pagination
still needs owner review in Word.

The owner can continue reviewing the remaining validation sections. Keep the
completed UAT visible while distinguishing outstanding evidence, recovery/access
checks, final baseline identification and QA/asset-owner approval. The separate
Import Management and Reporting directions below remain discussion-only.

## October 22 — Import Management And Reporting Direction

The owner has identified two development areas below. This is agreed business
direction for further design discussion, **not authorization to implement new
menus, import workflows, reporting services or reconciliation logic**. This update
records the direction only. Retain the current SQLite and manual XML workflows.

### Import Management — Proposed UI For Enterprise Solutions

Provide a dedicated Import Management UI covering receipt/selection of Regulatory
Affairs Template workbooks, the Basic UDI-DI workbook, EUDAMED XML extracts and
supporting information; source structure/population and parent checks; exception
review; creation/review of the Import workbook and matching audit; application
assessment/confirmation; post-import checks; and import history/report access.
The current script-based preparation and configured-file Production importer
remain implemented behavior until a new UI is agreed and built.

Enterprise Solutions owns **all** source receipt, input checking, preparation,
review, application assessment, import confirmation, import-report retention and
post-import verification. Regulatory Affairs supplies/confirms business data and
resolves business exceptions. Operators begin submission activities after
Enterprise Solutions hands over the checked imported data. Operators generate and
review XML/ZIPs, submit manually to EUDAMED, import returned responses and verify
outcomes; they do not manage source-file preparation or database imports.

The downloadable assessment/result report is currently JSON. Provide a readable
Excel assessment/result workbook through the future UI, with concise totals for
new, unchanged, retained, skipped and changed/conflicting records; clear reasons
and required actions; and whether import can proceed or completed successfully.
This report records a particular assessment/import, not ongoing registration
status. Preserve the matching audit JSON and detailed integrity/source evidence;
a business-facing Excel report must not replace the audit needed by the importer.
Existing identity, No-only import, additive repeat-import and newer-acceptance
protections remain the starting contract, not incidental redesign opportunities.

### Reporting — Registration Snapshot And EUDAMED Comparison

A new top-level Reporting menu is proposed, with two distinct functions:

1. Generate a dated registration snapshot from the application database, with
   **one tab per device model**. Match that model's Regulatory Affairs Template
   column names, terminology, column order and formatting, including existing
   model-specific variations. Add only the reporting fields needed to explain
   registration and versions; do not expose internal canonical/API names as the
   business column vocabulary.
2. Receive EUDAMED XML extracts and compare them with a **selected saved
   application snapshot**, producing a brief exception report for action. Preserve
   both inputs so the comparison is reproducible after application state changes.
   Comparison must not automatically alter accepted state or import data.

Show Basic UDI-DI parent status separately from Device UDI-DI child status. A
registered parent can have unregistered children. Use explicit status text plus
independent colour indicators: Registered/pale green, Unregistered/pale amber,
and Unknown/pale grey where evidence remains unresolved. Do not silently convert
unknown to unregistered or infer non-registration merely from export absence.
Include a legend and status filters.

Template columns contain the available device details even when an identity is
unregistered; the status must clearly say Unregistered where confirmed. The owner
does not want "proposed values" as a confusing business status label. For registered
records, distinguish accepted information from unsent edits; for unregistered
records, use the available imported details without implying acceptance. Include
separate parent, device and Market Information versions where known; missing
versions remain unknown, not invented. Record snapshot date/time, environment,
manufacturer, scope and source import/evidence references.

Match regulatory identities by issuing entity plus UDI-DI, retaining the
issuer-qualified Basic UDI-DI link; catalogue/model names are review context,
not identity. Compare registration status and relevant accepted versions, parent
links and countries. Record export dates, scope, filters and pagination; report
incomplete coverage, unknown values, parents without export coverage and timing
differences as limitations/unable-to-compare cases, not proven discrepancies.
A snapshot comparison demonstrates agreement for the stated scope and dates,
not continuous synchronization with EUDAMED.

### Business Readability Is A Core Requirement

Reports are for business readers and must be **brief, clear and action-oriented**.
Lead with the overall position, totals and exceptions. Use plain-language outcomes
such as Matches, Difference found and Unable to compare. For each exception show
model/device, what differs, required action and responsible team. Keep technical
errors, hashes and detailed audit evidence outside the main business summary.
The detailed model tabs retain the familiar Template layout; avoid maintaining
competing registration calculations between reports and the operational views.

The import report answers "what happened during this import?"; the registration
snapshot answers "what position does the application record at this time?".
For example, a later registration snapshot changes after successful response
imports, while the earlier import result remains historical evidence.
Detailed menu placement, UI interactions, final report fields/layout, file handling
and implementation scope still need owner review before coding.

### Continue Registrations Using The Existing Workflows

The owner may register additional devices **before** these new functions are
added. Import Management/Reporting development is not a prerequisite for ongoing
controlled registration. Continue using the existing reviewed import, Registration
State / Parents & Children, Single POST for parent seeds and Bulk POST for further
children, with current eligibility and environment controls. This is a continuation
direction, not an instruction for Codex to submit anything externally.

After **every** submission, retain the exact downloaded package and returned XML,
use Upload Success XML for each response, and verify per-device outcomes before
dependent actions. Resolve errors/partial outcomes through Enterprise Solutions.
Do not assume current portal/application agreement from a preview, ZIP download
or historical count alone. Automated upload/M2M remains out of scope.

October 22 documentation verification: all 98 frontend tests and the
TypeScript/Vite production build passed; the existing >500 kB bundle warning
remains (777.84 kB JavaScript at this check). `git diff --check` passed. No new
backend run was needed for this prose-only update; the latest full Python result
is the October 21 run recorded below.

## October 20–21 — Work Instruction And Bulk Update Parent Lookup

### Work Instruction

The owner developed the operator WI in
`docs/work instruction/BQP 06-20 Annex B Issue D WI SOP EUDAMED Loader.docx`.
Update this **same file in place**; do not create revision copies. The owner will
assign formal document versions. Read the latest saved file before editing,
preserve owner edits, and check its Word lock rather than unrelated PowerPoint
locks. The directory also contains the owner's PDF and diagram PowerPoint;
do not assume either is automatically synchronized after a Word edit.

The WI uses General Information (1), Operating Instructions (2), and Approvals
(3). Section 1.5 introduces application checks/navigation and functional areas.
Sections 2.2–2.4 cover source checks and the Enterprise Solutions import role;
2.5 parent/seed registration; 2.6 child Bulk POST; 2.7 PATCH; 2.8 Market Information
PUT; and 2.9 error outcomes, retained evidence and Enterprise Solutions escalation.
The last document pass completed 2.9, removed draft/completion wording and
standardized 33 list items and 31 diagrams. Standard list spacing is 6 pt after;
diagrams are centred, inline, with 6 pt above and 9 pt below. Preserve annotations,
image proportions and the Windchill approval table. DOCX package/XML checks passed;
final pagination still needs visual review in Word. Do not claim document release
or regenerate the owner's PDF without a request.

### Shared Bulk PATCH / Bulk Market Info Parent Lookup — Fixed

Commit `3ec14d4` corrects the shared `/api/xml/bulk-patch-posted-parents` route.
The old summary filter required local post-success/child-success flags, hiding
parents whose registrations came from trusted Production exports and seed-only
DEVICE.POST evidence. The selector now recognizes imported baselines, successful
DEVICE.POST seeds and successful UDI_DI.POST/PATCH evidence, while excluding
unresolved identities and parent-only entries without a Device UDI-DI. Existing
per-device accepted-state, readiness, scenario and version guards remain intact.

October 21 read-only reproduction: Aqualimb TF parent `5050649AQUALIMBTFX7` was
registered with 13 registered children assessed ready for PATCH/Market Info, while
the old parent endpoint returned none. The corrected lookup returned the parent
and all 13 children using their imported evidence, without fabricating successes
or changing application data. These are dated observations, not today's inventory.
Both bulk workspaces share the corrected lookup. No migration or reimport is
required; restart the backend and refresh the browser if it still runs pre-fix
code. Runtime restart/browser verification was not established by the code test.

Verification: 28 focused tests passed; the full Python suite passed **293 tests
in 236.66 seconds**, with two existing FastAPI startup deprecation warnings.
Seven new HTTP selection regressions and a strengthened Production importer
regression cover the route, which earlier service-only tests missed. No XML was
submitted and no live database state was changed by the diagnosis/fix.

### Recorded Production Registration Milestone

Repository commit `d9c5a72` records four successful Production submissions on
October 12: 118 devices and two Basic UDI-DI parents, with four response XMLs
recorded in Production SQLite. This is the commit's dated milestone, not a fresh
October 22 database/portal audit. Production import/startup and manual submissions
are no longer pending initial implementation. Do not mistake older planning
statements below for current instructions to hold all Production activity.

### Dependency Incident Check — Limited Scope

The October 21 LiteLLM incident review found no LiteLLM/Trivy references in the
project files searched, no such packages among 27 distributions in the project
virtual environment, and no installed dependency declarations referencing them.
This does not clear historical installations, other environments/tools, CI builds
or the entire host. Historical build/install evidence and host indicators remain
outside that check. No package changes, credential rotation or full incident
response were performed. Keep any security assurance limited to the checks done.

## October 11 — Architecture Documentation Review

Updated the architecture definition and embedded Architecture Position against
implemented Production preparation/import, separate export-baseline evidence,
shared registration tabs/20-child drill-down, scoped readiness performance,
Production completeness notes, actor banner and Markdown navigation. Corrected
the old first-startup/import pending statements and preparation counts: the
October 10 checkpoint had 10,031 prepared rows, 10,026 eligible and five skipped,
with 354 registered baselines and 9,672 awaiting devices after initial import.
Counts are explicitly historical, not live inventory.

Aligned Project Overview and the startup milestone in Roadmap. Updated only the
current-status prefaces of the historical SQLite and identity proposals, preserving
their original discussion/DDL. The OpenAI/RAG assistant is labelled as discussion,
not implemented or an approved architecture change. No runtime, database or
workflow changes are part of this review.

Verification: all five Markdown renderer/cross-reference checks and the frontend
production build passed after the documentation changes.

## October 11 — Documentation Links and Tables

Follow-up renderer correction: wrapped lines within bullets and numbered items
now stay in the same list item instead of appearing as separate paragraphs.
Nested mixed lists and blank-separated sibling bullets are preserved. Regression
uses the actual Production importer Agreed behaviour section; all 98 frontend
tests and the production build passed. Corrected that guide's outdated introductory
claim that the first Production import was pending.

The Documentation viewer now renders Markdown cross-document links and tables,
including links in table cells and nested lists. Relative paths resolve against
the current document's actual repository path, so nested reports and multiple
README files navigate correctly. Clicking a document link selects its sidebar
section and scrolls to the document or linked heading. External HTTP/HTTPS links
open separately; code blocks remain literal and raw HTML is not executed.

The renderer is a small standalone React utility with no new dependency. The
schema-profile README and AGENTS.md project guidelines are included because
existing guides link to them. Every local Markdown cross-reference in the
available documentation is covered by a resolution test. The workbook contract's
locations table now renders as a table, with working preparation/importer links.
The documentation index records the completed October 10 initial Production import.
Refresh the browser; no backend restart or reimport is required.

Verification: all 96 frontend tests passed, including cross-reference coverage,
relative paths, heading anchors, table rendering, escaped pipes and safe link
handling. The frontend production build passed.

## October 11 — Parents & Children Registration View

Owner-approved shared Dev/Production UI: Registration State now has two internal
tabs, **Registration State** (existing view, default) and **Parents & Children**.
The same model/search/status/actionable filters apply to both. Parent rows combine
filtered model groups sharing an issuer-qualified Basic UDI-DI and show child
totals, registered/awaiting/unknown counts, child POST readiness and suggested
next step. Unresolved parents remain visible without an expandable device list.

Opening a parent loads 20 children at a time from the new read-model
`POST /api/xml/registration-children` endpoint. Details reuse the summary's
identity reconciliation, accepted-evidence and operation-readiness rules, keeping
unknown registration separate from XML eligibility. Exact parent issuer and
current model group keys scope the drill-down; a changed import requires a refresh.
Closing a parent discards pending responses, and count refreshes clear details.
No schema migration, importer change, reimport or XML workflow change is required.
Restart the backend and refresh the browser to use the new endpoint and tabs.
See [registration-counts.md](registration-counts.md) for operator guidance.

Verification: 28 registration-summary backend tests and all 90 frontend tests
passed, including issuer separation, parent-only acceptance, child deduplication,
filter-preserving tab switching, lazy loading, pagination, cancelled responses and
retry. The frontend production build passed. Browser layout review remains for
the owner; existing Dev/Production acceptance and generation rules are preserved.

Follow-up: the owner requested smaller child pages to keep expanded parent rows
manageable. Both environments now request 20 children per page explicitly, and
the endpoint default is also 20. Previous/Next retain the visible range and total;
107 MAX Liners children therefore occupy six pages, with seven on the last page.

## October 10 — Registration State Refresh Performance

Second optimization: Registration Summary reuses canonical record payloads from
its current SQLite snapshot instead of rebuilding the full canonical bundle.
Readiness assessment is limited to the selected family/model/search; whole-import
identity reconciliation still includes every record, so conflicts outside the
visible scope cannot make an ambiguous device eligible. Status/actionable filters
are applied after readiness as before. Explicit empty search results never fall
back to assessing all records.

Canonical completeness summaries now count missing fields in one pass, preserving
the same field order and required/missing semantics. Persisted canonical records
use Pydantic's direct JSON validation. Read-only local measurements: all-model
registration summary 4.015 seconds; MAX search 1.395 seconds for 940 devices;
Elan MAX selection 1.388 seconds for 820 devices. Complete summaries matched the
unfiltered-readiness calculation for all three scopes. Full canonical loading
fell from about five seconds to 2.383 seconds. These are service measurements;
browser/network timings remain to be checked by the owner. Restart the backend;
no reimport or database rewrite is required.

Second-optimization verification: all 112 focused backend tests passed in
257.56 seconds, including canonical validation, shared import, Production import,
search scoping and whole-import identity-conflict protection.

Follow-up UI simplification: awaiting/ready/blocked totals remain visible; import
timestamps and whole-import reconciliation are collapsed under Details. Unknown
status guidance appears only when unknown devices exist, and nonzero data
exceptions remain visible. Removed the unconditional claim that no
non-registration reconciliation exists, which contradicted the prepared Production
classification. Counts and readiness rules are unchanged. All 82 frontend tests
and the build passed after this presentation change.

Registration State no longer loads testing subject/event panels or the separate
XML-workspace readiness request. Its refresh indicator follows its own summary
request. XML readiness is loaded when entering the XML workspace; pending/failed
readiness does not expose stale per-device eligibility counts.

Dashboard readiness now reuses the existing request-local canonical selection
and per-model accepted-state transaction. Imported-baseline lookup reuses the
same state store. PATCH/Market Info assessments are skipped only when the existing
POST evidence confirms no tracked child registration, their shared prerequisite.
Production summary queries extract registration classification without loading
the complete source audit payload. No long-lived cache or eligibility rule change
was introduced; concurrent-state marker checks remain in place.

Read-only Production measurements: a 100-device sample fell from 800 connections
to 11, and from 0.141 to 0.013 seconds for readiness alone. For all 10,024
XML-ready records, previous readiness took 14.653 seconds excluding initial
canonical loading; updated readiness including canonical loading took 6.009
seconds. Every device's POST/child POST/PATCH/Market Info result matched. The full
updated registration summary took 7.108 seconds. These are local service timings,
not browser/network timings. Totals remain 10,026 devices, 354 registered, 9,672
awaiting registration and two XML blockers.

Verification: 98 focused backend tests passed, then the additional snapshot-reuse
regression passed (99 distinct tests); all 80 frontend tests and the build passed.
Restart the backend and refresh the browser. No reimport is required.

## October 10 — Production Completeness Notes

At the owner's approval, Production now distinguishes nonblocking completeness
notes from XML blockers in Canonical Validation. Scope status follows XML
readiness; missing XML-required fields remain XML blockers. Dev labels, filtering
and completeness warning rules remain unchanged.

The duplicated UDI-DI market-status field is recovered only from a canonical
status explicitly attributed to the supplied EUDAMED export. Existing values are
never replaced. Current imports receive that field directly; existing imported
records are enriched in the read model without rewriting the database or
requiring reimport. Missing clinical, applicability and substance/tissue values
remain unknown; no false/default values are invented.

Read-only verification: 350 market-status warnings resolved, leaving 3,150
completeness notes (nine per device across 350 registered devices). All 10,026
devices remain represented, with 10,024 XML-ready and the same two Echelon XML
selection blockers. No accepted state, history or XML guardrails were changed.
Verification: 77 focused backend tests and all 80 frontend tests passed; the
TypeScript/Vite build passed. Restart Production backend and refresh the browser.

## October 10 — Production Source Mapping Display

Read-only inspection confirms the local Production database now contains 10,026
device subjects and canonical records. The first import has occurred; earlier
notes describing an empty database or pending first import are dated checkpoints.

Fixed the Source Sheet to Basic UDI panel: refresh canonical review after an
import, and resolve Production family/model selection through imported variant
summaries rather than infer families from the shared `production-import.xlsx`
filename. Model selection now distinguishes variants sharing the same prepared
tab. Mapping row keys include model, parent and operation. Dev filtering remains
unchanged. No database records or XML rules were changed by this display fix.

Verification: all 76 frontend tests and the TypeScript/Vite build passed. Refresh
the browser to replace a mapping bundle cached before the first import.

## October 9 — Environment Banner Actor Details

At the owner's request, the shared Dev/Prod banner now places message schema,
manufacturer SRN and authorised representative SRN in one styled metadata row.
Values come from `/api/environment` and the active backend profile; no SRNs are
hard-coded in the UI. The endpoint exposes these public actor identifiers and
explicit AR suppression without returning storage paths or other configuration.
Suppressed AR displays “Not included”; missing configuration displays “Not configured”;
older backend responses remain “Unconfirmed”. Unverified environments show no actor
identifiers. Narrow screens retain the three-column row with horizontal scrolling.

Verification: 29 endpoint/profile tests and 73 frontend tests passed, including
both environments, suppression, missing actor metadata and failed confirmation.
Restart the backend and refresh the UI to obtain the extended endpoint response.
No import or database-state change is part of this display update.

## October 9 — Owner-Approved Knee And App Exclusions

The owner excluded Child’s 4-Bar Knee and Android/iOS apps, then explicitly
confirmed exclusion of Blatchford App. Updated the same current workbook/audit
pair using audited issuer/parent exclusions, carried forward automatically from
the previous audit on future CLI preparations. Original source files/hashes are
unchanged. No existing database state was deleted or imported; Prod batches remain zero.

Removed output identities: GS1 05050649008818 and 05050649011207 (Child’s 4-Bar
Knee), and 05050649130915 (Blatchford App). Four Android/iOS programming-app parents
have no current child rows, but are also excluded for future inputs:
5050649LINXPAPPAND2T, 5050649LINXPAPPIOS54, 5050649O3PAPPAND5P, 5050649O3PAPPIOS7Y.
The two device-bearing excluded parents are 5050649CHILD4BARKNEEH4 and
5050649DIGITALHEALTH4D. Other four-bar knee models remain in scope.

Current output: 9,674 To Register (9,672 No / two Yes), 357 Registered
(354 No / three Yes), total 10,031 rows. Assessment: **10,026 eligible, five skipped,
10,024 XML-ready, two XML-blocked**. The two Echelon catalogue collisions remain.
The excluded Child’s parent conflict is no longer a review item; remaining review
items are two Epirus conflicts and three Compact SAKL Market Info gaps. All 940
optional-URL rows remain included; 29 historical template-removal notes remain.

Audit retains all original source evidence plus excluded device identities and
parent policy. Summary marks the three rows as intentional exclusions. UI notes
show a brief exclusion count; the full workbook/audit remains available for review.
Refresh the UI and run a new assessment because the previous pair hashes changed.

Verification: 36 preparation/import tests passed, including accepted-parent versus
proposed-parent exclusion, untouched source hashes and exclusion carry-forward to
future device rows. All 68 frontend tests passed. Read-only assessment of the
updated actual pair confirmed the counts above and zero Production batches.

## October 9 — Complete Schema Initialization Before Monitoring

The owner's first-run Schema and Health panel reported four missing tables:
`testing_subjects`, `testing_events`, `generated_packages` and
`reviewed_post_baselines`. Startup initialized WorkbookImportService only;
testing/XML tables were otherwise created lazily when those workflows opened.

Startup now initializes the existing TestingStateStore immediately after the
import schema, before serving requests. This completes a partially initialized
Prod database using the same existing schema as Dev, without importing devices
or creating testing events. Repeated startup remains idempotent. Restart the
backend and refresh Schema and Health; the four missing-table warnings should
clear. Import-dependent N/A figures remain expected until the first import.

Verification: 43 production-import/environment tests passed, including reproducing
the partial database, completing startup, checking zero health issues, repeated
startup with zero data rows and read-only assessment. Existing FastAPI startup
deprecation warnings remain. No live Prod import was performed by this fix.

## October 9 — First Production Startup: Canonical Review Fix

The owner reported successful local Prod startup with schema 3.0.30 and zero
import batches. The initial UI request to `/api/canonical-review` then failed:
its variant-mapping path attempted to open the legacy tracekey reference workbook
under `data/prod/basic_udi_reference`. That workbook is not a Prod import input.

Fixed Canonical Review to preserve Dev's raw-reference mapping path and read Prod
variant mappings from persisted canonical/source records. Before the first import,
it returns an empty mapping list without loading legacy workbooks or creating a
database. After import it shows model/parent/operation/market information with
prepared workbook lineage. Original shared mapping definitions remain available.

Verification: 19 focused tests passed, including absent/empty Prod databases and
post-import mappings with legacy reference access forbidden. Direct read-only
review using the actual Prod configuration now loads four entities and zero
imported mappings successfully. No Production import was performed by this fix.
Restart the backend (the owner started without `--reload`) and refresh the UI,
then review Import Production Workbook's assessment before confirming.

## October 9 — Production Importer Implemented

Implemented the approved configured-file flow in a separate backend service module,
selected by backend environment. Dev retains raw-template import. Prod uses the
existing SQLite schema and Submission Data panels, with Import Production Workbook,
read-only assessment, confirmation and downloadable assessment/import JSON reports.
A missing database remains absent during assessment. Tokens bind configuration,
file hashes, database contents and a 15-minute expiry; process restart/new assessment
requires reassessment. Use one local backend worker for this transient-token flow.

The same current pair is now published at `data/prod/import_file/production-import.xlsx`
and `production-import.audit.json`, from the validated October 9 dated preparation.
CLI preparation defaults to staged fixed-name publication, Excel/exclusive writer
locks, hash checks and rollback; `--dated-output` is available explicitly. Original
inputs and the historical dated source pair remain unchanged. Source hashes,
original occurrences and full exported XML trees are retained in import provenance.

Read-only assessment of the supplied pair: 10,028 eligible (9,672 To Register,
356 Registered), six skipped, 10,026 XML-ready and two XML-blocked. Both blocked
rows are Echelon catalogue EC27LN7S: GS1 UDI-DIs 05050649030901 and 05050649032462.
They are eligible for import, but the current model/catalogue XML selection cannot
safely distinguish them. The assessment/import report lists blockers; workbook
review flags are unchanged. All 940 optional-URL devices remain included.

Persistence is transactional: new identities added; unchanged ignored; changes to
existing business fields stop import with before/after reports; absent/newly skipped
existing identities and newer accepted states retained. Baseline events are
IMPORTED / BASELINE_IMPORT / PRODUCTION_EXPORT.SNAPSHOT, with explicit export
provenance. No fabricated successful upload, reviewed ZIP or generated package.
Shared registration counts, UI assessments, bulk cohorts and accepted-state
resolution recognize baselines; actual upload-success flags/counts remain separate.

Synthetic checks cover baseline versions 1/2/3 to PATCH 2/3/4, single/bulk PATCH
and Market Info, UI assessments, generated ZIP Success XML correlation, duplicate
and delayed responses, retained countries, reimports, changed data, rollback,
expired/stale confirmations, unsupported accepted fields and pair publication failure.
Verification: corrected full backend suite passed 266 tests in 254.45 seconds.
Final affected-service regression passed 93 tests; the complete new importer suite
passed all 16 tests, including four added after full-suite collection. Together
these runs cover all 270 currently collected backend tests. The first full run
found four subject-history SQL formatting failures; the corrected query and added
history coverage passed subsequent checks. Existing FastAPI startup deprecation
warnings remain. Frontend: 65 tests passed; TypeScript/Vite build passed with
existing bundle warning (approximately 704 kB JavaScript). All local documentation
links and `git diff --check` passed.

Production has **not** been started or populated. Next: owner reviews this result,
checks confirmed Production actors/normalization using `--check-config`, then starts
the local Prod instance and reviews its assessment before confirming import.
Deferred preparation UI and automated upload/M2M remain outside this implementation.
The current checkpoint supersedes earlier implementation-pending notes below.

## October 9 — Import Decisions Approved And Preparation UI Deferred

The owner approved the configured current workbook/audit input, read-only
assessment and confirmation, plus additive repeat-import handling. Subsequent
new devices/corrected exceptions will use updated versions of the same pair:
add new eligible identities, skip unchanged devices, stop/report changes to
existing devices, retain missing identities and protect newer accepted state.
Exported accepted-baseline evidence is kept distinct from successful submission
acknowledgements. These decisions supersede the earlier pending review points.

The owner also requested a dedicated UI to ingest new/updated Template files
and EUDAMED-generated exports, report exceptions and generate an updated import
workbook with matching audit. Added to the UI Roadmap as deferred work; design
and implementation can wait. Initial importer remains a configured-file flow.
No importer or preparation UI implementation was made in this documentation step.
See [updated importer design](production-importer-design.md).

## October 9 — Complete Documentation Collection In UI

All 17 Markdown files under `docs`, including report/sample notes and the index,
are now available through the existing Documentation workspace alongside its
previous frontend guides. Sidebar groups distinguish Production preparation/import
design, configuration/publishing and historical reports/proposals. Markdown is
imported directly from the files, avoiding a second maintained copy. This changes
document availability only; importer and Production startup behavior are unchanged.

## October 9 — Documentation Sweep And Production Start Readiness

Reviewed every Markdown document under `docs`, including report/sample subfolders.
Updated the workbook contract to implemented three-tab preparation, current paths,
50-row parent reference, approved markets/optional URL inclusion, 10,028 eligible
and six skipped rows. Added historical-status notes to old identity/schema/test
proposals, refreshed Market Info parity, environment and aggregate-count descriptions,
and aligned architecture links and verification checkpoints. Earlier dated evidence
is retained; superseded counts/instructions do not describe current behavior.

The current local workbook/audit pair remains
`production-import-20261009-114955-299236`; older preparation pairs are no longer
present. Fixed-name replacement is agreed but not implemented. See
[documentation index](README.md) for current guides versus historical evidence.

Starting Production does not enable the prepared-workbook importer: the current
run route still invokes the raw-template service. Use `--environment prod --check-config` for read-only configuration review. Next: agree the importer draft,
implement/rehearse with synthetic isolated databases, verify Upload Success XML
and accepted-state progression, run regression checks, then agree first local
Production initialization and reviewed import. No Production startup/import or
application implementation change was performed in this documentation sweep.

Verification: all local Markdown links resolved across the 17 documents,
`git diff --check` passed and the frontend TypeScript/Vite build passed. The
existing >500 kB bundle warning remains; backend tests were not rerun for prose-only
changes. Earlier application/preparation test results remain dated evidence below.

## October 9 — Production Importer Design Draft

The owner requested design work. [Production importer design](production-importer-design.md)
records the agreed same-schema/same-workflow direction, profile-selected importers,
No-only filter, optional URL inclusion, configured current workbook/audit pair and
reused Submission Data controls. It proposes a read-only assessment followed by
confirmation, atomic existing-table persistence and explicit exported-baseline
events rather than fabricated successful uploads.

Code inspection found that current registration/cohort queries require successful
POST/PATCH acknowledgement events and PATCH branches assume local POST/PATCH history.
Shared evidence resolution must also support trustworthy imported current snapshots
while preserving Upload Success XML behaviour and distinguishing operation successes
from imported registrations. The draft identifies those integration points and
end-to-end regression requirements.

Configured-file UI flow, baseline event vocabulary and first-release additive
repeat-import policy are proposed for owner review. Fixed-name pair preparation
is agreed but not implemented; current artifacts still have dated filenames.
No importer/schema/runtime changes or Production database initialization were made
in this design step. Next: agree the concrete design before implementation.

## October 9 — Optional URL Inclusion And Prod Import Decisions

The owner confirmed that unavailable optional information URLs must not exclude
Elan MAX / MAX Liners / MAX Sleeves. A new workbook records the inclusion in
Summary, clears the optional-only review flags and leaves those URL fields blank.
Original placeholder values remain in the audit; no source file was changed.

- [Current workbook](../data/prod/import_file/production-import-20261009-114955-299236.xlsx).
- [Current audit](../data/prod/import_file/production-import-20261009-114955-299236.audit.json).
- All 940 affected rows have Review Required = No. Summary groups them as Included
  with optional URL omitted, rather than exceptions. Market choices are unchanged.
- To Register: 9,672 No / two Yes. Registered: 356 No / four Yes.
- Under the owner's filter, 10,028 rows are eligible and six are skipped.
  The exceptions are EP-FSR, EP-MSR, catalogue 330130 and three Compact SAKL devices.
- The 29 prior scope exclusions remain on Summary for later confirmation.

The owner also confirmed that Prod should reuse Dev's tested database schema and
application workflows, including Upload Success XML, with isolated Production
storage. Dev continues to import raw templates; Prod will import the prepared
workbook and only rows marked Review Required = No. The Production database importer
is not implemented yet. Export provenance must remain explicit without fabricated
success acknowledgements; detailed adaptation and repeat-import behavior remain
to agree before implementation.

Sixteen focused tests passed. Reopening the saved workbook checked inclusion of
all 940 rows, six remaining exceptions, retained scope notes and input/output hashes.
Output creation uses new dated filenames. Earlier Summary-generation counts
below are historical and do not describe the current import eligibility.

## October 9 — Updated Production Inputs And First Summary Workbook

The owner supplied revised templates and `BasicUDIs 9th October.xlsx` in
`data/prod/template/`. Every current template row has an explicit parent in the
new 50-row reference. Elan MAX's 820 devices and 107 MAX Liners / 13 MAX Sleeves
now have parent links. The owner approved Germany for Elan MAX and Germany/France
for MAX Liners/Sleeves, with Germany first placement.

The owner authorized a new workbook with a Summary tab. The preparation utility
excludes the selected parent reference from device-template scanning, records
approved proposed-market overrides and reports exceptions and prior scope removals.

- Historical workbook: `production-import-20261009-112246-846943.xlsx`.
- Historical audit: `production-import-20261009-112246-846943.audit.json`.
- Tabs: To Register, Registered, Summary. This pair and the initial pair below
  are no longer present locally; the newer optional-URL pair supersedes them.
- 9,681 template rows / 9,679 distinct identities; To Register 9,674;
  Registered 360; five overlaps; 10,034 distinct output identities.
- Six device exceptions remain: EP-FSR/EP-MSR parent and EMDN conflicts, catalogue
  330130's proposed/accepted parent mismatch, three missing Compact SAKL Market
  Info state/versions. Two To Register identities have Needs review status.
- Optional URL entries contain `Not available yet` for the three new parent
  groups, affecting 940 rows. These are grouped on Summary; with the six device
  exceptions, 946 current rows have Review Required. Countries are resolved by
  the owner's overrides, while original values remain in the audit.
- 29 previous identities are absent from current templates: the earlier 26
  accessory gaps, both Glide Socks and catalogue 405815. Summary lists all for
  scope confirmation; their data gaps were removed from scope, not completed.

Sixteen focused synthetic tests passed. Saved-workbook checks cover tab/count/
identity consistency, countries on all 940 rows, Summary exception totals,
source/output hashes and preservation of the previous workbook. No source input
was changed and no Production SQLite database was initialized or imported.

Next at that checkpoint: review Summary, resolve the six device exceptions, agree
optional URL handling and confirm exclusions. Optional URL inclusion is now approved;
the six exceptions will be skipped under the agreed import filter. Production database import/provenance,
canonical coverage and XML readiness still require separate agreement/checks.
See [current run instructions](production-import-preparation.md). The initial
preparation checkpoint below is historical evidence.

## October 9 — Initial Production Workbook Preparation

The owner supplied `data/prod/template/`, `data/prod/eudamed_xml/` and
`data/prod/import_file/` as the input/output locations and approved using
`data/basic_udi_reference/BasicUDIs.xlsx` for proposed parent details. The earlier
wait-for-information-folder instruction is satisfied for workbook preparation.

`backend/scripts/prepare_production_import.py` now prepares dated two-tab workbooks
and companion audit JSON. It retains original template values, exported accepted
values, separate versions, nested structures and every source occurrence. It
does not initialize/import Production SQLite or change canonical/XML rules.
See [preparation instructions and review findings](production-import-preparation.md).

First generated artifacts (historical filenames, now absent locally):

- Workbook: `production-import-20261009-071907-589408.xlsx`.
- Audit: `production-import-20261009-071907-589408.audit.json`.
- [Workbook design and deferred database-import contract](production-import-workbook-design.md).

The utility uses timestamped output names and never overwrites an earlier output.
The two supplied files `APP-DTX-000103944.xml` and `APP-DTX-000103948.xml` require
explicit Windows-1252 encoding overrides, recorded in the audit. See the linked
preparation instructions for the exact command; there is no silent fallback.

The first workbook contains 9,703 To Register identities and 360 Registered
identities, including five template/export overlaps. Two template identities
(EP-FSR and EP-MSR) have conflicting source data and receive Needs review. There
are 974 review rows: missing parent references/properties, those conflicts, one
proposed/accepted parent mismatch and three unknown Market Info state/versions.
The owner-approved template-only classification is applied; no accepted versions
are invented. Workbook preparation does not itself change application counts.

The eight template workbooks contain 9,710 populated rows and 9,708 unique
identities. The 15 export files contain 360 unique identities, with 355 XML-only
devices. The two output tabs together preserve 10,063 distinct identities.
To Register comprises 9,701 Not registered and two Needs review entries.

| Review issue | Affected identities |
| --- | --- |
| Missing parent reference | 942: Elan MAX 820, MAX Liner/Sleeve 120, Footspares 2 |
| Explicit parent lacks properties in BasicUDIs.xlsx | 26 |
| Conflicting template data and proposed parents | 2: EP-FSR and EP-MSR |
| Proposed parent differs from exported accepted parent | 1: GS1 / 05050649011207 |
| Missing exported Market Info state/version | 3 Registered Compact SAKL devices |

Reason counts overlap. Review Required is independent of Registration Status;
missing workflow metadata does not turn a known Registered device into an
unregistered device. Conflicting proposed cells remain blank, with all original
alternatives preserved in the audit. These flags are not XML readiness results.

Eleven synthetic preparation tests passed. Reopening the actual output verified
tab/count/identity preservation, review totals and workbook/input hashes. All
9,710 original rows, headers, cell values and cell types matched the audit.
Earlier in this session, before adding the preparation utility, the complete
Python run passed 238 tests in 248.66 seconds, all 62 frontend tests passed and
the TypeScript/Vite build passed. Existing FastAPI startup deprecation and the
537.53 kB JavaScript bundle warning remain. The full application suites were not
rerun after adding this isolated utility; its 11 focused tests passed.

Next:
review the generated workbook, resolve parent/conflict inputs and agree production
accepted-state provenance and database import behavior before implementing that
phase. Regeneration and upload/M2M remain deferred.


## September 28 — Javelin Registration And Bulk Candidate Fix

Read-only Dev database verification found 15 distinct successfully registered
Javelin devices under `5050649JAVELINTY`: one `DEVICE.POST` seed (`JAV22L1S`),
a nine-device `UDI_DI.POST` batch and a five-device `UDI_DI.POST` batch, all
acknowledged on September 25. All 15 have accepted POST version 1 and no recorded
successful PATCH at this checkpoint. The final five are `JAV22L6S`, `JAV22L6SD`,
`JAV22L7S`, `JAV22L7SD` and `JAV22L8S`; the additional-five registration exercise
below is complete.

The owner approved correcting bulk candidate queries that excluded the seed until
it had a successful `UDI_DI.PATCH`. Successful `DEVICE.POST` now qualifies alongside
`UDI_DI.POST` and `UDI_DI.PATCH` in parent counts, sample catalogues, selection and
the UI read model. These queries serve both Bulk PATCH and Bulk Market Info.
Existing accepted-baseline, XML-readiness and Market Info safeguards still apply;
no application data migration is required.

Verification: all 208 backend tests passed (246.68 seconds), including five new
synthetic bulk-candidate cases. The corrected filter returned 15 distinct Javelin
devices in a read-only Dev query. Browser verification remains outstanding.

The planned operator sequence is storage-condition Bulk PATCH, Bulk Market Info,
then trade-name Bulk PATCH for the same 15 devices, importing each acknowledgement
before the next operation. Verify the final PATCH retains the accepted storage
change and updated countries. These operations are planned, not recorded successes.

## September 25 — Catalogue Selection Dialog And Javelin Checkpoint

Bulk POST, Bulk PATCH and Bulk Market Info now use a shared `CatalogueSelection`
dialog for **Select catalogue numbers**. Choose **Select devices**, search by
catalogue number or Device UDI-DI, tick devices, then **Apply selection** to return
to a compact count and **Edit selection** button. The list appears immediately and
scrolls inside the dialog. Search preserves hidden selections; **Show selected
only** and **Clear selection** are available. Cancel, Escape and the close button
discard draft changes. Existing presets and catalogue-list import remain available;
no custom numeric count was added.

Selections remain independent between operations, clear on model/parent changes,
and are filtered against available entries. Applying a changed selection feeds the
existing preview invalidation and backend eligibility checks. No registration rules,
XML generation, database schema or accepted-state logic changed.

Verification: 53 frontend Node tests passed, including four new synthetic selection
interaction tests; TypeScript/Vite production build passed with the existing >500 kB
bundle warning. These are hook/control tests, not a browser accessibility or visual
verification. Manually check desktop/mobile layout, keyboard focus and selection in
all three workspaces. The next operator exercise is selecting five additional
Javelin children through the new Bulk POST dialog.

Read-only Dev database check confirmed **10 distinct registered Javelin children**
under `5050649JAVELINTY`: `JAV22L1S` from `DEVICE.POST`, plus nine children from
`UDI_DI.POST`. All ten have matching generated/accepted full snapshots at device
version 1, linked device identities, and Market Info resolving from the accepted POST
to version 1 with 25 countries. 456 imported Javelin devices remain without recorded
POST success. This is a dated local checkpoint, not a live Playground inventory.

## Repository And Delivery Context

- Branch recorded during the earlier refresh: `feature/testing-batches-audit`; verify the current branch with Git.
- Latest implementation commit checked on October 22: `3ec14d4` — `fix: recognise imported registrations in bulk update parent selection`. `355d910` introduced the earlier XML consolidation and ZIP-review rules.
- Use `git status --short` for current working-tree state; earlier working-tree descriptions below are dated evidence, not current status.
- The application prepares, validates and packages XML for the selected Dev/Production environment, then records manually imported EUDAMED responses. It does not submit XML through M2M transport.
- The owner approved a combined Device Model selector and aligned review filters. Preserve distinct operation-specific rules and exact-device selection when evolving these controls.
- SQLite remains the active application store. Dev/Production profiles, Production baseline import and manual registration workflows are implemented. Operational verification and representative performance measurements continue; Import Management UI and Reporting are proposed design work as recorded above.

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

Eligibility uses tracked successful registration or supported Production export-baseline evidence. Workbook classification as `PATCH` alone does not establish a trusted accepted baseline. Production export-baseline handling is implemented; the October 21 parent-selector correction aligns bulk selection with that existing evidence model.

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

Dev's configured `data/basic_udi_reference/BasicUDIs.xlsx` uses two sheets: `Upload(BasicUDI not registered)` maps to POST and `Update(BasicUDI registered)` maps to PATCH. `BasicUdiReferenceService` matches source worksheet names to Device Model and propagates the classification to child rows. Source version markers 1/2 are also assigned by this sheet mapping; they are not verified production versions. The older single-sheet format reads explicit Operation/Version columns. Some field provenance labels still name those older columns.

Parent registration does not prove child registration. Workbook POST/PATCH labels express source intent; accepted EUDAMED device identity/state must govern production eligibility. Workbooks supply proposed data, not proof of acceptance.

The current environment is now called **Dev** (targeting Playground). September 19 configuration work adds separate Dev/Prod startup profiles in one codebase: `.env.dev` and `.env.prod`, explicit schema selection, isolated storage paths and startup checks. Run `python -m app.run --environment dev --check-config` from `backend/` for read-only validation. Dev retains its existing database and source paths; Prod requires explicit configuration and actor identities. See [environment profiles](environment-profiles.md). UI environment labels are implemented. Production initialization and the initial reviewed import completed on October 10; the subsequent Production registration milestone is recorded above. Full operator verification of every flow remains separate from implementation. Do not copy Playground successes into Production acceptance.

Establish Production through a controlled, reviewed import/reconciliation of complete production exports: preserve originals, validate scope/pagination/encoding, match UDI-DI plus issuing entity and parent links, then store accepted fields, separate parent/device/Market Info versions, country lists, dates and provenance. Confirm registered parents without children are covered too. Missing identities in an unverified export remain unknown. Imports must not overwrite newer acceptance or silently preserve stale pending packages. Export reconciliation is a dated snapshot, not continuous synchronization; M2M remains deferred. Imported acceptance needs its own explicit provenance path, not fabricated POST acknowledgements.

### October 8 — Production Import Workbook Utility Direction

Historical planning checkpoint: the October 9 section above records the supplied
folders, approved parent reference and implemented preparation utility. Its current
decisions supersede the wait-for-folder instructions, two-tab-only layout, optional
Summary proposal and dated-retention preference below. Summary is implemented;
a single current pair and its staged replacement mechanism are now implemented.
The remainder of this section records the October 8 discussion, not instructions
to pause current design work.

The owner proposes a reusable utility package to prepare the Production import
workbook from the supplied template XMLs, template workbooks and EUDAMED XML
extracts. **Do not start designing or implementing the utility yet.** The owner
will provide an information folder; wait for that folder before inspecting the
inputs and agreeing the detailed design. This direction is proposed work, not an
implemented utility or authorization to initialize/import the Production database.

The output should be a tabbed workbook covering the device types represented
in the input template workbooks, including both template devices and EUDAMED
registered devices. Preserve the established template structure where practical,
with additional extracted registration information. Use one explicit registration
status field and consistent colours to distinguish statuses; precise columns
and colours remain to be agreed after reviewing the supplied folder.

The owner prefers the **to-be-registered device data to be physically separated
from the EUDAMED registered device data**, rather than mixed together with only
colours or a status filter. The agreed arrangement, in order, is **two main data tabs**:

1. **To Register** contains all template-only, unregistered devices across device
   types, retaining all columns from the input template workbooks.
2. **Registered** contains all EUDAMED registered devices across device types,
   with linking identifiers and the additional fields from the EUDAMED extracts,
   including the device version and the separate Market Info version, plus
   suitable metadata to be agreed after reviewing the supplied folder.

The owner's term "delta columns" means **additional EUDAMED fields**, not a
comparison or report of differences between template and registered values.
Metadata candidates include source XML filename, export date and extraction
date; these are proposals until the available inputs and desired columns are
reviewed. Preserve separate version fields where supplied, including Basic
UDI-DI parent version if available; do not collapse parent, device and Market
Info versions into one field or infer missing versions.

Include a **Device Type** column for filtering within each tab, instead
of creating separate tabs for each device or device type. This keeps the number
of tabs manageable. A Summary tab is an optional proposal, not yet agreed.
Use consistent linking identifiers and field conventions across both populations;
the two tabs do not need identical full column sets. Allow additional business
information to be added to the appropriate structure. Keep
business-supplied additions distinguishable from extracted accepted EUDAMED
values, and preserve the latter as the registration reference. Retain the status
field and colours as supporting cues despite the physical separation.

The owner has checked internally at work and authorizes this classification for
the supplied Production preparation inputs:

| Matched input evidence | Workbook registration status |
| --- | --- |
| Device appears in an EUDAMED XML extract | Registered |
| Device appears in a template workbook with no matching EUDAMED entry | Not registered |
| Device appears in both sources | Registered; reconcile the two sources into one device entry. |
| Missing or conflicting identity prevents a reliable match | Flag for review rather than force a registration classification. |

Match devices by UDI-DI plus issuing entity and retain Basic UDI-DI parent links.
Template-only classification is now an owner-approved decision for these supplied
inputs; do not keep requiring a separate export-completeness confirmation before
making that workbook classification. This does not retrospectively classify
unmatched identities in older export audits or turn generic workbook POST/PATCH
instructions into accepted EUDAMED state.

Keep proposed template values distinguishable from extracted accepted values.
Retain source filenames, worksheet/row or XML provenance, export dates, and
available accepted device/Market Info versions and country lists. Do not invent
missing accepted versions or use Playground testing successes as Production
acceptance evidence. How the workbook status and extracted evidence will populate
the Production database must be reviewed as part of the later import design;
this agreement alone does not change the application's current Unknown counts.

The workbook must contain everything required for the supported Production
import and submission workflows, not only identifiers and additional extract
columns. Retain complete proposed device/parent data, available accepted EUDAMED
data, separate versions, Market Info state, registration status and provenance.
Determine the full required column set against the supplied inputs and current
workflow requirements; flag missing required information rather than invent it.

The owner requests **Production workbook design and import first**. Regeneration
is a later consideration, not part of the current design or implementation scope.

- **Import:** validate and reconcile the input workbook and EUDAMED extracts,
  prepare the complete two-tab Production workbook, and support its controlled
  import into the Production database. Preserve proposed business data separately
  from extracted accepted state. The precise utility/application boundary and
  database import behavior remain design decisions to review with the owner.
- **Regeneration (deferred, provisional ideas only):** use a retained input workbook and a subsequent EUDAMED extract
  to compare the proposed/input data with the registered snapshot and regenerate
  the workbook. Include additional devices found only in EUDAMED, retain
  business-added information, and report missing identities, field differences
  and conflicts for review. The earlier "delta columns" clarification still means
  additional EUDAMED fields; the comparison function is a separate requirement.
- **Local retention:** keep a local copy of every generated/regenerated workbook
  and retain the original input workbooks and XML extracts. Use distinguishable,
  dated outputs and source/generation metadata so each workbook can be traced to
  its inputs and compared with earlier outputs without overwriting originals.
- **Complete alignment:** preserve every input device and all its supplied
  columns/values across the two output tabs, adding EUDAMED-only devices. A device
  appearing in both sources belongs in Registered, with proposed input values
  still recoverable alongside accepted values. "100% alignment" means complete
  input coverage and preservation, not silently forcing conflicting source and
  accepted values to be equal. Additional devices with incomplete business data
  must remain visible and be flagged for completion.

The current delivery sequence is:

1. Receive the owner's information folder and design the complete two-tab import
   workbook against the template workbooks/XMLs, EUDAMED extracts and required
   Production workflow data. Review and agree the design with the owner.
2. Implement and validate the workbook preparation utility and import function
   enabling controlled creation/population of the Production environment,
   preserving source data and extracted accepted state separately.
3. Verify the import, registration counts and XML workflows, then have the owner/QA
   register a small number of devices through the existing manual EUDAMED workflow
   and check the accepted results. Automated upload/M2M remains out of scope.
4. Only after the import works successfully and that registration exercise is
   verified, revisit regeneration design with the owner. QA's actual application
   usage pattern is a determining input, and the owner has further thinking to do.

Retain dated local workbook copies and original inputs in the initial phase.
Do not assume that the earlier suggested recurring regeneration cycle, comparison
behavior or business-edit handling is a finalized design. Continue to wait for
the information folder before detailed utility design/implementation; documenting
this direction does not itself initialize or import Production.

### Production Hold And Incremental Loader Direction

Historical planning placed Production creation on hold pending Quality confirmation of the master workbook structure. That hold was superseded by the implemented configured-file preparation/import, No-only eligibility and additive repeat-import handling, followed by the reviewed October 10 import. The table below retains historical loader direction and is not a current instruction to delay registrations. The proposed frontend-only Production preview was cancelled. Dev remains available for testing; do not copy its acceptance data into Production. The proposed Import Management UI is a later enhancement, not the initial importer.

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

Next sequence: review the generated workbook and resolve missing/conflicting inputs; agree the import workbook and evidence mapping; review database import identity, validation and transaction rules with the owner; implement and verify database import with synthetic fixtures; then agree controlled Production initialization and baseline population and verify a small real registration exercise. Defer regeneration design until this succeeds and QA's application usage is understood. Incremental watermark/reimport ideas above must not expand the initial import scope without agreement.

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

Latest complete Python run: **293 passed in 236.66 seconds** on October 21
after the bulk parent-selector correction; two existing FastAPI startup warnings.
The October 22 documentation check passed all 98 frontend tests and the
TypeScript/Vite build (777.84 kB JavaScript, existing >500 kB warning). Frontend
checks are automated component/helper checks, not full browser verification.
Production importer/startup and the initial reviewed import are implemented.
Older results below remain dated checkpoints. This October 22 handoff edit is
prose-only; no new backend test run or live registration inventory is implied.


Historical September 19 UI verification: **48 frontend Node tests passed** and the TypeScript/Vite build passed. Coverage includes model pair selection, Basic UDI search, clearing/resetting scopes, environment lookup and event-pagination reset. These are component/helper/hook checks, not full browser end-to-end tests. The existing Vite warning for a JavaScript chunk over 500 kB remains. Removing banner stickiness was a subsequent CSS-only edit checked with `git diff --check`. No new full backend run was performed for these frontend changes.

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
.venv/bin/python -m pytest backend/tests tests -q -ra
npm --prefix frontend test
npm --prefix frontend run build
git diff --check
```

Subsequent readiness-fix verification: all 11 frontend tests and the production build passed, then below the 500 kB warning threshold. These tests are not browser confirmation. September 16 documentation verification: all nine local links resolved and `git diff --check` passed. The frontend build passed, but embedded documentation growth brought the JavaScript bundle to approximately 503.5 kB, restoring Vite's 500 kB warning. This is a bundle-size warning, not an XML-generation timing measurement. Backend tests were not rerun for this prose-only change.

Current priorities: continue controlled registrations when the owner is ready;
verify the running backend includes the bulk parent-selector fix; discuss the
Import Management and Reporting design before implementation. The new functions
are not prerequisites for additional registrations.

Continuing verification and hardening priorities:

1. Verify model search/selection across all six XML operations and the review screens, unmatched Basic UDI-DIs, reset, recent testing/event pagination, stable controls and the non-sticky environment banner. Then manually verify previews, ZIP review feedback, draft edits, exact-device selection and acknowledgement refresh across the six visible workspaces, including navigation while an upload is in flight.
2. In controlled Playground testing, verify retained countries in PATCH after Market Info changes, mixed-baseline bulk Market Info, mixed success/error responses, duplicate uploads and delayed older acknowledgements. Use downloaded payloads with recorded generation context; previews alone do not create that history.
3. Review legacy accepted records with missing/partial snapshots before claiming complete source-drift protection. Choose a trusted recovery approach rather than filling historical acceptance from current workbook data.
4. Gradually replace remaining text-based identity lookups with `device_subject_id` joins, preserving existing data and lineage. Broader canonical/submission persistence remains a separate design increment.
5. Verify the implemented Bulk POST/PATCH performance work on a representative imported dataset and measure network/browser time before claiming 100-device launch performance.
6. Continue reviewed Production imports under Enterprise Solutions using the implemented preparation and assessment flow. Initial startup/import is complete. Review any remaining source exceptions against current evidence; five skipped rows, two Echelon XML-selection blockers and 29 template-removal notes were historical checkpoints, not a current unresolved inventory. Design the new Import Management UI and business-readable reports with the owner before coding.
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
