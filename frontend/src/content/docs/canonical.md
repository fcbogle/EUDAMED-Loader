# Canonical

## Purpose

This tab is the review layer between workbook structure and XML generation. It shows how workbook fields and reference data are interpreted as stable regulatory meaning.

## Current Implementation

The review artifact covers:

- source sheet to product-variant linkage
- field-level canonical mappings
- direct, normalized, derived, repeated, and gap classifications
- schema-target references

The current domain concepts are:

- `Manufacturer`
- `BasicDevice`
- `DeviceRecord`
- `MarketAvailability`
- `StorageCondition`
- `CriticalWarning`

## Current Source Strategy

- workbook rows provide device-row evidence
- `BasicUDIs.xlsx` provides authoritative variant linkage and core Basic UDI context
- the legacy tracekey workbook still supplies SRN fallback values

## Important Note

The canonical review artifact is a review contract, not yet a strict runtime mirror of the declared Pydantic models. Some XML-facing field paths in validation/XML still use alternate names that should later be normalized.

Examples of current drift:

- `basic_device.type` vs `basic_device.device_type`
- `basic_device.administering_medicine` vs `basic_device.administering_medicinal_product`
- `basic_device.reusable` vs `basic_device.reusable_surgical_instrument`

## Current Scope

- `MDR` only
- first-phase focus: `UDI-DI` details and market information
- `Basic UDI` remains upstream context, not the primary first-phase upload object

## Current Output

- variant mapping review
- canonical mapping review
- visible assumptions and gaps
- schema-informed field targets
