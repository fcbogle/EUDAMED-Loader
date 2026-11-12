# Playground XML inspection — November 12, 2026

Current status: Dev configuration and source version checks now use the official
3.0.36.1 profile. The initial admission blocker recorded below is historical;
see [integration findings](playground-schema-upgrade-2026-11-12.md). No import
has been performed. All five originals pass official XSD validation.

Read-only inspection of the five owner-supplied Downloads files. No import, application service, operational database access or schema/configuration change. This establishes observed source structure and identity coverage, not full XSD validation, import approval or complete manufacturer inventory.

## Extract set

| File | Page (zero-based) | Devices | Creation timestamp as recorded | SHA-256 |
| --- | ---: | ---: | --- | --- |
| APP-DTX-000123104.xml | 0 | 50 | 2026-11-12T16:55:41.274+01:00 | `479aa4236dccbf7f14e414341c747f8a05b263eab33f8ef9367538c4e59c6815` |
| APP-DTX-000123105.xml | 1 | 50 | 2026-11-12T16:56:02.387+01:00 | `335fb3b3f57f37ee21744200496db634750966671be1d6411bcac0f00085aa0c` |
| APP-DTX-000123107.xml | 2 | 50 | 2026-11-12T16:56:11.226+01:00 | `70923858bdccb7a99c4025372b1b6858fe0c05b991a82b83cbae4d292a927869` |
| APP-DTX-000123108.xml | 3 | 50 | 2026-11-12T16:56:30.580+01:00 | `28c4ffb56a90ef400b1aa670b7502562094a4e2a21645d4822af42576369a987` |
| APP-DTX-000123109.xml | 4 | 41 | 2026-11-12T16:56:50.613+01:00 | `db38c03d8396afc449fb43d090680281cfea5dd2aa48afd5e0af1b9a6fa47ef6` |

- All files are under `/Users/frankbogle/Downloads/`.
- All declare PullResponse schema 3.0.36.1, response SUCCESS, five pages and page size 50. Pages 0–4 are present once each; filename sequence gaps do not indicate missing pages.
- Recorded timestamps span 15:55:41.274–15:56:50.613 UTC on November 12 (the XML uses +01:00).
- All manufacturer codes are UK-MF-000033261, matching the established Dev manufacturer.
- 241 devices; 241 distinct issuer-qualified device identities; 11 distinct parent identities. No duplicate device identities or inconsistent parent links.
- All observed parent, device and Market Info states are REGISTERED, with positive integer versions.
- Page metadata establishes completeness of the supplied search results. Business search filters are not recorded here, so absent devices must not be declared unregistered.

## Model coverage

| Model | Extract device identities |
| --- | ---: |
| Echelon | 26 |
| Echelon VAC | 21 |
| Elan IC | 1 |
| Elite Blade | 1 |
| Elite2 | 1 |
| EliteVT | 42 |
| Epirus | 1 |
| Esprit | 56 |
| Javelin | 40 |
| Linx | 31 |
| Navigator | 21 |

## Fresh Template and BasicUDI comparison

- Compared with the eight Templates in `OneDrive_1_11-12-2026.zip` and `data/prod/template/BasicUDIs 9th October.xlsx` in the original checkout, both read only.
- All 11 extract parents exist in the October 9 BasicUDI reference.
- 240 extract identities match the currently included fresh Templates, with matching parent assignments and catalogue numbers.
- One extract-only device: GS1 05050649062025, catalogue EVAC22L1S, Echelon VAC, Basic UDI 5050649ECHELONVACNL; source APP-DTX-000123109.xml, device index 41. Preserve as extract evidence rather than invent a Template row.
- Of 9,361 currently included Template identities, 9,121 are absent from this selected extract set. Absence is not proof of non-registration.
- This is identity/parent/catalogue coverage only; it does not claim all regulatory attributes match. Existing database state has not been compared.

## Dev compatibility blocker

The fresh files declare **3.0.36.1**, while current Dev source admission explicitly requires **3.0.32**. Retained reporting selection also requires the active environment version. The existing `validate_received_content` guard rejected a temporary copy with `export schema/manufacturer does not match Dev`; the observed manufacturer matches and the version differs.

The existing `_exports` source parser read all five files, all 241 identities and page metadata without missing-state/version reasons. This demonstrates structural readability for its supported paths, not complete 3.0.36.1 compatibility or XSD validation. No version attributes were rewritten and no guard was bypassed.

Before importing, agree and assess incoming 3.0.36.1 support in Dev, including retained report sources, accepted-state projection and regression coverage. Incoming extract compatibility and outgoing XML schema selection are separate decisions; do not change outgoing generation or Production as an incidental fix.

## Verification

Original XMLs were parsed with entity resolution disabled and network access disabled, with no DOCTYPE present. SHA-256 fingerprints recorded above. Only these five named files were copied into a disposable system directory for the application parser and admission checks; copies were removed. No operational batch was created. Full test suites were not run for source-only inspection.

## Official 3.0.36.1 XSD package obtained and used

Downloaded the official Playground archive on November 12 from
`https://webgate.ec.europa.eu/eudamed-play-help/en/files/XSD%20schemas.zip`.
The technical-documentation page identifies the current package as 3.0.36.1;
its relative documentation-directory download link returned 404, while the
same site's files-directory URL succeeded.

- Archive: `/private/tmp/eudamed-playground-3.0.36.1-xsd.zip` (temporary inspection artifact).
- SHA-256: `caeb50507b578078853ebb34430e1e075e43381f054e14c7ee6692166be4cf43`.
- Archive has 70 members, including 69 XSD files. Backslash member separators
  were normalized for extraction; absolute/traversal paths and duplicates were
  rejected. File bytes were preserved.
- Extracted under `/private/tmp/eudamed-playground-3.0.36.1-xsd-review/`.
- `service/Message.xsd` compiled successfully with lxml using local dependencies
  and network access disabled; MessageType fixes the version at 3.0.36.1.
- All five owner-supplied XML extracts validated successfully against this
  official entrypoint, with zero XSD errors.
- Compared with the preserved derived Dev profile: 69 versus 67 XSD files;
  two added, none removed. After newline normalization, 34 shared files differ
  in text. These counts do not imply 34 device-flow rule changes; semantic
  review and outgoing generation regression checks remain outstanding.
- Added files: `data/Entity/Certificate/PutCertificateType.xsd` and
  `data/Entity/SSCP/PostSSCPType.xsd`.

The official package is usable for local validation. It is not yet an activated
application profile. Current Dev source admission still rejects the version.
No startup configuration, import rules, outgoing schema selection, database or
Production file was changed. Next work is the controlled Dev integration and
POST/PATCH/Market Info regression verification; successful extract validation
alone is not evidence those outgoing workflows already support the release.

### Permanent application storage

At the owner's subsequent request, the package is now retained in the development
worktree at `data/schema_profiles/dev-3.0.36.1-official/` (69 XSDs plus the bundled
Dossier sample XML), with the original archive under
`data/schema_profiles/archives/eudamed-playground-3.0.36.1-xsd.zip`.
The schema-profile manifest records per-file hashes and provenance. Compilation
and validation of all five extracts were repeated against this stored copy and
passed. All 136 files in the existing Dev/Production profile trees were confirmed
unchanged. This supersedes temporary-only storage above; activation remains pending.
