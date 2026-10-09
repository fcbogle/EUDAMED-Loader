# Production import workbook contract

Updated 9 October 2026 against the preparation utility and current saved workbook.
Workbook preparation is implemented. The application Production importer remains
unimplemented and is described in [production-importer-design.md](production-importer-design.md).
This document does not authorize Production database initialization or import.

## Locations and output lifecycle

| Purpose | Current location |
| --- | --- |
| Device templates | `data/prod/template/` |
| Owner-supplied parent reference | `data/prod/template/BasicUDIs 9th October.xlsx` |
| Accepted EUDAMED exports | `data/prod/eudamed_xml/` |
| Prepared workbook and companion audit | `data/prod/import_file/` |

The selected parent reference is excluded from device-template scanning. It
supersedes `data/basic_udi_reference/BasicUDIs.xlsx` for Production preparation;
Dev reference configuration is unchanged.

The current utility creates a new timestamped `.xlsx` / `.audit.json` pair on each
run. The latest local pair is `production-import-20261009-114955-299236.xlsx` and
`production-import-20261009-114955-299236.audit.json`. Earlier pairs are historical
and may no longer be present. Production inputs and outputs are ignored by Git.

The owner has agreed to maintain one current pair named `production-import.xlsx`
and `production-import.audit.json`. That change is **not implemented yet**.
It requires staged validation, coherent hash verification, a single writer and
clear handling of Excel locks. Replacing two files does not itself make the pair
atomic. Preserve the original templates, parent reference and XML files.
See [run instructions](production-import-preparation.md).

## Current populations and classification

Eight device workbooks contain 9,681 source rows and 9,679 distinct issuer/UDI-DI
identities. All current template rows have explicit parent identifiers present
in the 50-row parent reference: 22 Upload and 28 Update rows. Reference sheet names
express source intent; they are not evidence of accepted Production versions.

The supplied 11 September 2026 export set contains 15 files, 360 device identities
and 30 parents. Pages 0–7 contain the returned population; pages 8–14 are empty.
This validates pagination for the supplied query, not a live portal inventory or
coverage of registered parents without children.

The owner-approved classification for these inputs is template-only = Not
registered and XML-present = Registered. Five identities overlap. Overlaps appear
once on Registered with separate proposed and accepted data; XML-only devices
remain visible. Conflicting template-only identities have Needs review status.

| Data tab | Total rows | Review Required = No | Review Required = Yes |
| --- | ---: | ---: | ---: |
| To Register | 9,674 | 9,672 | 2 |
| Registered | 360 | 356 | 4 |
| Total | 10,034 | 10,028 | 6 |

The agreed Production import filter includes only No rows. These are eligibility
counts, not completed imports or a claim that every eligible device is XML-ready.
The original 974 review rows and later 946 flags are superseded historical results.

## Implemented three-tab layout

Tabs are `To Register`, `Registered`, then `Summary`. Data tabs use filters,
frozen headers, wrapped text and literal-text identifiers/catalogue numbers.

Both data tabs contain Device Type, Registration Status, Review Required,
Review Reasons, issuer/UDI-DI identity, proposed parent identity/properties,
template source lineage and a union of the original business columns. Preserve
header variations, populated unnamed columns and repeated header occurrences.
Generic Sheet1 device types use the workbook filename. Explicit template parent
identifiers take precedence; otherwise an exact model-name/issuer reference match
is required, ignoring case and surrounding whitespace.

Registered adds an accepted-data block with separate parent, device and Market
Info states, versions and dates; supplied actor/model/regulatory properties;
accepted countries; and XML provenance. Repeated/nested XML structures use
namespace-qualified JSON. Proposed fields never overwrite accepted fields.
Missing accepted versions stay unknown.

The companion audit preserves original template/reference rows, headers, values,
cell types, formulas and available cached values, every duplicate occurrence,
full extracted XML projections, input hashes, workbook hash, approved overrides,
review reasons and Summary entries. Conflicting proposed cells remain blank with
alternatives retained in the audit. Missing formula caches are reported. Excel
limits or invalid cell characters fail preparation rather than truncate data.

Summary contains counts, approved markets, six individual device exceptions,
optional URL inclusion notes, 29 prior removed-template identities, encoding
provenance and later checks. Removal notes carry forward while identities remain
absent; restored identities are removed from those notes. They do not delete
application records or count as additional skipped workbook rows.

## Resolved gaps and approved choices

- Elan MAX: 820 devices under `5050649ELANACTIVENG`, Germany.
- MAX Liners: 107 under `5050649MAXLINER5K`, Germany and France.
- MAX Sleeves: 13 under `5050649MAXSLEEVEM7`, Germany and France.
- Germany is first placement for all three groups. Overrides affect proposed
  data only; original reference values and exported accepted countries remain intact.
- The 940 unavailable optional URLs are omitted from prepared URL fields.
  Original `Not available yet` values remain in the audit. These devices are
  included with No review flags; Summary records their inclusion.
- The 29 earlier template identities removed from scope comprise 26 cosmetic
  cover/foam/fabric stocking accessories, two Glide Socks and catalogue 405815.
  Their removal still needs scope confirmation; missing data was not repaired.

## Six remaining device exceptions

| Devices | Issue | Tab / skipped rows |
| --- | --- | --- |
| EP-FSR and EP-MSR | Accessories and Epirus occurrences disagree on parent and EMDN. Both alternatives are retained. | To Register / 2 |
| Catalogue 330130, UDI-DI `05050649011207` | Proposed parent `5050649STRUCADAPTSA7` differs from accepted `5050649CHILD4BARKNEEH4`. | Registered / 1 |
| Compact SAKL P019267, P239143 and p239443 | Countries and device registration are supplied, but explicit Market Info state/version metadata is missing. | Registered / 3 |

Review Required is independent of known registration. Skipping a Registered row
does not assert that the device is unregistered. No missing version or conflict
is resolved by importing the workbook.

## Parsing safeguards and later database work

`APP-DTX-000103944.xml` and `APP-DTX-000103948.xml` declare UTF-8 but contain
Windows-1252 apostrophes. Explicit per-file overrides are recorded; original XML
bytes are unchanged. Other parsing failures stop preparation with no automatic
encoding fallback. External entities/network resolution are disabled; DOCTYPEs,
unsupported envelopes, duplicate export identities, inconsistent parent links
and incomplete populated pagination are rejected.

Sixteen focused synthetic preparation tests passed at the latest implementation
checkpoint. Saved-output checks verified counts, all 940 inclusion flags, Summary
notes and source/output hashes. These checks do not certify full XSD/GTIN validity,
live inventory completeness or canonical/XML mapping coverage for all device types.

The Production importer must reuse Dev's SQLite structure and tested workflows,
including Upload Success XML, while loading proposed fields and trustworthy
exported accepted baselines separately. Profile selection, baseline evidence
adaptation, transaction/reimport policy and the Production UI remain design work.
Imported acceptance must have explicit export provenance, never fabricated POST
successes, acknowledgements or review receipts. Automated upload/M2M remains deferred.
