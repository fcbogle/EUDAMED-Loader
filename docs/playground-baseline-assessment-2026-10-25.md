# Playground baseline assessment — October 25, 2026

The approved first stage is implemented: **read-only comparison**, with Excel and
JSON audit downloads in Dev. No accepted baseline or review approval has been
written. Bringing Dev into line with these exports remains a subsequent reviewed
change, not an outcome already achieved by this assessment.

## Evidence and output

Batch `2026-10-25-001` contains five manufacturer exports for
`UK-MF-000033261`, covering 215 distinct devices and 10 parents. The report uses
the exports' recorded timestamps and hashes. Both operational databases retained
their file hash, size and modification time across assessment/report generation.
Dev's hash still matches the post-incident state documented in the incident report;
this does not reverse the earlier loss of POST-review markers.

Retained report ID: `a7fc68d15dd447f9b113cf807fa6e841`.
Files are local and ignored by Git, under the original project's:

```text
data/dev/import-batches/2026-10-25-001/reconciliation/
  a7fc68d15dd447f9b113cf807fa6e841/
    playground-baseline-assessment.xlsx
    playground-baseline-assessment.json
    metadata.json
```

Excel contains Summary, Device Review, Field Review and Export Evidence sheets.
JSON additionally retains the proposed exported snapshots and raw export trees.
The evidence digest inside the report describes compared evidence, not a hash of
the entire database. Downloads verify the retained report's file hash.

## Findings

| Comparison | Count |
| --- | ---: |
| Devices compared | 215 |
| Full usable local device snapshots | 25 |
| Partial usable local device snapshots | 100 |
| Missing/unusable local device snapshots | 90 |
| Matching projected fields | 1,917 |
| Missing local field evidence | 6,660 |
| Differences in known field values | 23 |

The 23 differences affect 23 devices:

- Ten base quantities: local accepted partial evidence says 2; exports say 1.
  Nine are Linx records and one is ElanIC (`EL22-24-1KIT-S`).
- Ten EliteVT trade names: exports use `ELITEVT EXT. FOOT PROSTHESIS 22L-1-1 UPDATED`;
  local accepted partial snapshots contain individual device names.
- Two Market Info versions: `EVT22L53S` and `EVT22L11S` have local version 1 and
  exported version 2. Their available country snapshots agree.
- One warning comment: `EVAC22L1S` has local `Refer to instruction for use`;
  the export retains warning code `CW010` without a comment.

Missing evidence is explicitly unknown, not a proven difference and not filled
from proposed Templates. All 215 parent versions lack explicit local accepted
parent-version evidence. Qualified POST/PATCH device versions match for 124
records; 91 have insufficient qualified evidence. This stricter classification
must not be confused with the earlier comparison using generic summary versions.
Market versions match for 110 records, differ for two and lack usable evidence
for 103. All 112 available accepted country snapshots match, including original
placement flags; the other 103 lack usable country evidence.

There are 124 **Update proposed** records and 91 **Review required** records.
Both groups still require owner approval before an update can be implemented.
The review group includes 89 unqualified generic version-1 observations, the
ambiguous EliteVT generic version-2 observation, and the uniquely resolved but
unlinked legacy Esprit testing subject. The report proposes no silent version
downgrade or relational relink. It does not create missing success responses.

## How to review

Restart the Dev backend and frontend as described in
`dev-workbook-preparation-testing.md`. In Import Management, select batch
`2026-10-25-001`, open **3. Assess & Import Workbook**, and choose
**Assess Playground baseline**. This does not require creating another workbook.
Download the Excel and audit and inspect device notes and before/after fields.

This is a comparison of the existing supported accepted projection, not proof of
full raw-XML equality or complete XSD validation. Dated exports cannot establish
later external Playground changes. Export absence makes no registration or
deletion proposal for devices outside the 215-device scope. Reporting generation,
workbook database import and baseline application remain unavailable.

After owner review, implement the agreed dated Playground baseline evidence and
consistent accepted-state read paths as a separate change. Apply only through a
controlled, backed-up, atomic and idempotent Dev operation. Preserve submission
history and proposed edits. Cleared operator review markers require fresh review;
exports cannot recreate historical approvals. Production remains outside scope.

## Verification

The full backend run passed 310 tests in 232.77 seconds. All 16 affected backend
tests passed after the final guards were added, including the eight reconciliation
tests; nine repository utility tests passed separately. All 321 current Python
tests are covered by those runs. The 116 frontend tests and build passed. Existing
FastAPI deprecation and frontend bundle-size warnings remain. Final Dev and
Production database hashes, sizes and modification times match their values
before assessment; all 12 source/copy fingerprints match the manifest. Browser
acceptance by the owner is still outstanding.

## Follow-up: repeated EliteVT trade names

The owner suggested a Bulk PATCH explanation. Read-only history checks found that
all ten trade-name differences correspond exactly to the ten devices in the
successful August 14, 2026 Bulk PATCH wave documented in
`eudamed-playground-test-report.md`, section BT4. They share transaction
`90bffe49-e7b6-41e8-aee4-3ce65a521b84`, submission
`1c38d59a-b949-41a2-96aa-6cbb238236d0`, recorded response timestamp
`2026-08-14T18:50:17.404+02:00`, and device version 2. Event IDs are
17, 19, 21, 23, 25, 27, 29, 31, 33 and 35.

This confirms a common recorded successful bulk transaction and supports the
owner's explanation. It does not prove which outgoing names that transaction
contained: the legacy scenario is labelled `equivalent_first_patch`, and its
records have no retained raw XML, generated context, accepted after-state or
trade-name delta. The local generic snapshots retain individual device names;
the October exports show the repeated UPDATED name. Do not classify the names as
confirmed intentional trade-name edits solely from this association. Exact
payload contents and the time/cause of the name change remain unverified. No
baseline, review approval, submission record or generation code was changed.
