# Dev accepted-state reconciliation — proposal for owner review

No database changes have been applied by this proposal. The owner wants the
application to mirror Playground's actual recorded state, including changes made
outside the application, after investigation and review.

## Evidence and boundaries

Use the five retained October 25 exports for manufacturer `UK-MF-000033261`,
covering 215 distinct devices under 10 represented parents. Export timestamps span
09:24:05–09:25:35 with the files' recorded +01:00 offset. The latest dated local
successful outcome is October 5; a read-only check found no dated local success
newer than the earliest export. This cannot rule out later external Playground
changes or undated evidence; confirm freshness before applying a baseline.

Only the existing Dev database is in scope. Production, source Templates, proposed
unsent values, original response evidence and both configured database paths remain
unchanged. Identities must match by issuing entity and UDI-DI, preserving the
qualified parent link. One legacy Esprit testing subject currently lacks a direct
device-subject link; resolution must remain explicit and must not create a
duplicate device. Export absence establishes no new registration conclusion.

## Proposed reconciliation contract

1. Produce a field-level before/after report for the 215 current accepted device
   states: parent identity/version, device identity/version and exported details,
   Market Information version/countries and original-placement flags. Identify
   incomplete local snapshots and true conflicts separately.
2. After owner review, record a dated **Playground export baseline**, including
   source XML hashes, export date, manufacturer, scope and the approved change set.
   This is current-state evidence, not a fabricated POST/PATCH/Market Info success.
3. Preserve all recorded submission events and historical version observations.
   Do not overwrite a proven later accepted state with an older export. The
   ambiguous EliteVT generic summary requires explicit treatment rather than an
   automatic downgrade or indiscriminate maximum-version rule.
4. Update the operational accepted-state read paths so POST/PATCH/Market Info
   eligibility and next versions use the reviewed current evidence consistently.
   The existing baseline predicates are Production-specific; do not mislabel
   Playground evidence as a Production export to bypass them.
5. Apply an approved change atomically to the existing Dev database, with a verified
   pre-change backup and rollback on failure. Reapplying the same evidence must be
   idempotent. Successful submission counts must not increase merely because a
   baseline was imported. Verify registration views, generation eligibility and
   Reporting against the same reconciled state.

## Known version findings to include in review

| Record | Existing local evidence | Export evidence | Proposed review |
| --- | --- | --- | --- |
| EVT22L11S | Generic latest device version 2 without explicit POST/PATCH version; Market Info 1 | Device 1; Market Info 2 | Resolve generic-version ambiguity; establish current export-backed state without altering historical submissions |
| EVT22L53S | Device 2; Market Info 1 | Device 2; Market Info 2 | Establish Market Info 2 from the export; country sets already agree |
| EB22L1S | Successful POST recorded without device version | Device 1 | Establish current version 1 without inventing a historical response |

The other 162 records lacking a dedicated locally successful Market Info version
can receive current exported Market Info evidence without asserting that a local
Market Info submission occurred. Existing comparisons found 213 matching device
versions and 51 matching dedicated Market Info versions; all 53 available local
Market Info country snapshots match. This is not yet the full field-level report.

## Separate issue: cleared review markers

The test-cleanup incident cleared legacy POST-review entries. A portal export
does not establish that an operator reviewed a payload, so reconciliation must
not silently recreate those approvals. The owner has no newer backup. Preserve
the incident record and establish necessary review markers through fresh review
as a separately visible action. Current accepted registration evidence and
submission history must not be reset to an old backup to recover those markers.

## Approval and next work

Agree this reconciliation contract with the owner before implementing new
accepted-state/message-lineage handling, as required by `AGENTS.md`. Then implement
the read-only field-level assessment first. Do not apply database changes until
the owner has reviewed the concrete proposed updates. The current file-only
preparation workflow remains available independently.

## Owner approval and assessment delivery

The owner agreed this direction. The read-only assessment stage is implemented
and its concrete findings are recorded in
`playground-baseline-assessment-2026-10-25.md`. Baseline application and changes to
accepted-state/message-lineage readers have not been implemented. Owner review
of that report precedes the next database-writing stage.

## Subsequent approved application

After reviewing differences and the Linx/EliteVT historical findings, the owner
instructed alignment of Dev with the retained extracts followed by testing and
review of fresh exports. The controlled application completed; see
`dev-playground-baseline-applied-2026-10-25.md`. Earlier read-only status in this
proposal records the sequence of approvals; it is superseded by that delivery.
Production remains excluded, and historical review approvals were not recreated.
