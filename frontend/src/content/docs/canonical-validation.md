# Canonical Validation

Updated 11 October 2026 to reflect the current Dev and Production application.

## Purpose

Canonical Validation helps you review imported device data, trace where values
came from, and identify missing information before preparing XML. It shows two
separate assessments:

- **Canonical completeness:** whether the broader application field set is populated.
- **XML readiness:** whether the data supports the current XML projection.

A device can have completeness gaps and still be XML-ready. XML readiness does
not establish registration status or replace message-specific checks and XSD
validation when XML is generated.

## Where the data comes from

The workspace reads the canonical projection stored in SQLite for the latest
import in the active environment. It does not reread the Excel files each time
you open the tab. Import data through **Submission Data** first.

| Environment | Import source | Validation scope |
| --- | --- | --- |
| Dev | Raw template workbooks and the configured Basic UDI reference | Rows covered by the existing Dev mapping; excluded or unmapped sheets remain outside the active scope. |
| Production | The prepared `production-import.xlsx` and matching audit file | Eligible rows from the prepared workbook, including registered export baselines and devices awaiting registration. Review-required and owner-excluded rows are omitted by the importer. |

The scope follows the imported records; it is not restricted to the original
five workbook families. Production uses the approved reference and source
lineage recorded during preparation. The older Dev reference configuration
remains separate.

See the [workbook guide](workbooks.md), [Production workbook contract](../../../../docs/production-import-workbook-design.md)
and [Production importer design](../../../../docs/production-importer-design.md).

## Reading the workspace

The top cards show source rows, rows in validation scope, canonical-ready rows,
XML-ready rows and distinct device subjects. Source-row counts and unique-device
counts measure different things.

Use **Search device models** or **Device Model** to narrow the view by family,
model or Basic UDI-DI. The selected scope shows completeness and XML-readiness
counts, followed by a sample device with its catalogue number and UDI-DI.

Two mapping views help explain the selected record:

- **Source Sheet to Basic UDI:** the source workbook/sheet, linked model, Basic UDI-DI, operation and mapping review notes. Production retains the original template lineage from preparation, even though the imported file is the shared prepared workbook.
- **Canonical Mapping:** source field, canonical path, current value, schema target, source classification and review notes.

Field-level evidence and structured previews show market countries, storage
conditions and critical warnings. Manufacturer and authorised representative
SRNs use the environment's configured actor settings where applicable; they
are also visible in the environment banner.

## Dev and Production labels

| What you see | Dev | Production |
| --- | --- | --- |
| Scope status | **Ready** or **Warning**, based on canonical completeness | **XML ready** or **XML blocked**, based on XML readiness |
| Broader missing information | **Canonical Blockers** / **Required Missing** | **Completeness Notes** / **Completeness Gaps** |
| Information preventing XML preparation | **XML Blockers** | **XML Blockers** |

An empty scope shows **Stop**. Production completeness notes preserve unknown
values without treating them as XML blockers. Missing XML-required values remain
blocking and are not relabelled as optional notes. The sample note list is a
short preview; its Production badge shows the full number of completeness notes
for that sample.

## Registered devices and missing information

Registration evidence and completeness are separate. A registered device may
lack fields expected by the broader canonical model, particularly when its
record comes from an exported EUDAMED baseline rather than a current template.
Missing values do not undo its recorded registration.

In the October 10 Production review, 350 registered export-derived devices had
nine remaining completeness gaps each: **3,150 missing-field messages across
350 devices**, not 3,150 devices. The gaps covered Annex XVI, clinical
investigation, clinical-size applicability, maximum-reuse applicability, CMR,
endocrine disruptors, human tissue, animal tissue and human blood/plasma-derived
substances. These were nonblocking completeness notes for those records.

The duplicate market-status completeness gap was resolved using the same
explicit UDI-DI status from the supplied export. No unknown flags were defaulted
to No or inferred from a different regulatory field. The existing Production
snapshot is enriched when read; that correction does not require reimport.

That dated review contained 10,026 records: 10,024 XML-ready and two XML-blocked
Echelon records sharing catalogue number `EC27LN7S`. These figures are historical
findings; use the current UI for today's counts.

## What to do next

Review **XML Blockers** before attempting generation. Use completeness notes to
identify information to obtain from the responsible data owner, then update the
appropriate source and follow the reviewed import process. Changing a source
file alone does not refresh the saved import.

Check **Registration State** and **Parents & Children** for recorded acceptance
and parent prerequisites. The XML workspace applies operation-specific checks
for POST, child POST, PATCH and Market Info, including accepted-state and version
requirements. XSD validation is performed on the generated message.

See [Registration counts and evidence](../../../../docs/registration-counts.md)
and [XML generation](xml-generation.md).

## Model boundary

The validation field contract is not a strict one-to-one reflection of the
Pydantic canonical models. Some XML-facing aliases remain in the validation and
XML layers. Mapping evidence and generation checks must be read alongside
completeness results.
