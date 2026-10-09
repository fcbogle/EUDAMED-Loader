# Production workbook preparation

Implemented and refreshed 9 October 2026. This utility prepares a workbook for review; it does
not create or populate the Production SQLite database, change canonical mappings,
or submit anything to EUDAMED.

## Run

From the repository root:

```bash
.venv/bin/python backend/scripts/prepare_production_import.py \
  --encoding-override APP-DTX-000103944.xml=windows-1252 \
  --encoding-override APP-DTX-000103948.xml=windows-1252 \
  --parent-market-override 'GS1:5050649ELANACTIVENG=Germany' \
  --parent-market-override 'GS1:5050649MAXLINER5K=Germany,France' \
  --parent-market-override 'GS1:5050649MAXSLEEVEM7=Germany,France' \
  --previous-audit data/prod/import_file/production-import-20261009-071907-589408.audit.json
```

The two explicit overrides are needed for the supplied September 11 export set,
whose declared encoding fails for those files. Other XML errors fail preparation;
there is no automatic encoding fallback. Original files remain unchanged.

Default locations:

| Input/output | Location |
| --- | --- |
| Templates | `data/prod/template/` |
| Export XML | `data/prod/eudamed_xml/` |
| Current parent reference, owner supplied | `data/prod/template/BasicUDIs 9th October.xlsx` |
| Output workbook and audit JSON | `data/prod/import_file/` |

Override paths with `--template-dir`, `--xml-dir`, `--parent-reference` and
`--output-dir`. Output filenames use UTC timestamps including microseconds.
Each run creates a new `.xlsx` and matching `.audit.json`. Retain them together
with the original inputs. Outputs and production inputs are ignored by Git.

The parent reference is excluded from device-template scanning even when stored
in the same folder. Approved market overrides apply to proposed output only; the
first listed country is first placement. Original parent values remain in the
audit and source file. No override changes exported accepted countries.

## Refreshed preparation

The owner supplied updated templates and BasicUDIs and approved Germany for
Elan MAX, Germany/France for MAX Liners and MAX Sleeves, with Germany first
placement. The owner also requested a Summary tab.

The refreshed [workbook](../data/prod/import_file/production-import-20261009-112246-846943.xlsx)
and [audit](../data/prod/import_file/production-import-20261009-112246-846943.audit.json)
retain the earlier artifacts. Counts:

- 9,681 template rows; 9,679 distinct template identities; every current template
  row has an explicit parent identifier present in the 50-row parent reference.
- To Register: 9,674 identities (9,672 Not registered; two Needs review).
- Registered: 360; five template/export overlaps; 10,034 distinct output identities.
- Six remaining device exceptions: EP-FSR, EP-MSR, catalogue 330130 and the three
  Compact SAKL devices with missing Market Info metadata.
- 940 optional URL review flags: Elan MAX 820, MAX Liners 107, MAX Sleeves 13.
  Their source URL value remains `Not available yet`; agree a real URL or omission
  of this optional field before XML use. With the six device exceptions, there
  are 946 current Review Required rows, not 946 registration failures.
- 29 previous identities absent from current templates: 26 cosmetic-cover/foam/
  fabric-stocking accessories, two Glide Socks and catalogue 405815. All are listed
  on Summary for scope confirmation; their missing data was not repaired.

Sixteen synthetic tests passed, including same-folder parent exclusion, approved
countries, audit preservation, Summary exceptions and prior-removal reporting.
Saved-output checks cover tab/count/identity consistency, country choices across
all 940 affected rows, Summary totals, input/output hashes and preservation of
the earlier workbook. Production database import, canonical mapping expansion,
XML readiness and submission remain separate.

## Output contract

The workbook has three tabs, `To Register`, `Registered`, then `Summary`. It matches
issuing entity plus UDI-DI and maintains identifiers as literal text. A template
identity present in XML appears once in Registered, with its proposed values and
exported accepted values in separate columns. XML-only devices remain visible.

Original template headers form a union across input sheets; variants remain
distinct and populated unnamed columns are preserved. Duplicate header occurrences
receive distinct labels. Business values are not normalized into canonical fields.
Country information appearing in headers remains available in the original header
and audit. Repeated accepted XML structures use namespace-qualified JSON cells.

The JSON audit preserves every original template row, header, value, cell type,
formula, parent-reference occurrence and exported XML projection. Input SHA-256
hashes and the generated workbook SHA-256 support verification. It also lists
output identities, source locations and all review reasons. A formula without
a cached value is flagged rather than evaluated or replaced. Excel limits cause
an explicit failure rather than silent truncation.

Parent resolution uses an explicit template Basic UDI-DI when present; otherwise
it requires an exact model-name match (ignoring surrounding whitespace and case)
and matching issuer in BasicUDIs.xlsx. Generic Sheet1 device types use the workbook
name. Missing/ambiguous parents are flagged. Reference values are proposed data;
the reference workbook's Upload/Update sheet names do not establish accepted state.

Summary contains counts, approved settings, individual device exceptions with
data-row locations, grouped optional URL issues, removed identities relative to
the previous audit, encoding provenance and later checks. Removal reporting does
not delete database state. Optional URL issues do not change known registration.

Conflicting template values are left blank in the combined proposed cell, with
all alternatives preserved in the audit. Conflicting template-only identities
receive Needs review on To Register. A Registered identity remains Registered
when business or version metadata needs review. Review Required and Review Reasons
are independent of Registration Status. These columns are not XML readiness checks.

Unsupported export envelopes/types, missing or inconsistent populated pages,
duplicate exported identities, conflicting exported parent links, DOCTYPEs and
missing essential export identities fail preparation before output creation.
This utility supports the supplied MDR PullResponse layout; broader device-type
support requires separate evidence and implementation. It does not certify XSD
validity, GTIN check digits, complete production inventory or generation readiness.

## First preparation results

- Eight template workbooks: 9,710 source rows and 9,708 distinct identities.
- Fifteen export files: 360 distinct Registered devices, including five template
  overlaps; populated pages 0–7 are present and pages 8–14 are empty.
- To Register: 9,703 identities, comprising 9,701 Not registered and two Needs review.
- Registered: 360 identities. Total distinct output identities: 10,063.
- 974 output identities require review; reason counts overlap.

Review findings:

| Reason | Affected identities |
| --- | --- |
| Missing parent reference | 942: Elan MAX 820, MAX Liner/Sleeve 120, Footspares 2 |
| Explicit parent without properties in BasicUDIs.xlsx | 26, covering Cosmetic Cover, Foam and Fabric Stockings parents |
| Conflicting duplicate template identities | 2: EP-FSR and EP-MSR; EMDN and proposed parent differ, with additional literal source-value differences |
| Proposed parent differs from exported accepted parent | 1: GS1 / 05050649011207 |
| Missing exported Market Info state/version | 3 Registered Compact SAKL devices |

The parent mismatch is retained for review; accepted data is not overwritten by
the reference workbook. Unknown Market Info versions remain blank.

Verification: 11 synthetic tests passed. The generated workbook was reopened and
checked for correct tabs/counts, unique identities, text identifiers, matching
review counts, workbook hash and unchanged input hashes. The initial workbook is
a review artifact. Resolve these issues and agree the persistence/provenance
contract before implementing or running the Production database import.
