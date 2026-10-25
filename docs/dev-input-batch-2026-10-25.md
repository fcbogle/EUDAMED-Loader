# Dev input batch — 25 October 2026

## Established batch

The first batch is in the original project's data area, outside the development
worktree:

```text
data/dev/import-batches/2026-10-25-001/
├── templates/              Six original-named Template workbook copies
├── basic-udi/              BasicUDIs.xlsx copy
├── eudamed-xml/            Five original-named Playground export copies
├── prepared/              Empty; no Import Workbook generated yet
├── manifest.json           Source paths, modification times, sizes and SHA-256
└── source-assessment.json  Structural source-inspection results
```

All 12 input copies were checked byte-for-byte using SHA-256. Existing Dev inputs,
Production inputs and both databases retain their original paths. The new folder
does not yet change the application's configured input locations. No API/UI
processing actions were enabled and no database was opened by the batch utility.

The development `.gitignore` excludes Dev batch storage. The shared local
`.git/info/exclude` also excludes it in the original main checkout, whose tracked
configuration was not edited.

## Findings

| Scope | Template row occurrences | Distinct device identities | Parent-reference findings | Duplicate identity occurrences |
| --- | ---: | ---: | ---: | ---: |
| All six retained Template files | 8,773 | 8,771 | 349 | 2 |
| Current active scope: five files, excluding Accessories/Footspares | 8,424 | 8,424 | 0 | 0 |

The 349 missing-parent findings are all in the already-excluded
`Template for Accessories_Footspares EUDAMED.xlsx`: 271 Footspares rows and 78
Adaptors_Socket_Accessories rows. The two duplicated identities occur between
that excluded workbook and Epirus. Retaining this file preserves the original
input archive; it does not bring its records into active import scope.

The Basic UDI-DI reference contains 47 distinct parent identities. All five XML
pages parse and declare the expected Dev schema version 3.0.32 and manufacturer
`UK-MF-000033261`. There are 215 unique export devices; all are present in the
active Templates, with no export-only device. Exported devices overlap with the
Templates; the remainder are simply absent from this exported registered set,
not proven unregistered by this inspection.

These are the existing preparation readers' structural/identity findings, not
full canonical validation, XML readiness, import eligibility or a database diff.
The report's explicit workbook filter is inspection-only and does not alter the
application's existing exclusion policy. No model aliases or data values were
changed, and no parent/market/country overrides were invented.

## Repeatable utility

From the development worktree, creation of another batch is explicit and refuses
to replace an existing batch:

```bash
.venv/bin/python backend/scripts/manage_dev_input_batch.py create \
  --project-root /Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader \
  --xml-dir /Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/data/testing/playground-extracts/25-10-2026 \
  --batch-id YYYY-MM-DD-NNN
```

Use a real date/sequence in place of `YYYY-MM-DD-NNN`. Do not recreate the existing
batch. Inspection verifies its manifest and refuses modified, extra or missing
input files before reading source contents:

```bash
.venv/bin/python backend/scripts/manage_dev_input_batch.py inspect \
  /Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/data/dev/import-batches/2026-10-25-001 \
  --exclude-workbook 'Template for Accessories_Footspares EUDAMED.xlsx'
```

Inspection prints JSON without writing files. The retained assessment was saved
separately as `source-assessment.json` in this operational batch. Synthetic tests
exercise preserved copies, overwrite refusal, file-integrity failures, Production
source rejection, redirected storage, manufacturer mismatch and scope reporting.

## Integration and cleanup still to do

The current Dev importer also reads
`data/basic_udi_reference/uat-eudamed_mdr_products_tracekey_sample_data.xlsx` for
legacy reference/fallback information. It is not one of the three new input types
and was not silently added to the batch. Its dependency must be preserved or
explicitly replaced/retained before the old Basic UDI-DI folder can be retired.
Do not remove it now.

Next, review the batch assessment and connect the selected-batch/check/preparation
flow without replacing existing operational import behaviour prematurely. Review
any required mapping/validation or legacy-reference changes with the owner before
implementation. Snapshot/comparison integration follows the agreed plan. The
previously identified version exceptions remain investigation-only; no accepted
baseline or submission history was changed.

Only after end-to-end Dev verification and owner review should configuration move
to the new inputs and an exact obsolete-folder removal list be proposed.
Production adoption remains a later, separately agreed change. No cleanup was
performed by this step.
