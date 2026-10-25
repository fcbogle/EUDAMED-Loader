# Testing Dev batch checks and workbook creation

This increment connects Import Management to existing verified Dev batches. It
does not upload new browser files, assess the workbook against SQLite, import
records, apply reconciled versions or enable Reporting generation. A separate
read-only Playground baseline comparison is now available in Step 3.

An earlier backend test-cleanup incident cleared legacy Dev POST-review entries;
see `docs/dev-test-isolation-incident-2026-10-25.md`. Production is unchanged. No
older backup has been restored. The owner has no newer backup; markers will need
fresh review rather than historical reconstruction. A post-incident safety backup
now protects the remaining Dev state, and the final guarded full suite caused no
further database changes.
The file-only workflow below is independent of those markers; do not interpret
its successful tests as proof that all historical review evidence is intact.

## Start the correct application

Use the development worktree on `feature/import-management-reporting`. Stop any
Production backend/frontend first; run one environment at a time. Follow
`docs/development-and-production.md` to clear inherited EUDAMED overrides.

Restart the Dev backend from the development worktree's `backend/` directory:

```bash
../.venv/bin/python -m app.run --environment dev --env-file .env.dev --check-config
```

Confirm schema 3.0.32, the existing Playground database and the new batch setting:

```text
Database: /Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/data/testing/testing-state.sqlite3
Dev input batches: /Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/data/dev/import-batches
```

The check starts no services or databases. Then start Dev normally:

```bash
../.venv/bin/python -m app.run --environment dev --env-file .env.dev --port 8000 --reload
```

Start/retain the development frontend in its own terminal:

```bash
cd /Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/.worktrees/development/frontend
npm run dev -- --port 5173 --strictPort
```

Open a fresh browser tab at `http://localhost:5173` and confirm Dev / Playground.
The local ignored `.env.dev` now explicitly sets `EUDAMED_DEV_INPUT_BATCH_ROOT`;
no existing input, database or Production profile setting was changed.

## 1. Import Source Files — select the copied batch

Open Import Management → **1. Import Source Files** and select
`2026-10-25-001`. Inspect the three groups: six Template copies, one Basic UDI-DI
reference and five XML exports. The Accessories/Footspares workbook is explicitly
marked as retained evidence excluded from preparation, preserving current policy.

The page reports verified file fingerprints and source modification dates. These
are existing server-side batch copies, not successful browser uploads. New file
upload/storage is not part of this increment. Invalid or changed batch files show
an error rather than silently proceeding.

## 2. Create Import Workbook — check, prepare, download

Continue to **2. Create Import Workbook**, then select **Check source data**.
Expected values for this fixed batch are:

| Check | Expected |
| --- | ---: |
| Active Template devices | 8,424 |
| Exported devices | 215 |
| Active source findings | 0 |
| Duplicate occurrences | 0 |
| Active identities in exports | 215 |
| Export-only identities | 0 |

The excluded workbook has 349 retained missing-parent findings and is involved
in two duplicate occurrences; these are outside the active preparation scope.
Source checks are structural checks, not a database assessment or XML-readiness
certification. Any manufacturer/schema/file-integrity problem blocks processing.

After checks complete, select **Create Import Workbook**. Expected preparation
totals for this batch are 8,209 To Register rows, 215 Registered rows and zero
review-required rows under the existing preparation checks. Review the actual
workbook before drawing regulatory conclusions.

**To Register is a preparation grouping, not proof of non-registration.** Devices
absent from these exports are labelled **Not evidenced by supplied exports** in
the Dev workbook. No baseline or current registration state in SQLite is changed.

Select **Download workbook + audit** to obtain the linked pair as a ZIP. Individual
workbook/audit downloads are also available. The audit is detailed (about 91 MB
uncompressed for this batch); the paired ZIP is much smaller (about 2.6 MB).

Open the Excel workbook and check:

- To Register, Registered and Summary worksheets are present.
- Identifiers retain leading zeros and text formatting.
- Proposed Template values and accepted export values remain separate.
- Registered rows retain exported versions and countries.
- The Summary worksheet identifies any exceptions and remaining verification.

Each preparation creates an immutable workbook/audit pair under
`prepared/<preparation-id>/` within the batch, with file hashes, input manifest,
exclusion scope and preparation evidence. Downloads verify that the pair matches.
An earlier preparation-format artifact is not served as a current-format output;
create a fresh workbook if that message appears.

Refresh batches or a browser reload clears the current selection/check result,
not the retained files. Select and check again before generating another pair.
Choosing a different batch clears previous checks/output, and delayed responses
cannot attach the old result to a new selection. Repeat preparation retains the
earlier generated files; no originals are overwritten.

## 3. Assess & Import Workbook — baseline comparison and file review

Select **Assess Playground baseline** to compare the selected batch's exported
accepted state with Dev. It works independently of workbook creation. The
results lead with a known-value differences table showing local and Playground
values side by side. Evidence completeness (including the missing-field count)
and the full device comparison are expandable; version/identity concerns are
signposted separately. The comparison opens SQLite read-only and saves Excel/audit reports under
`reconciliation/<report-id>/` in the batch. It does not import a workbook or apply
a baseline update. Expand device rows to see accepted/exported values, missing
evidence and review notes. Use **Download assessment Excel** or **Download
assessment audit** to retain the complete report.

The owner-approved baseline update has now been applied separately from this
file-preparation workflow. For this fixed batch, expect 215 devices, 10 parents,
zero value differences, 215 full accepted device snapshots and zero missing local
fields within the supported comparison. The earlier 23 differences and incomplete
snapshots are preserved in the historical assessment/audit. See
`dev-playground-baseline-applied-2026-10-25.md` for testing after reconciliation.
Unknown fields are not proven changed values. Read
`playground-baseline-assessment-2026-10-25.md` before approving further work;
legacy version and identity concerns need explicit review. Cleared POST-review
markers are reported separately and are not recreated by exports.

The page also shows the prepared workbook filename, but **Assess import** and
**Confirm database import** remain disabled. Do not use the existing Submission
Data import action as part of this file-preparation test; that is a separate
database-writing workflow. Reporting remains a synthetic UI preview.

Record any layout, wording, workbook or download issues for review. No source
folder cleanup, input switch, accepted-baseline update or Production migration
is part of this test.
