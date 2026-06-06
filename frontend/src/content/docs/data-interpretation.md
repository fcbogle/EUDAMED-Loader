# Data Interpretation

## Purpose

This note explains how the current workbook rows should be interpreted as regulatory device records, and what the current XML generation flows are actually targeting.

## Identity Levels

The current data needs to be read at several levels:

- `Product Family`
  - UI and review grouping such as `Elan`, `Echelon`, or `Elite`
- `Product Variant`
  - variant-level grouping such as `Elan IC` or `Echelon VT`
- `Basic UDI-DI`
  - shared regulatory parent context for many related UDI-DI records
- `UDI-DI`
  - the individual registered device record identity targeted by current XML messages
- physical manufactured unit
  - not the main target of current registration messages; this would be distinguished by production identifiers such as serial or batch context

## Current Dataset Reading

The current in-scope workbook set contains:

- `8424` in-scope device rows
- `8424` distinct primary `UDI-DI` values
- `14` distinct Basic UDI identifiers

This means the current source set is effectively modeling:

- a relatively small number of shared Basic UDI groups
- a much larger number of distinct UDI-DI-level registerable product configurations underneath them

In practical terms, each unique UDI-DI in the current source scope can be treated as one distinct registerable device configuration. That is close to a manufacture-ready definition, even though the stricter regulatory interpretation is a UDI-DI device-registration record rather than an individual physical unit.

## Basic UDI And UDI-DI

The Basic UDI-DI is shared context.

Example:

- `GS1:5050649ELANICNM`

This is not the unique identifier for one device row. It is the shared Basic UDI context for many Elan IC UDI-DI records.

The UDI-DI is the row-level EUDAMED device-record identity.

Example:

- `ELANIC22L1S` -> `GS1:05050649096501`
- `ELANIC22L1SD` -> `GS1:05050649098291`

Both records can share the same Basic UDI while still having different UDI-DIs.

## What Current XML Generation Targets

Current XML generation targets one individual UDI-DI device record at a time.

That means:

- `POST` targets one individual UDI-DI device record being created
- `PATCH` targets one individual UDI-DI device record being updated
- `BATCH` generation is only a packaging convenience that emits many record-level messages for one selected variant scope

So the batch scope is variant-level, but the message scope remains record-level.

## Selection Keys In The App

The current app typically selects a record using:

- `Product Family`
- `Product Variant`
- `Catalogue Number`

But the actual EUDAMED-facing record identity inside the XML is the UDI-DI identifier, not the catalogue number.

Current working distinction:

- `catalogue_number`
  - business/source reference and app selection aid
- `udidi:identifier`
  - the actual UDI-DI record identity in XML
- `udidi:basicUDIIdentifier`
  - the shared Basic UDI parent context

## Current POST/PATCH Pairing

The current paired XML path is a test and comparison flow.

It does not claim that all future update behavior should be modeled this way.

Current pair behavior:

- generate one `POST` message for a current XML-ready POST-classified record
- generate one equivalent first `PATCH` message for the same record
- keep the `PATCH` structurally close to the `POST` for comparison

This is useful for validating the first-update representation alongside the now-separate standalone market-info service flow.

## Current MarketInfos Handling

Within the current `POST` and equivalent first `PATCH`, `marketInfos` is rendered as a repeated child collection inside the UDI-DI payload.

For the current paired test path:

- the `POST` includes the current `marketInfos` structure
- the equivalent first `PATCH` intentionally repeats the same `marketInfos` structure unchanged
- this is a deliberate comparison/testing choice

So the current pairing logic treats `marketInfos` as part of the equivalent first update representation, even though a separate standalone market-information message flow now also exists in the XML layer.

## Future Market Information Direction

The current evidence and implementation now support a separate market-information service path:

- `MARKET_INFO`
- operation `PUT`
- payload entity `DTXMarketInfo`

That future service still appears to target one UDI-DI record at a time, identified by `uDIDIIdentifier`, but it targets that record's market-information collection rather than the broader UDI-DI representation.

So the likely long-term interpretation is:

- `POST` and `UDI_DI.PATCH` operate on one UDI-DI device record
- `MARKET_INFO.PUT` operates on one UDI-DI device record's market-info collection

## Summary

- family and variant are grouping scopes in the app
- Basic UDI-DI is shared parent regulatory context
- UDI-DI is the current record-level XML target
- batch generation groups many record-level messages under one variant selection
- paired `POST`/`PATCH` generation is currently a structural comparison flow
- current `marketInfos` duplication between paired `POST` and `PATCH` is intentional for testing, not yet the final standalone market-info design
