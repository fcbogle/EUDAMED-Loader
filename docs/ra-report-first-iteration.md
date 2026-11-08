# Stored Device Data Comparison — first Dev report

Updated November 8, 2026. Implemented on `feature/import-management-reporting`;
owner browser review is pending. Reporting uses application data and retained Data
Import extracts only. Registration proof belongs in separate reports; no changes
to registration, accepted-state or import rules.

## Open and generate

Restart the Dev backend and refresh the frontend. Open **Reporting → Stored Device
Data Comparison**. The report automatically checks published Data Import source
batches and identifies the latest suitable complete retained EUDAMED extract set.
Check the displayed batch, export dates, scope and excluded-set explanations, then
choose **Generate report**. There is no reporting file selector, upload, alternative
extract picker or direct filesystem path input. All new or corrected extracts come
through **Import Management → Import Data**.

Only report options, such as whether Excel includes device details, are accepted
by the reporting API. Source status is checked read-only when Reporting is opened
and checked again during generation. The generated report's source context is
authoritative if Data Import has supplied newer evidence since the screen opened.
No suitable set means unassessed/unavailable evidence, not a zero-count report.
Correct unavailable/conflicting evidence through Data Import, then reopen Reporting.

Selection uses recorded export timestamps, not source-folder, upload or modification
dates. Manifest hashes, XML identities/schema/manufacturer, timezone-bearing dates,
file inventory and complete declared pages must be usable. Pages are never combined
across batches. Identical byte/hash copies are one observation. Distinct complete
sets with overlapping date ranges cannot be ordered safely and block automatic
selection. A suitable older set may be used if newer retained sets are unusable;
excluded sets and reasons stay visible.

Published source batches are retained application evidence, even if their later
workbook/database import has not completed. Their inclusion does not accept data or
change operational registration state. Draft review revisions that have not been
published as dated batches are not selected. Only XML inventory is checked here;
unrelated Template corrections do not invalidate otherwise usable export evidence.
Scope follows the Data Import manifest; unrecorded business export filters remain
unknown. Complete pages alone do not establish full manufacturer/model coverage.

The selected set's batch, export date range, manifest/set hashes and exclusion
reasons are retained in Excel context. This first implementation remains Dev-only;
Production reporting rejects these endpoints.

## Summary and grouped exceptions

One row per active imported canonical family/model, using the grouping employed by
EUDAMED Submission. Identity/model/provenance come from canonical data; comparison
values come from stored accepted state. No independent model list is maintained.

| Column | Meaning |
| --- | --- |
| Database devices | Device entries in the latest import's canonical scope |
| All compared attributes match | Every supported field has usable stored data and agrees with the extract |
| Differences found | At least one known stored attribute differs; other fields can still be incomplete |
| Insufficient stored data / scope | No known differences, but identity, accepted values or supported export coverage are incomplete |
| Absent from extract | No matching issuer-qualified identity in the selected extract; no claim of unregistration |

These outcome columns are mutually exclusive and sum to the database total.
Extract-only identities have a separate whole-report count. Ambiguous identities
remain unresolved and are not merged to improve the match rate. Unmapped model
names remain visible.

The Model column lists model names as hyperlinks, with no separate model selector
or model buttons. Follow a model link to its grouped findings and comparison
coverage. The full model summary and overall totals remain visible, so another
model can be opened directly. Use View details for all models to clear that scope.
Findings group attribute differences, missing stored fields, identity/scope gaps
and relevant date context. Each group counts unique affected database entries.
Finding counts overlap: one entry can have several different or missing fields.

**View affected entries** opens optional details, at most 25 entries per page.
Differences show **Stored** and **Extract** values. Missing fields have their own
list. The stored-state source and date notes support investigation without claiming
original upload proof.

**Download full report Excel** captures the complete generated report, regardless
of the on-screen model filter. It contains context and field scope, model totals,
grouped findings and comparison sources. Individual device worksheets are included
only when explicitly requested before generation. Identifiers/formula-like text
are written as literal Excel text. Reports are not retained server-side; download
to preserve a result.

## Stored-data basis

Use the existing shared accepted-device and accepted-Market-Info readers. These
include supported accepted export baselines and successful POST/PATCH/Market Info
updates. Existing snapshot/version checks remain in place. Known newer successful
history without a matching snapshot prevents an older snapshot from passing as
current stored accepted values.

Unaccepted generated drafts, failed submissions and proposed/current workbook
values are not fallback sources. If a full or partial accepted snapshot lacks a
field, the report identifies missing stored data. Explicit optional null values
can be compared as recorded absence; blank/null required fields are missing data.
False and zero are not treated as missing.

An accepted baseline imported from an earlier EUDAMED export is valid stored data
for this report. Matching it with the selected extract is **not** independent proof
of an earlier upload. That distinction is explicit in the report scope.

## Supported field scope

- Device UDI-DI and issuing entity; Basic UDI-DI link and issuing entity.
- Reference number, trade name and language, device status and nomenclature codes.
- Production identifier and secondary identifier/issuer.
- Sterile, sterilization, base quantity, reuse count, latex and reprocessed flags.
- Storage conditions, critical warnings and their comments.
- Device version, market countries/original-placement flags and Market Info version.

Fields and limitations appear on screen and in Excel. Parent attributes and parent
versions are outside this device report. Server version dates, raw XML byte equality
and unsupported export projection are also outside its scope. Unsupported projection
prevents an all-match result even where the projected fields agree.

The report uses the existing comparison normalization for supported values. List
ordering is ignored, but country/placement and warning/comment relationships stay
intact. Nomenclature codes use the XML schema's whitespace-list representation.
No tolerance for known business-value differences is introduced.

The database snapshot and extract represent different dated observations. Newer
accepted activity is flagged as context, without hiding a known attribute difference.
An equal-value result does not establish today's live EUDAMED position. Missing
extract identities do not establish unregistration.

## Comparison coverage and storage safety

Per-model coverage shows entries with stored accepted device values, matched
extract identities and recorded source-workbook links. Source links are provenance;
they do not verify original-file availability or constitute registration proof.
The optional comparison-source inventory lists extracts and recorded workbook
names/hashes/import times. It does not inventory submission/Success XML evidence.

SQLite is opened read-only/query-only inside one read transaction. No store
constructors, schema initialization, imports, accepted-state writes, review receipts
or migrations are invoked. Hash-verified retained XML bytes are parsed through
discarded temporary copies; retained Data Import files are never rewritten.
Tests use synthetic files and temporary databases. No Production rollout, merge,
new database or M2M integration is included.

## Separate reports for registration proof and audit

These remain separate from the stored-device comparison:

1. **Registration Evidence:** use the latest suitable complete EUDAMED extract set
   already retained by the application, with subsequent successful registration
   evidence shown separately. Any newer extract is supplied through Data Import, not Reporting.
   See the detailed design below. Distinguish export evidence, retained Success XML,
   correlated submission records and unavailable original files. An export baseline
   must not be labelled as proof of an earlier upload.
2. **Submission Activity:** the first read-only timing/history report is now
   implemented; see [operator instructions and limitations](submission-activity-report.md).
   Model links expose latest and previous ZIP/message activity, outcomes and retained
   response evidence. Portal upload time, operator identities and response application
   import time remain unrecorded. Broader authenticated audit capture is future work.

Review this comparison screen and count interpretation with the owner before
expanding those reports. Model-specific Excel exports,
retained report history, PDF, direct RA access and controlled Production availability
remain separately agreed increments.

## Registration Evidence — retained-extract design (November 8)

**Registration Evidence remains a planned report.** The implemented comparison
now has the retained-set selector described above; the following evidence-report
design must reuse that boundary. Opening the evidence report should
select the latest suitable retained extract set for the active environment,
manufacturer and requested scope. Do not ask RA to supply a new extract before
viewing evidence already held. Both reports must rely on application data and
retained Data Import extracts; neither report accepts extract uploads.

### Default source selection

1. Discover retained export sets through existing batch/source manifests and
   retained evidence references. Check source availability and recorded hashes
   read-only. A workbook or derived accepted-state snapshot alone is not a complete
   original export set; do not recreate missing XML and present it as original.
2. Qualify each set by environment/manufacturer, supported schema, usable export
   timestamps, consistent export/session metadata where present, declared page
   coverage, unique identities and known scope. Never assemble a set from pages
   belonging to different exports just to achieve a complete page count.
3. Rank suitable complete sets by their recorded export dates, not folder names,
   modification times, upload/import dates or report-generation time. Display the
   full timestamp range for multi-page exports; retain the set identity/digest.
   Identical retained copies represent the same evidence, not a newer observation.
4. If conflicting sets cannot be ordered reliably, show the ambiguity and direct resolution through Data Import. Do not choose one
   arbitrarily or add a manual source override to Reporting. Scope
   compatibility must be established before asserting coverage of a requested model.
5. If a newer set is incomplete/unusable, the latest earlier suitable complete set
   may be used with a visible explanation of which newer evidence was excluded.
   Age alone does not invalidate a set; show its date without inventing an expiry
   threshold. Unknown filters limit coverage claims even where pages are complete.

The report header and Excel context should retain environment, manufacturer,
selected batch/set reference, source filenames/hashes, export timestamp range,
known filters/model scope, page completeness, selection reason and report time.
A short default message could say: "Using retained EUDAMED extract dated [date]."
Reporting has no extract upload or source-picker control. Any newer/corrected set
is supplied through Data Import. Historical source selection would require a
separately agreed report design.

### Model summary and exceptions

Use the same family/model names as EUDAMED Submission. Keep Basic UDI-DI parent
coverage distinct from child-device counts. Show model-level evidence first; device
identities and original evidence are available only through explicit drill-down.

| Measure | Meaning |
| --- | --- |
| Database device entries | Current application scope for the model |
| Evidenced in selected extract | Unique matched database identities with registration evidence in that dated set |
| Additional entries confirmed after extract | Not evidenced in the set, but supported by subsequent qualified successful registration evidence |
| Other local evidence requiring review | For example, older local registration evidence for an identity absent from the selected set |
| No registration evidence found in assessed sources | No matching extract or qualifying local evidence; not a declaration that the device is unregistered |
| Unable to assess reliably | Identity, source availability or scope is unresolved |

For an assessed model, assign each database entry once across those evidence
categories; keep extract-only identities outside the database-entry total. Later
successful updates for devices already evidenced in the extract are separate
activity counts, not additional registrations. Never add response-event counts to
unique-device counts to produce a registration total.

Group exceptions by reason and unique affected entries: absent from the selected
scope, later successful evidence, missing response/artifact, conflicting identity,
incomplete export coverage or local/export evidence disagreement. Missing original
outgoing XML does not prevent export-based registration evidence from being shown.
State explicitly whether a conclusion rests on an extract, a retained successful
response, or a recorded historical status whose original evidence is unavailable.

### Evidence after the extract date

Use existing qualified per-device registration evidence and response correlation
rules. Separate confirmed registration from failed, generated and pending activity.
A partially successful bulk response supports only the successful entities.

Compare successful activity dates against the relevant retained extract observation,
using usable timezone-bearing timestamps. Events falling within a multi-page set's
timestamp interval have uncertain ordering unless per-device/page timing resolves
it; flag them for review rather than calling them definitively subsequent.

A later successful PATCH can support continued registration evidence but must not
be described as a new initial registration. Market Info updates belong in later
activity and do not independently register a child device. Delayed response import
must not make an earlier acceptance appear newer; distinguish response time from
application import time. Missing/conflicting timestamps remain unresolved.

Absence from an older extract must not override later successful evidence or alter
operational registration state. The report does not merge later submitted values
into the original extract or claim live synchronization with EUDAMED.

### Missing sources and reproducibility

If no suitable retained set exists, show **Extract evidence unavailable** with the
reason and direction to correct the evidence through Data Import. Available local response/baseline evidence can
still be summarized separately with its provenance. Unassessed extract coverage is
not zero devices or zero exceptions. The report must distinguish missing original
files from incomplete pages, incompatible scope and unresolved source selection.

Excel should reproduce the selected evidence and dates, model counts and grouped
exceptions, with individual entries only on request. Retain source identifiers and
hashes so the selected observations can be traced. Report storage/versioning remains
separate planned work; do not imply that a download has been retained server-side.

Implementation must preserve existing SQLite, identity/accepted-state and workflow
rules. Read-only report generation must not import, migrate, accept, reconcile or
rewrite operational evidence. Selection tests should use synthetic retained sets
covering incomplete newer exports, duplicate copies, conflicting same-date exports,
unknown scope, missing files, later/partial successes and unresolved timestamps.
