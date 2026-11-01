# Import data in Dev

Restart the Dev backend and refresh the browser after updating the feature
branch. Open **Import Management → Import Data**. There is one ongoing import,
with one primary action at its current stage:

1. **Review source data** — select Template workbooks, the BasicUDI workbook and
   all EUDAMED XML export pages. Review the short result. Progress and source
   copies save automatically; wait for **Saved automatically** before closing.
2. **Create Import Workbook** — creates the dated batch and its workbook/audit
   from the reviewed copies. There is no separate Create Batch button.
3. **Import Batch Data** — shows the target Dev environment and new/retained
   counts. Check the importer details, tick confirmation and import. A verified
   backup is created automatically before the transaction.

**Download workbook** is an optional link. Downloading is never a prerequisite
for importing. No manual assessment, save-draft, resume or continue buttons are
needed. Returning in the same browser reopens the remembered import at its saved
stage. The single Import selector opens another saved import or starts a new one.

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

Only three overall messages are used:

- **Ready to continue**
- **Ready to continue — warnings found**
- **Source corrections required**

Small labelled pills mark the review: **green — Good data**, **amber — Warning**,
and **red — Showstopper**. The overall review and each finding category use the
same classification. Colour is supplemented by text labels.

Findings are consolidated into at most eight categories:

| Category | Outcome |
| --- | --- |
| Required files missing or unreadable | Block |
| Required structure or identifiers missing | Block |
| Duplicate Device UDI-DIs in Templates | Block |
| Device or catalogue identity requires clarification | Block |
| Wrong manufacturer or environment in XMLs | Block |
| Incomplete or conflicting XML export set | Block |
| Differences between source files | Warn |
| Missing optional information | Warn |

A repeated issuer-qualified Device UDI-DI within or across active Template
workbooks blocks progression even when its rows are identical. The category
counts repeated identities; expandable details retain the workbook, sheet and
row references. Required accepted-state metadata must be usable; it is not
fabricated to make an export importable.

Ordinary Template/export value differences, export-only devices, unknown dates
and missing optional fields are warnings. Warnings need no extra acknowledgement and do not block progression.
XML generation readiness remains a separate check. An unresolved catalogue address shared by different Device UDI-DIs is a
showstopper. It is reported once with all involved identities and source-row
references, even when detected in both selected files and the existing database.
Correct or clarify the source identities before continuing; there is no bypass
button for unresolved catalogue collisions.
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
