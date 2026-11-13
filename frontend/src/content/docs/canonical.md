# Canonical Interpretation

Updated 1 November 2026. The canonical layer separates source evidence from the
regulatory meaning used by validation, operation assessment and XML projection.

## Current implementation

The review covers source-sheet/model/Basic UDI linkage, field mappings,
direct/normalized/derived/repeated values, schema targets and visible gaps.
Domain concepts include Manufacturer, BasicDevice, DeviceRecord,
MarketAvailability, StorageCondition and CriticalWarning.

Current emitted validation field paths are checked against the declared canonical
model vocabulary. For example, basic_device.device_type,
basic_device.administering_medicinal_product and
basic_device.reusable_surgical_instrument are the current names. Older examples
using type, administering_medicine or reusable are not the current emitted paths.
This does not claim every legacy alias or text-matched identity path is removed,
or that the canonical model is identical to the XML transport representation.

## Source and environment scope

The new Dev Import Data workflow retains uploaded Templates, BasicUDI reference
and EUDAMED extracts with a manifest, review and workbook/audit. The legacy Dev
raw-template importer remains available separately. Its configured BasicUDIs.xlsx
and historical fallback handling must not be assumed to define every import path.
Production uses its own approved preparation inputs and configured workbook/audit.
Actor settings and accepted export evidence must belong to the active environment;
legacy Playground/tracekey values must not fill Production actor gaps.

Canonical records retain source lineage and proposed business values. Explicit
export-baseline import can separately record accepted evidence; raw workbook
values or POST/PATCH source labels do not prove registration. Existing accepted
history is protected by the applicable import and acknowledgement rules.

## Identity and supported scope

Device identity includes issuing entity plus UDI-DI; parent identity includes
issuing entity plus Basic UDI-DI. Family, model and catalogue names are review and
selection context, not substitutes for regulatory identifiers. Parent seeding,
child registration, device PATCH and Market Info are distinct supported flows.
The parent-only bulk operation is retained as a separate backend/API capability.

See [Canonical Validation](canonical-validation.md), [Data Interpretation](data-interpretation.md)
and [Import Data in Dev](../../../../docs/source-batch-receipt.md). Completeness,
XML readiness and recorded registration remain separate assessments.
