# Fresh Template source inspection — November 12, 2026

Read-only source inspection before a new Dev import. This is not an import approval, database reconciliation, registration count or complete regulatory-content validation.

## Sources

- ZIP: `/Users/frankbogle/Downloads/OneDrive_1_11-12-2026.zip`
- ZIP SHA-256: `3f9bcf5a4f22fcef393074cb8c00c8c1a87815b393862ff04b8e440b0e14eea2`
- Latest dated retained reference located: `/Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/data/prod/template/BasicUDIs 9th October.xlsx`.
- Reference SHA-256: `0a85ad57fac1ebca2bae6033818e0ae346ea047ac54fe25623ca5bf7ead5adb7`
- This is the latest dated retained reference found, not a claim that no newer external revision exists. Original/main source files were read only. No Production service or database was accessed.

## Template inventory

| Workbook | Populated device rows | Models resolved through BasicUDI | Current Dev scope |
| --- | ---: | --- | --- |
| Template for Accessories_Footspares EUDAMED.xlsx | 320 | AvalonK2, BladeXT, Echelon, Echelon ER, Echelon VAC, Echelon VT, Elite Blade, Elite2, EliteVT, Epirus, Esprit, Javelin, Mini BladeXT, Navigator, Socket Adaptors, Socket Locks, Socket Valves, Structural Adaptors | Excluded |
| Template for Echelon family EUDAMED.xlsx | 2,945 | Echelon, Echelon ER, Echelon VAC, Echelon VT | Included |
| Template for Elan MAX EUDAMED.xlsx | 820 | Elan MAX | Included |
| Template for Elan products EUDAMED.xlsx | 784 | Elan, Elan IC | Included |
| Template for Elite family EUDAMED.xlsx | 2,770 | Elite Blade, Elite2, EliteVT | Included |
| Template for Epirus_Esprit EUDAMED.xlsx | 872 | Epirus, Esprit | Included |
| Template for MAX_Liner_and_Sleeve on EUDAMED.xlsx | 120 | MAX Liners, MAX Sleeves | Included |
| Template for Navigator_Javelin_Linx EUDAMED.xlsx | 1,050 | Javelin, Linx, Navigator | Included |

## Coverage and identity findings

- Eight workbooks; 9,681 populated device rows; 9,679 distinct issuer-qualified Device UDI-DIs across all workbooks.
- All 9,681 rows contain explicit Basic UDI-DIs and resolve to one reference parent. No missing device identities, non-14-digit GS1 identifiers, unresolved parent references or uncached formulas were found by the source parser. GS1 check-digit validity was not assessed.
- The complete archive uses 24 reference models. Current Dev scope excludes the 320 Accessories/Footspares rows: 9,361 rows, 9,361 distinct identities, 17 models.
- No duplicate device identities exist within the currently included seven workbooks.
- No differing-identity catalogue collisions were found within resolved model scope (case/whitespace normalized). Existing database identities/catalogues have not been compared; additive-import conflicts can still arise.

### Echelon correction

| Echelon worksheet row | Device UDI-DI | Catalogue in fresh source |
| --- | --- | --- |
| 86 | 05050649030901 | EC24R1S |
| 242 | 05050649032462 | EC27LN7S |

The previous two-device EC27LN7S collision is corrected in the supplied source. Existing database values remain unchanged; this does not establish that additive Dev import can apply the correction automatically.

### Cross-workbook conflicts if Accessories is included

| Catalogue | Device UDI-DI | Accessories source | Epirus source |
| --- | --- | --- |
| EP-FSR | 05050649057946 | Adaptors_Socket_Accessories row 44; Basic UDI 5050649SKTADAPTSLS | Epirus row 454; Basic UDI 5050649EPIRUSUH |
| EP-MSR | 05050649057977 | Adaptors_Socket_Accessories row 45; Basic UDI 5050649SKTADAPTSLS | Epirus row 456; Basic UDI 5050649EPIRUSUH |

Each device has conflicting parent assignments across those workbooks. Resolve authoritative ownership/linkage before including Accessories. The current exclusion is unchanged.

## BasicUDI revision comparison

The October 9 workbook has 50 distinct parent identities versus 47 in `data/basic_udi_reference/BasicUDIs.xlsx` and its retained Dev batch copies. The 47 common reference entries have identical field values. October 9 adds:

| Model | Basic UDI-DI | Rows in fresh Templates | Market availability in reference |
| --- | --- | ---: | --- |
| Elan MAX | 5050649ELANACTIVENG | 820 | Blank |
| MAX Liners | 5050649MAXLINER5K | 107 | France? |
| MAX Sleeves | 5050649MAXSLEEVEM7 | 13 | France? |

The older reference cannot cover these 940 rows. The October 9 reference covers their parent identities, but market data remains incomplete/tentative. All three have the optional URL placeholder `Not available yet`; existing preparation omits it and retains the original in audit. Current Dev review policy classifies missing/tentative parent markets as warnings, not automatic import blockers. XML readiness remains a separate assessment; no market values were inferred or changed.

The reference also contains 26 models with no corresponding Template rows in this archive. This is not automatically a missing-file finding: the agreed source scope is the supplied eight groups, not every model ever listed in the parent reference.

## Verification and next step

The ZIP was read in memory and its eight flat workbook members temporarily copied under a disposable system directory to run the existing application `_parent_reference` and `_templates` parsers. Independent workbook inspection and application parsing agreed on row counts and parent coverage. Temporary copies were removed. Original sources and operational databases were not modified. No import, application startup, full test suite or fresh XML inspection was performed.

The complete five-page November 12 Playground XML set has since been inspected, and Dev schema 3.0.36.1 integration is recorded in the session handoff. Next: run the normal source review using those XMLs and the October 9 BasicUDI reference as copied batch inputs. Keep Accessories excluded unless its scope and conflicting parent links are separately agreed. Assess database identity/catalogue conflicts before preparing/confirming an additive import.

## Workbook fingerprints

| Workbook | SHA-256 |
| --- | --- |
| Template for Accessories_Footspares EUDAMED.xlsx | `c231057a81f29162c3096218f213f42e1af5a37bdc5d482878a76f5f48c07f86` |
| Template for Echelon family EUDAMED.xlsx | `60b74fcba6fc184ec830e2f3e53963dd9987225a8629b3665ff100bd36ca45cb` |
| Template for Elan MAX EUDAMED.xlsx | `6abb5178acd109f9d8b9ac0fcb27f1b80df088a04dcc63ee06500f0da03f8981` |
| Template for Elan products EUDAMED.xlsx | `4028957b8ef85bc2395cf4edea01919699480f50fddb9248d3f069496e1d47ff` |
| Template for Elite family EUDAMED.xlsx | `7d738ca58e418d0f93f37b1ee6a9ede17b4e4831878e2f5af3c3f76e6a77b0c6` |
| Template for Epirus_Esprit EUDAMED.xlsx | `c9b8a1b07630181d8cabfa85143f8659199a7ca226d9b77bd291aff9a91725b4` |
| Template for MAX_Liner_and_Sleeve on EUDAMED.xlsx | `10d762d7a7e107e5c37bd2a39da048bfef0c853ea1384cfdf94952f4df5bc9fe` |
| Template for Navigator_Javelin_Linx EUDAMED.xlsx | `bd9d1e5d4c33698d671f47526d780d14f96d0aada6438736fcb862e7589a4691` |
