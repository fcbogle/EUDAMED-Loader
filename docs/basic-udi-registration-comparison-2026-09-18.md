# Basic UDI-DI registration comparison — 18 September 2026

Compared `data/basic_udi_reference/BasicUDIs.xlsx` with the 15 XML files in `docs/xml_eudamed/`, exported on 11 September 2026. Matching uses Basic UDI-DI code plus issuing entity (GS1), not model name. Registration evidence is the explicit `MDRBasicUDI/state` value `REGISTERED`.

| Workbook classification | Distinct Basic UDI-DIs | Registered in XML | Not found in XML |
|---|---:|---:|---:|
| Update (registered) | 28 | 28 | 0 |
| Upload (not registered) | 19 | 1 | 18 |
| Total in workbook | 47 | 29 | 18 |

One additional registered Basic UDI-DI is absent from the workbook: Child’s 4-Bar Knee, `5050649CHILD4BARKNEEH4`. The XML contains 30 distinct registered parents across 360 distinct child Device UDI-DIs.

Echelon VAC (`5050649ECHELONVACNL`) is in Upload sheet row 2 but explicitly registered in `APP-DTX-000103944.xml`. Its parent version is 1, dated 8 June 2026.

## Complete comparison

Child counts describe this export only. “Not found” does not establish that a parent is unregistered: this is a DEVICE query snapshot whose filters and coverage of parents without children have not been confirmed. It is not a live status check.

| Model | Basic UDI-DI | Workbook classification | XML evidence | Exported children |
|---|---|---|---|---:|
| Echelon VAC | `5050649ECHELONVACNL` | Upload / not registered | REGISTERED | 1 |
| Elan | `5050649ELANXG` | Upload / not registered | Not found | 0 |
| Elan IC | `5050649ELANICNM` | Upload / not registered | Not found | 0 |
| Elite Blade | `5050649ELITEBLADESZ` | Upload / not registered | Not found | 0 |
| Elite2 | `5050649ELITE2PX` | Upload / not registered | Not found | 0 |
| EliteVT | `5050649ELITEVTV4` | Upload / not registered | Not found | 0 |
| Epirus | `5050649EPIRUSUH` | Upload / not registered | Not found | 0 |
| Esprit | `5050649ESPRITVZ` | Upload / not registered | Not found | 0 |
| Socket Adaptors | `5050649SKTADAPTSLS` | Upload / not registered | Not found | 0 |
| Structural Adaptors | `5050649STRUCADAPTSA7` | Upload / not registered | Not found | 0 |
| Javelin | `5050649JAVELINTY` | Upload / not registered | Not found | 0 |
| Linx | `5050649LINX2G` | Upload / not registered | Not found | 0 |
| Navigator | `5050649NAVIGATORGP` | Upload / not registered | Not found | 0 |
| Socket Locks | `5050649SOCKETLOCKSYK` | Upload / not registered | Not found | 0 |
| Socket Valves | `5050649SOCKETVALVESZG` | Upload / not registered | Not found | 0 |
| Linx Programming App Android | `5050649LINXPAPPAND2T` | Upload / not registered | Not found | 0 |
| Linx Programming App iOS | `5050649LINXPAPPIOS54` | Upload / not registered | Not found | 0 |
| Orion3 Programming App Android | `5050649O3PAPPAND5P` | Upload / not registered | Not found | 0 |
| Orion3 Programming App iOS | `5050649O3PAPPIOS7Y` | Upload / not registered | Not found | 0 |
| Echelon VT | `5050649ECHELONVT6Y` | Update / registered | REGISTERED | 1 |
| Echelon ER | `5050649ECHELONER59` | Update / registered | REGISTERED | 1 |
| Echelon | `5050649ECHELONMV` | Update / registered | REGISTERED | 2 |
| Elite BladeVT | `5050649ELITEBLADEVT9W` | Update / registered | REGISTERED | 8 |
| ESK+ | `5050649ESKBU` | Update / registered | REGISTERED | 17 |
| Aqualimb TF | `5050649AQUALIMBTFX7` | Update / registered | REGISTERED | 13 |
| Aqualimb TT | `5050649AQUALIMBTTY3` | Update / registered | REGISTERED | 12 |
| AvalonK2 | `5050649AVALONK2Y4` | Update / registered | REGISTERED | 36 |
| AvalonK2VAC | `5050649AVALONK2VACJ3` | Update / registered | REGISTERED | 28 |
| BladeXT | `5050649BLADEXTMF` | Update / registered | REGISTERED | 18 |
| BMK2 | `5050649BMK2W8` | Update / registered | REGISTERED | 3 |
| Compact SAKL | `5050649COMPACTSAKLM3` | Update / registered | REGISTERED | 5 |
| KX06 | `5050649KX06V2NB` | Update / registered | REGISTERED | 6 |
| Mercury | `5050649MERCURYYB` | Update / registered | REGISTERED | 13 |
| Mini BladeXT | `5050649MINIBLADEXTJL` | Update / registered | REGISTERED | 6 |
| Multiflex | `5050649MULTIFLEXSTD9X` | Update / registered | REGISTERED | 26 |
| Multiflex Ankle | `5050649MULTIFLEXANKLEHN` | Update / registered | REGISTERED | 22 |
| Orion3 | `5050649ORION3W7` | Update / registered | REGISTERED | 3 |
| SmartIP | `5050649SMARTIP2Q` | Update / registered | REGISTERED | 4 |
| Super SACH | `5050649SUPERSACHWC` | Update / registered | REGISTERED | 14 |
| Tectus | `5050649TECTUSVT` | Update / registered | REGISTERED | 5 |
| Blatchford App | `5050649DIGITALHEALTH4D` | Update / registered | REGISTERED | 1 |
| TT Pro | `5050649TTPRO3L` | Update / registered | REGISTERED | 15 |
| Silcare Active | `5050649SARJ` | Update / registered | REGISTERED | 20 |
| Silcare Walk | `5050649SWSW` | Update / registered | REGISTERED | 20 |
| Silcare Breathe Active | `5050649SBABT` | Update / registered | REGISTERED | 20 |
| Silcare Breathe Walk | `5050649SBWD7` | Update / registered | REGISTERED | 20 |
| Avior | `5050649AVIORU8` | Update / registered | REGISTERED | 18 |
| Child’s 4-Bar Knee | `5050649CHILD4BARKNEEH4` | Absent | REGISTERED | 2 |

## Evidence and interpretation

The accompanying CSV provides source sheet rows, XML filenames and XML model names for each identity. All 28 Update-sheet identities match registered XML parents. Model-name differences (for example AvalonK2VAC / AvalonVAC and Orion3 / ORION3 EXTERNAL KNEE PROSTHESIS) do not affect identifier matches.

Pages 0–6 contain 50 devices each, page 7 contains 10, and pages 8–14 are empty. The two files `APP-DTX-000103944.xml` and `APP-DTX-000103948.xml` required a Windows-1252 decoding override despite declaring UTF-8; originals were not altered.

No workbook classifications or application registration state were modified. Parent registration does not establish registration of every child device.
