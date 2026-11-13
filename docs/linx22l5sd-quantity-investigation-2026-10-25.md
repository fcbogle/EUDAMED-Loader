# LINX22L5SD quantity investigation — October 25, 2026

Read-only investigation requested by the owner. No baseline, device state,
review approval, submission history or generation code has been changed.

## Identity and comparison

- Catalogue: `LINX22L5SD`; issuer: `GS1`; UDI-DI: `05050649085604`.
- Basic UDI-DI: `5050649LINX2G`.
- Dev testing subject: `128`; linked device subject: `8031`.
- Current local accepted snapshot: device version `4`, Market Info version `2`,
  base quantity `2`.
- October export `APP-DTX-000119312.xml`, page 1, device index 40: device version
  `4`, parent version `1`, Market Info version `2`, base quantity `1`.
- Export creation timestamp: `2026-10-25T09:24:43.533+01:00`.
- Trade name agrees: `LINX 22L CAT1-EXT. LEG PROSTHESIS New Updated`.

The shared device version matters: this is a field-value disagreement at version
4, not an observed version gap. Its cause is not established by the comparison.

## Retained local history

There are 20 device events: five SUCCESS, one ERROR and 14 GENERATED. Generated
drafts do not independently establish that a payload was submitted or accepted.

| Event | Recorded acknowledgement time | Operation | Retained context |
| --- | --- | --- | --- |
| 272 | 2026-08-30T15:56:37.648+02:00 | UDI_DI.POST SUCCESS | No response device version recorded |
| 296 | 2026-08-30T16:05:33.540+02:00 | UDI_DI.PATCH SUCCESS | Version 2; trade-name edit; local context quantity 1 |
| 385 | 2026-09-01T08:09:14.638+02:00 | UDI_DI.PATCH SUCCESS | Version 3; local context changes quantity 1 to 2 |
| 524 | 2026-09-01T09:41:10.016+02:00 | UDI_DI.PATCH ERROR | Failed version-4 attempt; not accepted-state evidence |
| 648 | 2026-09-01T10:30:32.408+02:00 | MARKET_INFO.PUT SUCCESS | Market Info version 2 |
| 775 | 2026-09-01T12:47:40.146+02:00 | UDI_DI.PATCH SUCCESS | Version 4; trade-name edit; local context retains quantity 2 |

Version-3 generation event 384 matches acknowledgement event 385 by correlation
`bf691036-5009-4207-951b-5f31bcb83139`. Response file:
`APP-DTX-000111607.xml`.

Version-4 generation event 747 matches acknowledgement event 775 by correlation
`89cd1d64-fbc3-47bd-89c9-144946e745e8`. Response file:
`APP-DTX-000111684.xml`.

Both retained acknowledgements contain SUCCESS for this exact UDI-DI. Neither
contains a baseQuantity element. The local values/version context must not be
presented as field values echoed independently by those acknowledgements.

## Evidence predating Import Management

Read-only inspection of
`data/testing/backups/testing-state-batch-4-20260903T073439Z.sqlite3` found this
subject's version-4 snapshot already containing quantity `2` and the matching
trade name. This independently corroborates that the local quantity value was
present in retained September state, before the October Import Management work.
The backup was not restored or modified. This finding is specific to this value;
it does not resolve other discrepancies or recover cleared review approvals.

## Outgoing payload search and limits

The project files/history and available Downloads, Documents and Desktop locations
were checked for the relevant Linx payloads. The database stores package names,
manifests, sizes and hashes, not the actual outgoing ZIP/XML bytes. No relevant
outgoing XML was found. The owner confirmed the ZIPs are no longer available.

Relevant retained package records:

| Package ID | Created at UTC | Filename | SHA-256 |
| --- | --- | --- | --- |
| 1 | 2026-09-01T06:07:18.694+00:00 | navigator-javelin-linx-linx-bulk-patch-base-quantity-edit-package.zip | 6b07d026a3f13bbb149f3c3f531dbdb7a9ea3982de535812288ac8cd09beacec |
| 6 | 2026-09-01T10:43:08.434+00:00 | navigator-javelin-linx-linx-bulk-patch-trade-name-edit-package.zip | a60a7417c7c8caf0ff2df094defc028c97e1f200f346511a786cdc06ea32c2f7 |

The trade-name filename was reused for earlier generations, including an attempt
that received an error. A recovered file must be checked by hash and correlation,
not accepted by filename alone. Package 1's manifest includes this UDI-DI at
version 3; package 6 includes it at version 4.

The generation source recorded around the September events was inspected. It
constructs scenario XML and context from the derived record and combines those
messages into a bulk payload. This shows intended implementation behavior, not
proof of the missing historical payload bytes or the portal's field persistence.
Regenerating a payload now would not recover evidence of what was submitted then.

## Conclusion

The local quantity 2 predates this Import Management work, and the reviewed
October Playground export directly shows quantity 1. Exact submitted quantities
and the cause of the disagreement remain unverified without the outgoing files
or additional independent portal history/evidence. Do not infer an external
change, a rendering defect, a state-projection defect or a portal processing defect
as a proven cause. Keep this mismatch visible in the owner's baseline review.

Both current Dev and Production database SHA-256 fingerprints match the previously
recorded values after investigation. No database files were modified by these
checks. No automated tests were needed for this read-only investigation and
documentation-only change.
