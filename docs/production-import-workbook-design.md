# Production import workbook — draft for owner review

Input inspection: 9 October 2026. This is a proposed workbook contract, not an
implemented importer or authorization to populate a production database.

Subsequent implementation: the owner approved using the existing BasicUDIs.xlsx
parent reference. Workbook preparation is now implemented as documented in
[production-import-preparation.md](production-import-preparation.md). That utility
retains original template headers and values instead of consolidating them into
new canonical mappings. The database-import contract below remains proposed.

## Locations and scope

- Template workbooks: `data/prod/template/`.
- Accepted EUDAMED export XML: `data/prod/eudamed_xml/`.
- Dated workbook outputs: `data/prod/import_file/`.
- First output name proposal: `production-import-YYYYMMDD-HHMMSS.xlsx`.

Prepare the workbook first. Preserve originals and never overwrite earlier outputs.
Database import follows agreement of the accepted-state provenance and persistence
contract. Regeneration, automatic submission and M2M are deferred.

## Observed inputs

Eight workbooks contain 18 sheets and 9,710 populated data rows representing
9,708 distinct issuing-entity/UDI-DI identities. All inspected identity values are
14-digit strings with an issuer. This is an identity-format check, not complete
regulatory validation or a GTIN check-digit audit.

The 15 XML files contain 360 distinct device identities and no duplicate device
identities. Pages 0–7 contain 360 devices; pages 8–14 are empty responses beyond
the populated result set. Their envelope creation dates are 11 September 2026.
This establishes the supplied export's pagination, not live portal inventory.

Five identities appear in both populations. There are 9,703 template-only
identities and 355 XML-only identities. Consequently the potential combined
population is 10,063 unique identities, before resolving source conflicts.
Apply the owner's agreed classification: template-only means Not registered;
XML-present means Registered. A conflicted identity remains flagged for review.

Most template sheets have 35 core columns, some add an Other countries column,
and Accessories/Footspares include Basic UDI-DI. Header rows vary between rows 2
and 5. Preserve differing country text embedded in headers as well as cell values;
it must not disappear when consolidating sheets. Preserve any populated unnamed
columns and distinguish the two storage-condition Description columns.

## Proposed two-tab layout

Create only `To Register`, followed by `Registered`. Use filters, frozen headers,
wrapped header text and text formatting for identifiers and catalogue numbers.

Both tabs begin with these control and identity columns:

| Column | Source or purpose |
| --- | --- |
| Device Type | Explicit workbook/sheet mapping; XML model name for XML-only devices. Review generic Sheet1 mappings and mixed accessory populations. |
| Registration Status | Registered, Not registered, or Needs review. |
| Review Required; Review Reasons | Independent readiness/conflict information, including known Registered devices with incomplete Market Info metadata. |
| Issuing Entity; UDI-DI | Reconciliation key, retained as text. |
| Proposed Basic UDI-DI; Proposed Parent Issuer | Explicit template values or an owner-approved parent reference, with provenance. |
| Source Workbook; Source Sheet; Source Row | Template lineage; multiple sources retained for duplicate identities. |

Follow these with every proposed business field represented in the templates:
secondary UDI applicability, EMDN, trade name, language, catalogue number,
direct marking, quantity, production identifier type, status, clinical size,
single-use label, reuse applicability, sterilization, sterility, latex, CMR,
endocrine disruptors, storage applicability and both condition/comment pairs,
warning applicability and type, reprocessing, Annex XVI purpose, third-party
manufacture, clinical investigation, human/animal tissues, medicinal-product
checks, first-placement country and other-country information.

Preserve source column order where practical, using a union of the template
fields. Store the exact source headers, cell values, original data types and
all source occurrences in a dated companion audit file. Source fidelity must be
validated against every populated row and column, including conflicting duplicate
occurrences. Formula cells require preserving both the formula and the available
cached value; missing cached values must be reported.

`Registered` adds an explicitly labelled accepted-data block; proposed values
remain independently recoverable even when they differ from accepted values.

| Accepted columns | XML source |
| --- | --- |
| Accepted Basic UDI-DI; Parent Issuer | MDRBasicUDI identifier; verify consistency with MDRUDIDIData/basicUDIIdentifier. |
| Parent State; Parent Version; Parent Version Date | Direct MDRBasicUDI entity metadata. |
| Device State; Device Version; Device Version Date | Direct MDRUDIDIData entity metadata. |
| Market Info State; Market Info Version; Market Info Version Date | Direct marketInfos entity metadata; missing values stay blank. |
| Accepted Model; Risk Class; Manufacturer SRN; Representative SRN | MDRBasicUDI fields. |
| Accepted Parent Properties | Active, implantable, measuring, reusable and other supplied parent attributes, kept distinct from proposed fields. |
| Accepted Device Properties | Full supplied identifiers, catalogue, multilingual trade names, nomenclature, status, quantity, production identifier, flags, storage conditions and warnings. |
| Accepted Market Countries | Every country and its original-placement flag; preserve repeated structures without reducing them to one country string. |
| Export Filename; Page; Export Created At | XML file and envelope metadata. Label creation time precisely; do not invent an independent export timestamp. |
| Parent/Device Last Updated | Supplied XML lastUpdated values, separate from version dates. |
| Extracted At; Source SHA-256; Encoding Used | Preparation provenance, supplemented by the companion audit manifest. |

Use readable values for simple fields and structured JSON for repeated structures
that cannot be represented without loss in a single cell. Preserve the complete
source XML projection in the companion audit artifact and retain original XML.
Check Excel cell limits; never silently truncate source data or repeated values.
Exact final column labels and companion artifact format remain for owner review.

Proposed status colours: green for Registered, pale yellow for Not registered,
and amber for Needs review. Use the status text as the primary cue. Highlight
review reasons separately when registration is known but workflow data is missing.

## Issues requiring explicit resolution

1. Basic UDI-DI is absent on 9,363 template rows. The existing
   `data/basic_udi_reference/BasicUDIs.xlsx` covers many models, but its use as a
   production preparation source needs owner confirmation. Its POST/PATCH sheet
   names are source instructions, not evidence of accepted production versions.
   No parent-reference workbook was supplied in the new template folder.
2. Elan MAX and MAX Liner/Sleeve use generic Sheet1 tabs. The existing BasicUDI
   reference lacks those model names. Liner/sleeve rows may require more than one
   parent. Explicit parent identity/properties are needed; do not infer them from
   trade names or assign one parent to a mixed population without review.
3. EP-FSR and EP-MSR each occur in Accessories and Epirus. Their EMDN values
   differ (Y061299 versus Y062409), and only the accessory occurrence includes a
   parent identifier. These are conflicting source occurrences, not harmless
   duplicates. Preserve both, flag review and block their database import until
   resolved; never choose whichever file sorts first.
4. Three Registered Compact SAKL devices lack explicit Market Info state/version
   metadata. Preserve their country information and known registration, retain
   unknown Market Info versions and flag affected operations for review.
5. APP-DTX-000103944.xml and APP-DTX-000103948.xml fail parsing with their declared
   encoding and parse with Windows-1252. Require explicit, recorded per-file
   overrides; preserve originals and never fall back silently for arbitrary XML
   errors. Disable external entities and network resolution.
6. Accessories, Elan MAX and MAX Liner/Sleeve are represented in the supplied
   inputs but are not all covered by the current canonical XML workflow. Workbook
   coverage must include them; database/XML readiness must disclose unsupported
   mappings rather than silently exclude them or introduce new mappings.

## Proposed implementation and verification sequence

1. Agree parent-reference inputs, conflict handling and the column contract above.
2. Build a reusable preparation utility with explicit input/output paths, input
   hashes, namespace-aware XML parsing, logged encoding overrides, schema-aware
   extraction, deterministic reconciliation and dated output/audit files.
3. Validate every source occurrence is accounted for, each nonconflicting device
   appears on the proper tab, overlaps appear once, accepted/proposed fields are
   separate, unknown versions remain unknown, and identifiers retain leading zeros.
   Use synthetic tests for conflicts, missing metadata, multi-value preservation,
   parsing errors, sheet variations and output retention.
4. Generate and inspect the actual workbook and discrepancy report with the owner.
5. Agree production database import behavior: stable identities, separate proposed
   and accepted projections, export provenance, transaction boundaries, conflict
   blocking and protection against overwriting newer accepted state. Existing
   workbook import records source rows and rebuilds canonical projections in a
   subsequent transaction; it is not an atomic accepted-baseline importer.
6. Implement and rehearse database import with synthetic isolated SQLite databases,
   then review controlled population of the intended production database.

No generated acknowledgement, Playground event, ZIP review receipt or invented
accepted POST history may substitute for exported production acceptance evidence.
