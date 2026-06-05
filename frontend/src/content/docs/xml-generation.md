# XML Generation

## Purpose

This tab generates XML previews and downloads from XML-ready validation records.

## Current Implementation

Single-record and batch generation both start from:

- `Product Family`
- `Product Variant`

The current scaffold supports:

- single-record preview/download
- variant-batch preview/download
- paired `POST` + equivalent first `PATCH` preview/download for one current POST-classified device
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

## Important Note

The XML layer currently consumes an XML-facing field contract derived from validation records. That contract is close to, but not yet identical with, the declared Pydantic canonical model names.

## Current Output

- XML preview
- schema validation result
- downloadable `.xml`
- downloadable batch `.zip`
- downloadable paired `POST`/`PATCH` `.zip`
