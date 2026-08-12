# Testing Scenarios

## Purpose

This note distinguishes between:

- what the current XML layer can already generate and validate locally
- what is currently implemented only as a technical comparison scaffold
- what still needs QMS confirmation before it becomes a realistic business test scenario

## Current Evidence Levels

The current XML work sits at different levels of confidence:

- `Implemented and locally validated`
  - current `DEVICE.POST` single-record generation
  - current variant-batch generation
  - current standalone `MARKET_INFO.PUT` single-record generation
  - local schema validation against `data/schemas/service/Message.xsd`
- `Implemented as comparison scaffold`
  - equivalent first `UDI_DI.PATCH`
  - paired `POST`/`PATCH` comparison where `marketInfos` is intentionally kept identical
- `Still needs business/QMS confirmation`
  - what realistic UDI-DI update scenarios should actually exist after initial registration

## Proven Working Now

Current XML generation has already demonstrated:

- one record can be rendered as a `DEVICE.POST` payload
- one record can be rendered as a standalone `MARKET_INFO.PUT` payload
- many XML-ready records can be rendered in batch for one selected variant scope
- generated messages can be validated locally against the current message/XSD pack

This means the current project has proven create-path rendering and local XSD validation for the current `POST` path.

## Current PATCH Scaffold

The current `PATCH` pairing should be read as a technical scaffold, not yet as a confirmed business update scenario.

Current paired behavior:

- start from one XML-ready `POST`-classified device record
- generate one corresponding equivalent first `PATCH`
- keep the `PATCH` structurally close to the `POST`
- keep `marketInfos` identical between the two messages for comparison

This proves:

- the renderer can express the same device record as an update message
- the paired messages can be compared structurally
- the update-side payload can validate locally

This does **not** yet prove:

- which business changes should realistically be performed through `UDI_DI.PATCH`
- whether normal market-information changes should stay in `PATCH`
- whether the current pair represents a real operational update scenario

## Why Testing Needs QMS Input

Schema-valid output is not enough to define a meaningful business test.

For update scenarios, QMS needs to confirm:

- which fields may legitimately change after first device registration
- whether those changes should be modeled through `UDI_DI.PATCH`
- whether they should instead be handled through `MARKET_INFO.PUT`
- whether a “first equivalent PATCH” is useful outside technical comparison testing

Without those decisions, a `PATCH` test can be technically correct but still business-irrelevant.

## Key Business Question For PATCH

If `marketInfos` remains static in the paired `PATCH` test, then what is `PATCH` actually for from a business perspective?

Current answer:

- today, the paired `PATCH` mainly proves update-message rendering and comparison behavior
- it does not yet prove a meaningful post-registration business change scenario

That means the project now needs at least one realistic update scenario, not only a structural pair.

## Candidate Realistic PATCH Scenarios

These are candidate scenarios only. They still need QMS confirmation before being treated as true business test cases:

- change to quantity or base quantity
- change to UDI-PI related configuration
- change to sterile / sterilisation / reprocessed / latex flags
- change to trade-name or language-supported descriptive content
- change to warnings or storage conditions if those are treated as updateable device details

Current implemented single-scenario PATCH catalogue:

- `Equivalent First Patch`
  - `e:version = 2`
  - no business-field change
- `Trade Name Edit`
  - free-text replacement
  - example:
    - before: `ELANIC 22L CAT1 -EXT.FOOT PROSTHESIS`
    - after: `ELANIC 22L CAT1 -EXT.FOOT PROSTHESIS UPDATED`
- `Critical Warnings`
  - warning code plus optional comment
  - example:
    - before: `CW010`
    - after: `CW011`
- `Storage Condition Edit`
  - replacement comment for existing storage-condition codes
  - example:
    - `SHC006` from `Minus 15C` to `Store in a dry location`
- `Base Quantity`
  - positive integer only
  - examples:
    - `1`
    - `2`
    - `10`
- `Sterile`
  - boolean only
  - values:
    - `true`
    - `false`
- `Latex`
  - boolean only
  - values:
    - `true`
    - `false`
- `Status Code`
  - controlled enum
  - values:
    - `NOT_INTENDED_FOR_EU_MARKET`
    - `ON_THE_MARKET`
    - `NO_LONGER_PLACED_ON_THE_MARKET`

Design-only next scenarios still not implemented:

- `Production Identifier`
  - one or more of:
    - `BATCH_NUMBER`
    - `SOFTWARE_IDENTIFICATION`
    - `SERIALISATION_NUMBER`
    - `EXPIRATION_DATE`
    - `MANUFACTURING_DATE`
- `Sterilization`
  - `true` / `false`
- `Reprocessed`
  - `true` / `false`
- `Number Of Reuses`
  - `-1`
  - `0`
  - positive integer
- `MDN Codes`
  - one or more valid nomenclature codes

The point of this list is not to assume these are valid. The point is to give QMS a concrete set of questions to confirm or reject.

## Market Information Testing

Current market-info testing position:

- `marketInfos` is already rendered inside the current `POST`
- the equivalent first `PATCH` intentionally repeats the same `marketInfos` structure
- this is currently a comparison/test-path decision

This leaves two different test intentions:

1. comparison-only scenario
- `POST` and equivalent first `PATCH`
- `marketInfos` unchanged
- proves structural parity

2. real market-info change scenario
- country list, first-market flag, or date-related market-info changes
- current implemented candidate for `MARKET_INFO.PUT`, still needing QMS confirmation for realistic business use

## QMS Decisions Needed

The following questions should be explicitly answered by QMS or the business owner before deeper update-path implementation:

- Which UDI-DI fields are realistically expected to change after initial registration?
- Which of those changes should be represented as `UDI_DI.PATCH`?
- Which market-information changes should instead use `MARKET_INFO.PUT`?
- Is the first-equivalent `PATCH` only a technical regression scenario, or should it become part of a real business workflow?
- Which update scenarios are important enough to become named regression tests in the project?

## Open Requirement: Record-Level PATCH Targeting

One additional open requirement sits behind any future standalone `PATCH` workflow:

- does the intended operating model require users to generate or inspect update messages for individually selected UDI-DI records across the full validated population, rather than only through family/variant-scoped review and batch workflows?

This matters because the current XML workspace is variant-scoped. It supports:

- representative single-record review
- paired `POST` / equivalent `PATCH` comparison
- variant-scoped batch generation

It does **not** yet provide direct access to every potential update target across the full current dataset of more than 8,000 distinct UDI-DI records.

If QMS confirms that direct record-level targeting is required, the likely UI consequence is:

- searchable selection by `UDI-DI`
- searchable selection by `catalogue_number`
- possibly additional search by trade name or related business reference

If QMS does **not** confirm this requirement, then the current family/variant-scoped XML workflow may remain sufficient and no large record-search UI should be added.

## Recommended Test Matrix

### 1. Technical baseline

- `DEVICE.POST` single-record generation
- variant batch generation
- local schema validation

### 2. Structural update baseline

- equivalent first `PATCH`
- identical `marketInfos` between paired `POST` and `PATCH`

### 3. Business-meaningful update scenarios

Add only after QMS confirmation:

- one realistic UDI-DI patch scenario
- one realistic market-info-only update scenario
- one scenario clarifying whether first EU market country changes belong in `UDI_DI.PATCH` or another update flow

## Summary

- current `POST` support is proven locally
- current paired `PATCH` is useful, but mainly as a comparison scaffold
- current `marketInfos` duplication between paired `POST` and `PATCH` is intentional for testing
- realistic update-path testing now depends on QMS decisions about what the business actually needs to change after registration
