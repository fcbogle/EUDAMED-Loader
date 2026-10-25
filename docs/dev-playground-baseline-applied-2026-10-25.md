# Dev Playground baseline applied — October 25, 2026

The owner authorised aligning Dev with the retained XML extracts, followed by
controlled Playground testing and comparison with fresh extracts. The approved
operation completed against the existing Dev database. Production is unchanged.

## Result

- 215 existing device identities under 10 exported parents reconciled.
- Fresh assessment: **215 Matches; 8,600 matching fields; zero differences and
  zero missing local evidence within the existing supported comparison**.
- 215 usable full accepted snapshots, preserving original export trees/provenance.
- 215 `PLAYGROUND_EXPORT.SNAPSHOT` / `IMPORTED` / `BASELINE_IMPORT` audit events
  added. None are labelled Production evidence or successful submissions.
- Historical events, actual success totals, canonical/source data, review records,
  generated package records and existing testing batches are unchanged.
- One uniquely resolved legacy Esprit testing subject was linked to its existing
  canonical device identity; the prior null link is retained in the audit.
- Current exported device/Market Info versions now drive accepted-state reads and
  subsequent generation. EVT22L11S uses exported device 1 / Market Info 2; its
  prior ambiguous generic version 2 remains in historical pre-change evidence.
- Historical dedicated POST/PATCH columns and events are retained. Existing generic
  device/Market Info caches now hold explicitly labelled export-backed current
  state, following the application's existing imported-baseline cache pattern.
- Cleared POST-review markers have not been restored or fabricated. Current count
  remains zero; current-state evidence and operator review are separate concepts.

No workbook import, source-path switch, Template edit, folder cleanup, EUDAMED
submission, M2M operation or Production migration was performed.

## Backup, audit and retained assessment

Run ID: `a3de0e74d85e4108aa1b8f234b18f015`.
Evidence ID: `0263bef9cf09189521ebbe82d0680da1c039da0bf76bd5dc2ff31aacf1ae0548`.
The SQLite backup completed and passed integrity checking before any row updates.
All device updates and baseline events were committed in one transaction. Failure
before commit rolls back every update. Reapplying the identical export evidence
returns already-applied without adding events or rolling back later test outcomes.

Paths below are relative to the original project root:

```text
data/testing/backups/
  testing-state-before-playground-baseline-a3de0e74d85e4108aa1b8f234b18f015.sqlite3

data/dev/import-batches/2026-10-25-001/reconciliation/
  baseline-a3de0e74d85e4108aa1b8f234b18f015.json
  baseline-a3de0e74d85e4108aa1b8f234b18f015-verification.json
  105c7a775963404e98079d7be4204e9c/
    playground-baseline-assessment.xlsx
    playground-baseline-assessment.json
    metadata.json
```

Backup SHA-256:
`09a56c629d527a444e9d2a25cc1da54ac16af5b151bf86cd2eba5d6e3505df41`.
The audit retains owner instruction attribution, the assessed change set, export
hashes, prior complete testing-subject values and the uniquely resolved identity
link. Original September events and the earlier investigation reports remain
historical evidence; their unexplained discrepancies have not been rewritten.

The Dev SHA-256 intentionally changed from
`61bd5d1b5b66d6d34051a8859f869ecfbf6d65b3a69d80905e05105bf1e9dac5` to
`1337ab2ef5c550553bcb33dc51bc1d97b94fb0b56956c226d10e072751a2ec2e`.
Production remains
`a0bcceb1d46bd5efd85217b3ccfc5347d9bc1120764e6557e35e37e2cf048f62`.
Hashes describe these dated checks, not future runtime state.

## Verification

The full Python run passed 326 tests in 237.81 seconds. After the final additional
checks and registration-reader compatibility change, 57 focused tests passed,
covering all seven importer tests, registration summaries and existing Production
import behavior. Tests cover atomic rollback, backup failure, stale proposals,
Dev target restrictions, idempotency, ambiguous legacy versions, explicit identity
linking, historical-event preservation and subsequent PATCH/Market Info advances.
The two existing FastAPI startup deprecation warnings remain.

Post-commit verification compared checksums of all 12 protected application tables
and all 1,284 prior event rows with the pre-change ledger. Every checksum matched.
Only the six approved current-state/link columns changed in selected testing
subjects; other subjects and fields were unchanged. The event count is now 1,499.
Actual SUCCESS totals remain:

| Operation | Success events |
| --- | ---: |
| DEVICE.POST | 10 |
| UDI_DI.POST | 205 |
| UDI_DI.PATCH | 137 |
| MARKET_INFO.PUT | 65 |

Runtime services were checked with every database connection forced read-only
and constructor migrations disabled. Registration summary shows 215 registered
devices, 10 registered parents, 215 PATCH-ready and 215 Market Info-ready devices.
A LINX22L5SD version-5 no-change-name preview used accepted version 4, retained
quantity 1 and passed local XSD validation. No generation, review or submission
was recorded. Its database fingerprint remained unchanged by verification.
This is local validation, not proof of future Playground acceptance.

## Owner test sequence

1. Restart the Dev backend and refresh the development frontend. Confirm schema
   3.0.32 and the existing `data/testing/testing-state.sqlite3` path. Use one
   environment at a time; do not start Production for this test.
2. Select Dev batch `2026-10-25-001`, open **Assess & Import Workbook**, then choose
   **Assess Playground baseline**. Expect 215 matches, zero value differences and
   zero missing local fields within the supported comparison. Download the report.
3. Inspect LINX22L5SD: accepted device version 4, quantity 1, Market Info 2. Inspect
   the EliteVT repeated trade names and EVT22L11S's device 1 / Market Info 2.
4. Start with one device and an explicitly reviewed intended change or unchanged
   PATCH. Inspect the complete downloaded XML, including retained quantity,
   trade name, countries and next version, before manually submitting it.
5. Retain the exact outgoing XML/ZIP, its acknowledgement and the new export set.
   Record these as a new evidence batch; preserve the October 25 files unchanged.
6. Compare the fresh Playground extracts with the newly accepted local state.
   Expand to a small batch only after the single-device result is understood.

The canonical/source projection was deliberately retained: its 8,423 device
identities differ from the 8,424 in file-only workbook preparation. That existing
scope distinction is separate from accepted-state reconciliation. Devices absent
from these exports remain unknown; no new non-registration or deletion conclusion
was applied. Browser workbook import and Reporting generation remain separate work.

## Scope and recovery

The importer is Dev-only and refuses a target other than the existing configured
`data/testing/testing-state.sqlite3`. It binds application to an assessed database
and verified export batch, rejects newer/conflicting known evidence and stores
original current-cache values before updating them. It never creates a new
operational database or performs schema migrations.

The controlled CLI is `backend/scripts/reconcile_playground_baseline.py`:

```bash
.venv/bin/python backend/scripts/reconcile_playground_baseline.py 2026-10-25-001
```

This only assesses and reports already-applied status. Applying a new evidence set
requires its reviewed digest and explicit approval attribution. It is not an
operator shortcut to apply old evidence over new test results.

The verified pre-change backup is available for recovery, but has not been
restored. Any restoration needs a separate decision after stopping Dev, preserving
the current file and accounting for subsequent test outcomes. Do not overwrite
current state automatically or restore the stale September backup.

Before Production work, establish a separately reviewed process with exact payload
retention, complete evidence, backup/recovery and preview safeguards. The current
Dev reconciliation does not authorise a Production baseline change.
