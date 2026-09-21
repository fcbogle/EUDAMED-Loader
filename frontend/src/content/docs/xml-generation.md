# XML Generation

## Purpose

The XML workspace supports controlled EUDAMED preparation, local schema validation, Playground testing, and capture of confirmed successful outcomes.

Two related top-level areas remain:

- `EUDAMED Testing`
- `EUDAMED Generation`

`EUDAMED Testing` is the active operational workspace for assessment, preview, validation, export, and success capture.

`EUDAMED Generation` remains the accepted-only generation area.

## Current Mode Split

Inside `EUDAMED Testing`, the active XML modes are:

- `POST`
- `Patch XML`
- `Market Info`
- `Bulk Basic UDI-DI POST`
- `Bulk Device UDI-DI POST`
- `Bulk PATCH`

These modes are intentionally separate because they represent different regulatory actions and different lineage rules.

## Current Selection Model

The XML workflows use a single `Device Model` selector. Each model represents an existing Product Family / Product Variant pair; for example, `Echelon VAC` can be selected directly without first selecting `Echelon`.

The usual flow is:

1. Find a model by name, family or Basic UDI-DI; optionally narrow the list by family.
2. Select the `Device Model` row to set the family and variant together. Searching the list alone does not change the active selection.
3. Let the backend assess the tracked operational state for the selected model and operation.
4. Choose any operation-specific device, parent or bulk scope, then generate XML for the eligible selection. Single POST resolves the next eligible candidate; PATCH and Market Info preserve the selected device and its accepted lineage.

This selector is shared by Single POST, Single PATCH, Single Market Info, Bulk POST, Bulk PATCH and Bulk Market Info. It changes the selection UI, not the underlying family/variant fields or database structure.

Backend assessment still determines eligibility:

- a `POST` may need to seed a new Basic UDI-DI parent registration
- a `POST` may instead register the next eligible child Device UDI-DI under an accepted parent
- a `PATCH` requires the selected device's tracked accepted lineage
- Market Info and bulk operations retain their own registration, version and scope rules

## Current Supported Outputs

### `POST`

Single `POST` now supports both regulatory shapes through one workspace:

- Basic UDI-DI parent-seeding `POST`
- Device UDI-DI child `POST`

The workspace explains which shape is currently available for the selected family/variant and generates only the next eligible candidate.

### `Patch XML`

Single `PATCH` is a controlled scenario workspace:

- one next eligible accepted-state device at a time
- scenario-based edits only
- local validation and download
- success-XML upload to advance tracked device state

Derived `PATCH` XML builds from the latest successful tracked version for that device.

### `Market Info`

`Market Info` remains a separate operation and should not be collapsed into the `POST` or `PATCH` workspaces.

### `Bulk Basic UDI-DI POST`

This mode creates parent-only registration packages.

### `Bulk Device UDI-DI POST`

This mode creates child-only registration packages under an already tracked Basic UDI-DI parent.

### `Bulk PATCH`

This mode creates PATCH packages derived from tracked accepted device state. Bulk scope is controlled through operational selection, such as:

- all posted devices in scope
- next N devices
- selected catalogue numbers
- imported catalogue list

## Current Service Profiles

Current service profiles in active use include:

- parent or child registration through `POST`
- `UDI_DI.PATCH`
- `MARKET_INFO.PUT`

The exact generated XML shape depends on the assessed operation and current tracked state, not only on the selected family/variant.

## Success XML

Successful Playground outcomes can now be recorded through the success-XML upload workflow.

Current supported success capture includes:

- successful single `POST`
- successful bulk `POST`
- successful single `PATCH`
- successful bulk `PATCH`

Success capture updates SQLite-backed operational state, including latest successful version and next-operation availability.

## Important Note

The current XML layer is tied directly to the operational state model.

It is therefore no longer accurate to describe XML generation as a stateless preview utility. Candidate resolution, version lineage, remaining counts, and next available actions all depend on the tracked SQLite state.
