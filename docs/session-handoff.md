# Session Handoff

Updated October 10, 2026. This document distinguishes implemented behavior, dated audit findings and proposed work. Historical Playground evidence and export counts must not be read as a live database inventory.

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

- Branch observed during this refresh: `feature/testing-batches-audit`.
- Latest implementation commit observed at the October 9 sweep: `bbf5570` — `feat: prepare production import workbook with exception summary`. `355d910` introduced the earlier XML consolidation and ZIP-review rules.
- Optional-URL preparation updates, the importer draft and this documentation sweep have working-tree changes. Use `git status --short` for current status; do not assume all described work is committed.
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

Dev's configured `data/basic_udi_reference/BasicUDIs.xlsx` uses two sheets: `Upload(BasicUDI not registered)` maps to POST and `Update(BasicUDI registered)` maps to PATCH. `BasicUdiReferenceService` matches source worksheet names to Device Model and propagates the classification to child rows. Source version markers 1/2 are also assigned by this sheet mapping; they are not verified production versions. The older single-sheet format reads explicit Operation/Version columns. Some field provenance labels still name those older columns.

Parent registration does not prove child registration. Workbook POST/PATCH labels express source intent; accepted EUDAMED device identity/state must govern production eligibility. Workbooks supply proposed data, not proof of acceptance.

The current environment is now called **Dev** (targeting Playground). September 19 configuration work adds separate Dev/Prod startup profiles in one codebase: `.env.dev` and `.env.prod`, explicit schema selection, isolated storage paths and startup checks. Run `python -m app.run --environment dev --check-config` from `backend/` for read-only validation. Dev retains its existing database and source paths; Prod requires explicit configuration and actor identities. See [environment profiles](environment-profiles.md). UI environment labels are implemented. Controlled production database initialization/import and full generation verification against both profiles remain pending. No production database or acceptance data was created. Do not copy Playground successes into production acceptance.

Establish Production through a controlled, reviewed import/reconciliation of complete production exports: preserve originals, validate scope/pagination/encoding, match UDI-DI plus issuing entity and parent links, then store accepted fields, separate parent/device/Market Info versions, country lists, dates and provenance. Confirm registered parents without children are covered too. Missing identities in an unverified export remain unknown. Imports must not overwrite newer acceptance or silently preserve stale pending packages. Export reconciliation is a dated snapshot, not continuous synchronization; M2M remains deferred. Imported acceptance needs its own explicit provenance path, not fabricated POST acknowledgements.

### October 8 — Production Import Workbook Utility Direction

Historical planning checkpoint: the October 9 section above records the supplied
folders, approved parent reference and implemented preparation utility. Its current
decisions supersede the wait-for-folder instructions, two-tab-only layout, optional
Summary proposal and dated-retention preference below. Summary is implemented;
a single current pair is agreed but its replacement mechanism remains pending.
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

Earlier planning placed Production creation on hold pending Quality confirmation of the master workbook structure. Updated inputs and the current three-tab workbook are now prepared. The October 9 importer draft is ready for owner review, with No-only import and optional URL inclusion agreed. Configured-file assessment/confirmation and the additive repeat-import policy remain proposals. The table below is historical loader direction; consult the newer draft for the proposed initial application flow. The proposed frontend-only Production preview was cancelled before any changes were made. Dev remains available for testing. Do not initialize Production or copy the Dev database as part of loader planning.

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

Latest complete run on October 9, before preparation additions: 238 Python tests
passed in 248.66 seconds, 62 frontend tests passed and the TypeScript/Vite build
passed. Latest preparation changes passed 16 focused tests and saved-output/hash
checks. Older totals below remain dated checkpoints; the importer is not yet built.


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

Next priorities:

1. Verify model search/selection across all six XML operations and the review screens, unmatched Basic UDI-DIs, reset, recent testing/event pagination, stable controls and the non-sticky environment banner. Then manually verify previews, ZIP review feedback, draft edits, exact-device selection and acknowledgement refresh across the six visible workspaces, including navigation while an upload is in flight.
2. In controlled Playground testing, verify retained countries in PATCH after Market Info changes, mixed-baseline bulk Market Info, mixed success/error responses, duplicate uploads and delayed older acknowledgements. Use downloaded payloads with recorded generation context; previews alone do not create that history.
3. Review legacy accepted records with missing/partial snapshots before claiming complete source-drift protection. Choose a trusted recovery approach rather than filling historical acceptance from current workbook data.
4. Gradually replace remaining text-based identity lookups with `device_subject_id` joins, preserving existing data and lineage. Broader canonical/submission persistence remains a separate design increment.
5. Verify the implemented Bulk POST/PATCH performance work on a representative imported dataset and measure network/browser time before claiming 100-device launch performance.
6. Review the implemented Production importer, confirm profile actors/normalization with `--check-config`, then agree first local startup and reviewed import. Six review rows and two Echelon XML selection blockers are deferred; 29 template exclusions still need scope confirmation.
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
