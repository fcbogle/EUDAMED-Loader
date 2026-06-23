# EUDAMED Service Contract Findings

## Purpose

This note records the small set of XML findings that still drive the current scaffold.

## Current Baseline

- schema pack: `3.0.30`
- message version: `3.0.30`
- default `POST` service: `DEVICE`
- default `PATCH` service: `UDI_DI`

## Current Payload Profiles

Default `POST`:

- `DEVICE.POST`
- payload root `device:Device`
- includes `device:MDRBasicUDI`
- includes `device:MDRUDIDIData`

Default `PATCH`:

- `UDI_DI.PATCH`
- payload root `device:UDIDIData`
- includes lifecycle fields such as `e:state`
- includes `e:version` when available

Equivalent first PATCH test path:

- forces `e:version = 2`
- keeps `marketInfos` identical to the equivalent `POST`

Scenario-derived later PATCH path:

- inherits from the proven first child `PATCH`
- requires an explicit user-supplied `e:version` integer
- should not silently auto-increment version in local generation logic

## Working Interpretation

- local XSD validity is necessary but not sufficient
- service contract matters separately from schema validity
- the scaffold should keep XML profiles explicit by scenario, not assume one PATCH shape fits every case
