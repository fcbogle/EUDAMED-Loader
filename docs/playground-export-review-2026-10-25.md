# Playground export review — 25 October 2026

Read-only review of the owner's five exports in the original checkout's
`data/testing/playground-extracts/25-10-2026/`, compared with its existing
`data/testing/testing-state.sqlite3`. No workbook was prepared or data imported.
Production was not opened. Source XML files were not edited.

## Export completeness

| File | Declared page (zero-based) | Device records |
| --- | ---: | ---: |
| APP-DTX-000119311.xml | 0 | 50 |
| APP-DTX-000119312.xml | 1 | 50 |
| APP-DTX-000119313.xml | 2 | 50 |
| APP-DTX-000119314.xml | 3 | 50 |
| APP-DTX-000119315.xml | 4 | 15 |
| Total | All five pages | 215 |

All files parse without encoding overrides. They declare schema version 3.0.32,
response SUCCESS and five pages of size 50. All exported manufacturer codes are
`UK-MF-000033261`. The exports contain 215 distinct issuer-qualified Device
UDI-DIs, with no duplicates, linked to 10 distinct Basic UDI-DIs. Device states
are REGISTERED, parent links agree within each exported record, and the existing
export parser found no missing parent/device/Market Information state or version.
All represented parents are at version 1. This is structural/content inspection,
not a full XSD-validation or regulatory acceptance assessment.

Completeness is established for this returned search, matching the owner's
reported 215 results. This does not establish coverage of parents without children
or prove that search filters encompass every possible actor record.

| Exported model | Device count |
| --- | ---: |
| Javelin | 40 |
| Navigator | 21 |
| Linx | 31 |
| EliteVT | 42 |
| Esprit | 56 |
| Echelon VAC | 21 |
| Epirus | 1 |
| Elite Blade | 1 |
| Elite2 | 1 |
| Elan IC | 1 |

## Comparison with local Playground evidence

SQLite was opened using URI `mode=ro` and `PRAGMA query_only=ON`; no application
services or startup handlers were invoked. Successful testing subjects were
matched using issuer/UDI-DI from their canonical records, preserving leading zeros.
214 subjects have direct device-subject links; one legacy Esprit subject was
resolved through its unique canonical identity without changing that linkage.

All 215 successful local subjects match the 215 export identities. Neither side
has an unmatched device in this comparison. Their canonical parent links also
agree with the exported links. This does not compare all fields or all unregistered
Template devices in the larger database.

Device versions match for 213 records. One record has only an ambiguous legacy
version summary, and one lacks a recorded device version:

| Device | UDI-DI (GS1) | Local evidence | Export | Review |
| --- | --- | --- | --- | --- |
| EVT22L11S | 05050649110023 | Generic latest version 2; no explicit POST/PATCH version; Market Info version 1 | Device version 1; Market Info version 2 | Resolve legacy device-version meaning and Market Info version discrepancy from retained evidence |
| EVT22L53S | 05050649110382 | Device version 2; Market Info version 1 | Device version 2; Market Info version 2 | Review Market Info version discrepancy |
| EB22L1S | 05050649026027 | Successful DEVICE.POST recorded without a device version | Version present in export | Missing local version is unresolved evidence, not a proven discrepancy |

Dedicated local Market Info versions exist for 53 exported devices: 51 match and
the two EliteVT versions above differ. The other 162 lack a dedicated successful
Market Info version; that is not evidence of a missing registration or a difference.
All 53 available local Market Info country snapshots, including original-placement
flags, agree with the exports, even for the two version discrepancies.

## Next action

Retain all five original XML files and confirm the corresponding Template and
Basic UDI-DI reference inputs with the owner. Review the legacy/version exceptions
before treating the application and portal as fully aligned or updating any
accepted state. Do not overwrite testing history or repair versions automatically.
These exports are useful evidence for designing and testing the new import/report
flows; they have not yet been imported or used to generate a workbook.

The original checkout's `.git/info/exclude` now excludes
`/data/testing/playground-extracts/`, preventing these local exports from being
included in ordinary Git staging. No tracked ignore change was made on main.
