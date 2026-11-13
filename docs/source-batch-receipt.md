# Import Data — Development and Production

Restart the backend for the intended environment and refresh the browser after
updating the application. Open **Import Management → Import Data** and confirm the environment banner. There is one ongoing import,
with one primary action at its current stage:

1. **Review source data** — select Template workbooks, the BasicUDI workbook and
   all EUDAMED XML export pages. Review the short result. Progress and source
   copies save automatically; wait for **Saved automatically** before closing.
2. **Create Import Workbook** — creates the dated batch and its workbook/audit
   from the reviewed copies. There is no separate Create Batch button.
3. **Import Batch Data** — shows the target environment and new/retained
   counts. Check the importer details, tick confirmation and import. A verified
   backup is created automatically before the transaction.

**Download workbook** is an optional link. Downloading is never a prerequisite
for importing. No manual assessment, save-draft, resume or continue buttons are
needed. Returning in the same browser reopens the remembered import at its saved
stage. The single Import selector opens another saved import or starts a new one.

After success, **Import Data** shows a compact receipt: import number/date,
importer and new/retained device totals, with **Start new import** and **View import
history** actions. The progress steps, source-review warnings and downloads are
removed from this completed view.

**Import Management → Import History** lists completed imports and retains their
receipt, original source-file names, source review, workbook and full findings
downloads as read-only audit evidence. Historical findings are labelled as the
review at import, not current cleanup tasks. Browsing history does not change
the remembered ongoing import. Use **Canonical Validation** for current database
data quality and XML readiness; successful import does not establish XML readiness.

## Production

The same three-stage workspace is available with the Production backend profile.
Its sources and history are separate from Playground: `EUDAMED_DATA_ROOT/import-batches`.
Production permits up to 500 source files and 256 MB total (20 MB per file),
so complete paged exports can be selected. Dev retains 100 files/60 MB total.
Production requires its configured manufacturer and schema **3.0.30**. Playground
XMLs, changed source manifests, redirected database/backup paths and stale reviews
are rejected. The existing Production database must already exist; the workflow
never creates a replacement database during source review.

Source review and workbook creation read the database without changing it. Step 3
names **Production**, requires importer attribution and an explicit Production
confirmation, creates an integrity-checked SQLite backup under the configured
Production backup directory, and applies an atomic additive import. Existing device
values, accepted state and submission history are retained. New registered-device
extract baselines are tagged `production_export`, never `playground_export`.

Import History also shows earlier Production workbook import receipts read-only.
When an earlier import has no managed source review or verified retained download,
the UI states that limitation rather than fabricating evidence. Browser selection
memory is separate for Production and Dev. Existing Production preparation/import
endpoints remain available for compatibility.

Enabling this workspace does not import anything. A live import is a separate
operator action and intentionally changes the Production database after confirmation.
The Production profile, database, schema and existing input files are not modified
by installing the UI/API support. Restart the backend to load `/api/input-batches`.

## Select source files

Files can come from different local folders. For the current Dev test set:

| Source | Original checkout location |
| --- | --- |
| Five family Template workbooks | `data/source_excel/`; omit Accessories/Footspares. |
| BasicUDI reference | `data/basic_udi_reference/BasicUDIs.xlsx` |
| Complete Playground XML page set | `data/testing/playground-extracts/30-10-2026/` |

Original checkout: `/Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/`.
Limits are 100 files, 20 MB per file and 60 MB combined. Originals are preserved.
Unknown source/export dates can stay blank. Contacts are user-supplied attribution,
not authenticated identity. Source-data contact/name/email controls were removed.
Existing workbook exclusions remain in effect and are identified beside saved
files; excluded files are retained evidence, outside the import scope.

## Review results

Overall review messages are:

- **Ready to continue**
- **Ready to continue — additional source information**
- **Ready to continue — warnings found**
- **Source corrections required**

Small labelled pills mark the review: **green — Good data / Information**, **amber — Warning**,
and **red — Showstopper**. The overall review and each finding category use the
same classification. Colour is supplemented by text labels.

Findings are grouped by the issue and the action needed:

| Category | Outcome |
| --- | --- |
| Required files missing or unreadable | Block |
| Required structure or identifiers missing | Block |
| Duplicate Device UDI-DIs in Templates | Block |
| Device or catalogue identity requires clarification | Block |
| Wrong manufacturer or environment in XMLs | Block |
| Incomplete or conflicting XML export set | Block |
| Unconfirmed market countries containing `?` | Block — confirm and correct the source |
| Additional source information verified against stored parent links | Information — no action required |
| Source correction already applied and verified against current stored projections | Information — no action required |
| Registered devices missing from supplied Templates | Warn — confirm intended source coverage |
| Differences between source files | Warn |
| Missing optional information | Warn |

A repeated issuer-qualified Device UDI-DI within or across active Template
workbooks blocks progression even when its rows are identical. The category
counts repeated identities; expandable details retain the workbook, sheet and
row references. Required accepted-state metadata must be usable; it is not
fabricated to make an export importable.

A newly explicit Basic UDI-DI in a Template is **Information** when it was absent
from the previous source and agrees with both the existing device parent link and
its canonical issuer-qualified parent identifier. The incoming parent/reference
must also agree. This is not a missing database relationship and requires no action.
The green information category groups unique affected devices by model. Individual
examples appear only when requested; the optional findings workbook retains all
before/after values, model context and information severity. Unverified additions,
changed values and conflicting identities keep their existing warning/blocking
classification. Information alone does not make the overall review amber.

A historical catalogue change is shown separately as **Source correction already
applied** only when its incoming value agrees with the existing device catalogue,
current source-row projection, canonical JSON/field and persisted catalogue field,
for the same issuer-qualified device and model. Historical before/after values
remain in the review and Excel; this label does not apply a correction or update
device data. Missing, inconsistent or ambiguous current evidence stays a warning
or showstopper rather than being shown green.

**Registered devices missing from supplied Templates** is a separate warning.
It shows the model, catalogue, Device UDI-DI and XML device position, and asks
whether the device should be included in the current Templates. Keep the extract
evidence; do not infer deletion or non-registration from a missing Template row.

The review need not anticipate every source-data error: Information requires a
specific verified match; warnings explain differences/coverage needing review;
showstoppers prevent unsafe import. Unrecognised or unverified cases are never
made green merely because another field matches.

Ordinary Template/export value differences, export-only devices, unknown dates
and missing optional fields are warnings. Warnings need no extra acknowledgement and do not block progression.
XML generation readiness remains a separate check. An unresolved catalogue address shared by different Device UDI-DIs is a
showstopper. It is reported once with all involved identities and source-row
references, even when detected in both selected files and the existing database.
Correct or clarify the source identities before continuing; there is no bypass
button for unresolved catalogue collisions.

Any `?` in a market-country value blocks a new import, whether found in a Template,
the BasicUDI reference or an EUDAMED extract. Confirm the intended country before
correcting the source; the application does not remove the marker or guess a country.
Already imported records remain stored, but questioned countries block XML generation
and appear as incomplete XML readiness. Completed import receipts and original source
evidence are preserved. Blank country lists remain a separate warning under this rule.
Pending approvals from an older review policy require a fresh source review.
Existing database canonical values and accepted histories are retained; differences
are recorded rather than silently overwriting those existing values.

Expand a category for up to ten examples. When there are more, an optional
**Download full source findings** link provides an Excel list of every occurrence,
with identifiers stored as literal text and formulas disabled. Full reports also
remain in the review history on disk.

## Correct files and return later

Correct the original files outside the application. In the source controls,
select only changed Template workbooks: the same filename replaces its saved
copy and other workbooks remain. The BasicUDI selection replaces the reference.
Selecting XML replacements replaces the entire XML page set. Uncheck a saved
file to exclude its old filename when renaming/replacing it. Review again.

After passing review, **Replace files** reopens the sources. Once a dated batch
exists, replacements start a new review from its copies, preserving that batch.
All prior revisions and findings remain available on disk. Corrections can take
days; drafts do not expire. Another window's changes cannot overwrite the current
revision silently.

Older batches and earlier saved reviews appear in the same Import selector.
Their retained input files are reused, but their earlier approvals do not bypass
the current duplicate/showstopper policy. Review them once under the new flow.
Older workbooks/audits remain evidence; a new reviewed import uses a workbook
created under the current preparation contract.

## Storage and scope

Saved working sources and findings remain under
`data/dev/import-batches/source-reviews/<review-id>/`. Each save retains a source
revision and each review retains its complete report. Completed source batches
remain under `data/dev/import-batches/YYYY-MM-DD-NNN/`, linked to their exact
review, source hashes, workbook and audit. Both are already Git-ignored in the
main checkout and feature worktree. No operational source directories are moved
or deleted, and no database paths change.

This implementation is Dev-only. Production rejects its endpoints; the main
checkout remains unchanged. A cloud deployment will need persistent storage and
authentication. Azure storage integration and EUDAMED M2M/upload are not included.
