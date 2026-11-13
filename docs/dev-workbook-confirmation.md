# Import a reviewed batch

Use [Import Data](source-batch-receipt.md) for the current three-stage flow in Dev or Production. Confirm the active environment before importing.
The only primary actions are Review source data, Create Import Workbook and
Import Batch Data. Downloads are optional.

Step 1 checks source showstoppers and the intended import. Warnings allow progress.
Market-country values containing `?` are showstoppers: confirm and correct the
source before continuing. They also block XML generation for existing imported
records, without deleting records or rewriting their original source evidence.
Blank country lists remain a separate warning. Completed imports retain their
receipts; pending approvals under older policies must be reviewed again.
Step 2 creates the dated batch, associated workbook/audit and saved import summary.
Step 3 confirms the target environment, operator attribution and the import.
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

## Verified source additions — November 12

The source review presents a newly explicit Basic UDI-DI as green Information only
when the previous source omitted it and the incoming parent agrees with the existing
device link, canonical parent identifier and issuer. This does not update existing
values or relax an identity blocker. Other fields/differences remain warnings until
a specific verification rule exists. Model summaries count distinct issuer-qualified
device identities; raw before/after values remain in the retained review and Excel.
The underlying assessment keeps the complete differences for audit. Existing import
confirmation, database-state checks and accepted-history protection are unchanged.


Verified historical catalogue corrections have their own green information group.
The incoming value must agree with all current catalogue projections for the same
issuer-qualified device and model; identity/catalogue ambiguity suppresses this
classification. Missing/corrupt current field evidence remains unverified. Registered
extract-only devices remain an amber coverage warning with a specific check for the
source owner. These are review classifications, not data updates or import bypasses.
