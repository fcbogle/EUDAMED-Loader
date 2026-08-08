# XML Generation

## Purpose

The current XML UI now serves two related but distinct purposes:

- `EUDAMED Testing`
- `EUDAMED Generation`

`EUDAMED Testing` is used for preview, comparison, validation, and external testing support.

`EUDAMED Generation` is used for accepted-only generation patterns intended for real upload preparation.

## Current Mode Split

Inside `EUDAMED Testing`, the XML modes are now split into two groups.

### Shared Registered-Device Testing Modes

- `Post + Patch`
- `Patch XML`
- `Market Info`

These modes are tied to the same registered device anchor for the current selected testing record.

They are intended to model the state after successful device registration, where several follow-on XML operations should all relate to the same registered device.

Current `Patch XML` behavior is now more specific:

- require a reviewed `Post + Patch` pair for the selected record
- reuse the existing generated `Post + Patch` pair for that same selected record
- treat the first child `PATCH` from that pair as the baseline scenario source
- derive approved scenario PATCH drafts from that baseline

### General XML Tools

- `Single XML`
- `Batch XML`

These modes are not tied to the registered device anchor.

They remain general XML generation tools driven from the broader XML-ready validation selection model.

## Current Selection Model

### Shared Registered-Device Testing Modes

`Post + Patch`, `Patch XML`, and `Market Info` use the shared registered device anchor.

These testing modes now operate from the currently selected XML-ready parent `POST` record rather than from the old fixed Echelon VAC fixture anchor.

### General XML Tools

`Single XML` and `Batch XML` still start from:

- `Product Family`
- `Product Variant`

Selection then branches by mode:

- `Single XML` also requires one selected XML-ready record
- `Batch XML` generates all XML-ready records for the selected variant

## Current Supported Outputs

### Post + Patch

- accepted baseline `POST` preview
- equivalent first `PATCH` preview
- independent local XSD validation for both messages
- downloadable `.zip` containing both XML files and a manifest

### Patch XML

Current implementation:

- selected record resolves one parent `POST`
- `Post + Patch` must be generated and reviewed first for that exact record
- existing generated `Post + Patch` pair provides the baseline first `PATCH`
- user enters the version integer for the scenario PATCH draft
- user edits only approved scenario fields
- UI shows before/after business-field comparison before generation
- UI shows toggle-based XML comparison between baseline and derived PATCH
- generated candidate PATCH XML remains downloadable and locally validated

### Market Info

- standalone `MARKET_INFO.PUT` preview
- local XSD validation result
- downloadable `.xml`

### Single XML

- one selected XML-ready record preview
- local XSD validation result
- downloadable `.xml`

### Batch XML

- selected variant batch preview
- per-chunk validation result
- downloadable `.zip`

## Current Service Profiles

Accepted baseline `POST`:

- service `DEVICE.POST`
- payload root `device:Device`

Accepted baseline `PATCH`:

- service `UDI_DI.PATCH`
- payload root `device:UDIDIData`

Equivalent first `PATCH` test path:

- uses `UDI_DI.PATCH`
- forces `e:version = 2`
- keeps `marketInfos` identical to the equivalent `POST`

Scenario-derived later `PATCH` path:

- starts from the proven first child `PATCH`
- preserves the parent POST / baseline PATCH identity chain
- requires a user-supplied `e:version` integer
- changes only scenario-approved fields

Standalone `MARKET_INFO.PUT`:

- service `MARKET_INFO.PUT`
- payload root `mktinfo:DTXMarketInfo`
- uses `uDIDIIdentifier` to target one UDI-DI record

## Important Note

The XML layer now consumes a typed XML projection built from validation records and generated scenario inputs.

`Patch XML` is generated dynamically from the reviewed baseline pair for the selected record.

Some XML generation paths are now intentionally more conservative than others:

- shared-device testing paths are anchored to the selected reviewed baseline pair
- general XML tools still operate over broader XML-ready canonical validation scope

This is deliberate and matches the current staged testing approach.
