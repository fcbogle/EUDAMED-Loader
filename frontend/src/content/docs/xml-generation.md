# XML Generation

## Purpose

This tab generates XML previews and downloads from XML-ready validation records.
It supports three review modes:

- single-record XML
- paired `POST` plus equivalent first `PATCH`
- variant-batch XML

## Current Implementation

All XML generation starts from:

- `Product Family`
- `Product Variant`

Selection then branches by mode:

- single-record mode also requires a `Catalogue Number`
- paired `POST`/`PATCH` mode also requires a `Catalogue Number`
- batch mode generates all XML-ready records for the selected variant

The current scaffold supports:

- single-record preview/download
- variant-batch preview/download
- paired `POST` + equivalent first `PATCH` preview/download for one XML-ready POST-classified device
- local XSD validation against `data/schemas/service/Message.xsd`

## Current Service Profiles

Default `POST`:

- service `DEVICE.POST`
- payload root `device:Device`
- includes `MDRBasicUDI` and `MDRUDIDIData`

Default `PATCH`:

- service `UDI_DI.PATCH`
- payload root `device:UDIDIData`

Equivalent first `PATCH` test path:

- uses `UDI_DI.PATCH`
- forces `e:version = 2`
- keeps `marketInfos` identical to the equivalent `POST`
- intentionally emits the same `marketInfos` structure in both messages for test comparison, even though later standalone market-information maintenance may move to a separate service flow
- is generated only when the selected device is currently classified as `POST`

## Paired POST/PATCH Output

The paired review path is intended to compare the first update message against the equivalent initial create message for the same device.

For the current test path, `marketInfos` handling is deliberately conservative:

- the `POST` includes the current `marketInfos` structure
- the equivalent first `PATCH` repeats that same `marketInfos` structure unchanged
- this makes structural comparison easier while the future `MARKET_INFO` service contract is still being finalized

Current paired output includes:

- a `POST` XML preview
- a `PATCH` XML preview
- independent local XSD validation results for both messages
- a downloadable `.zip` containing both XML files and a manifest

## Important Note

The XML layer currently consumes a typed XML projection built from validation records. Most field names now align with the declared Pydantic canonical model, but some compatibility fields, derived values, and XML-specific aggregated structures still sit between the canonical layer and the final XSD-facing payload.

## Current Output

- XML preview
- schema validation result
- downloadable `.xml`
- downloadable batch `.zip`
- downloadable paired `POST`/`PATCH` `.zip`
