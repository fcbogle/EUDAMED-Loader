# Import a reviewed Dev batch

Use [Import data in Dev](source-batch-receipt.md) for the current three-stage flow.
The only primary actions are Review source data, Create Import Workbook and
Import Batch Data. Downloads are optional.

Step 1 checks source showstoppers and the intended import. Warnings allow progress.
Step 2 creates the dated batch, associated workbook/audit and saved import summary.
Step 3 confirms the target Dev environment, operator attribution and the import.
A fresh assessment is an internal safety check; there is no assessment screen,
assessment selector or extra approval action.

## Retained database protections

Confirmation uses the existing Dev database at
`data/testing/testing-state.sqlite3`. It never creates/migrates a database or
initializes tables. It rejects Production, redirected Dev paths and a Dev file
that resolves to the Production database. No DELETE or backup pruning is used.

Before writing, confirmation checks the exact saved revision, source hashes,
workbook/audit association, current rules and logical database state against the
reviewed plan. A database/rule change requires source review again. Under
`BEGIN IMMEDIATE`, a verified pre-import backup is matched to that state before
atomic writes. Any failed precondition or write rolls back.

Eligible new exact identities are added. Existing device IDs, canonical values,
accepted histories, reviews and omitted existing devices remain intact. Source
values that differ from an existing identity are reported as warnings and retained
in the source/workbook evidence; this additive import does not silently update
that identity's canonical values. Unresolved catalogue collisions block batch creation and database import until
the source identities are corrected or clarified. Missing optional source values are not
invented. Production's stricter reviewed-workbook admission remains unchanged.

Only genuinely new registered identities receive imported Playground baseline
events, marked `IMPORTED`, never fabricated `SUCCESS` submissions. Registration
baseline reconciliation is a separate controlled operation, not an automatic side
effect of this source import.

Import results and backup references are stored with the transaction in database
history. Reopening the import restores completion and its original workbook;
confirming the same artifact again is a no-op. Application operational views
refresh after a successful import.

## Removed and retained interfaces

The earlier browser receipt, inspect, prepare, package/audit download, correction
summary, manual assessment, confirm-import, resume and source-review endpoints
were replaced by the `/api/dev-input-batches/sessions` workflow API. There is no
alternate browser route that bypasses source review. Internal immutable receipt,
source analysis and preparation services remain because the current flow uses
them, not as parallel operator workflows.

The separately used read-only Playground baseline-assessment API is retained
with its existing tests. It does not import or reconcile database state and is
not displayed as an extra action in Import Data.
