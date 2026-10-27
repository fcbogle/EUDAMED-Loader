# Dev device registration coverage — 25 October 2026

The owner confirmed complete manufacturer device-extract coverage and clarified
**“Device extracts only.”** This applies to Dev manufacturer `UK-MF-000033261`
and the already reconciled batch `2026-10-25-001`. Device extracts cannot establish
absence of Basic UDI-DI parents registered without children.

## Current operator behavior — subsequent owner clarification

The owner subsequently defined Unregistered by workbook membership, superseding
coverage-gated labels for both child devices and Basic UDI parents:

- **Registered**: registration evidence recorded for the active EUDAMED environment.
- **Unregistered**: identifier present in imported Template or BasicUDI workbook
  data, absent from recorded EUDAMED evidence.
- **Unknown**: identifier absent from all those sources.

Identity/data-quality checks control XML eligibility separately. A workbook
identifier with an issue is Unregistered with blocked actions, rather than Unknown.
The summary covers the current canonical import and its mapped BasicUDI parents;
unmapped or unresolved source rows remain separately reported as import exceptions.
The labels do not claim a live EUDAMED query or complete parent-only export coverage.

Read-only verification now finds **215 Registered, 8,208 Unregistered and 0 Unknown**
devices. Echelon `EC27LN7S`, GS1 `05050649030901`, is Unregistered with its existing
identity blocker. Of the Unregistered devices, 8,207 are POST-ready and one is
blocked; 5,285 can use child UDI-DI POST. Parents are **10 Registered and 4
Unregistered**, with zero Unknown. Historical success counts remain DEVICE.POST 10,
UDI_DI.POST 205, UDI_DI.PATCH 137 and MARKET_INFO.PUT 65.

The earlier confirmation below remains dated device-only provenance. Current
Unregistered labels do not require that confirmation. No new database writes
were made to implement the revised source-membership definition.

## Persistence and integrity evidence

One attributed confirmation was added to `registration_scope_confirmation` in
the existing Dev database. All 14 pre-existing tables retained exactly the same
row counts and logical checksums. Accepted snapshots, source data, historical
events and review markers were not rewritten. This does not restore approvals
lost in the earlier test-cleanup incident.

The confirmation is tied to environment, configured manufacturer, database path
and retained baseline evidence ID:
`0263bef9cf09189521ebbe82d0680da1c039da0bf76bd5dc2ff31aacf1ae0548`.
A different later imported export set invalidates the old coverage inference
until it receives a fresh confirmation. Positive later success evidence takes
precedence. Readers do not create tables or save confirmations.

Before the metadata write, a consistent backup passed SQLite integrity checks:
`data/testing/backups/testing-state-before-playground-baseline-9dd3a07c237340c6a9f86635e1a6fdb3.sqlite3`
(SHA-256 `cc69a6167a2917ed3dbe78d5bbf04ccddb6050b01c26c06062c0519c00f36ccb`).
The filename uses the existing baseline backup helper; this operation added
scope metadata only.

The detailed audit with all pre-existing table checksums is retained locally:
`data/dev/import-batches/2026-10-25-001/reconciliation/device-coverage-confirmation-73796a3c805240a8877fff5f7e1e19ff.json`.
Production's database fingerprint is unchanged. No Production confirmation was
recorded. Main remains clean; code changes are on the feature worktree.

## Verification and review

The revised source-membership rules passed 344 backend tests in 234.94 seconds
(`pytest backend/tests`) and 40 focused registration tests. All 123 frontend tests
and the TypeScript/Vite build passed. Read-only Dev checks
verify the child pill values, parent counts and accepted baseline, and validate
all four Echelon POST previews against XSD without changing the database hash.

Restart Dev and refresh its frontend. In Registration State, open Parents &
Children and review both registered and unregistered children. Browser acceptance
remains with the owner. Production requires a separately reviewed release and
uses its own source workbooks and EUDAMED evidence.
