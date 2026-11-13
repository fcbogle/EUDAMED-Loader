# Submission Data And Source Workbooks

Updated 1 November 2026. Submission Data reads the active environment's saved
SQLite data and import monitoring; source-file changes do not automatically
replace the current canonical snapshot.

## Current workspace

Data Snapshot and EUDAMED Activity views expose the saved submission population,
import information, database tables/health and source lineage. Source-oriented
profiling remains useful for inspecting workbook sheets, columns, samples,
distinct values and normalization evidence; it is not the entire operational
workspace and is not proof of EUDAMED registration.

## Import paths

For the current Dev feature use **Import Management → Import Data**: review the
uploaded Templates, BasicUDI reference and XML extracts, create the batch/workbook,
then confirm database import. Progress saves automatically. The retained legacy
Dev raw-template import is a separate Submission Data operation.

Production continues to use its configured prepared workbook/audit and assessed
confirmation flow. Do not use the Dev upload instructions to replace Production
inputs or move its database. See [Dev import guide](../../../../docs/source-batch-receipt.md)
and [Production importer](../../../../docs/production-importer-design.md).

## Source scope and lineage

The legacy active Dev mapping covers Echelon, Elan, Elite, Epirus/Esprit and
Navigator/Javelin/Linx. Accessories/Footspares is retained evidence but excluded
from that preparation scope. New Dev batches retain the configured exclusions;
Production follows its approved prepared scope and owner exclusions.

Use filenames, sheets, rows and issuer-qualified identifiers to trace values.
The new Dev review blocks duplicate Template UDI-DIs and unresolved catalogue
collisions; optional information and ordinary value differences can warn.
Import eligibility, canonical completeness, XML readiness and registration status
must be read separately. See [Canonical Validation](canonical-validation.md).
