# Architecture Position

## Current Implementation

The scaffold is a preparation and review application, not a submission platform yet.

Current implemented flow:

`Excel review -> Canonical review -> Canonical validation -> XML preview/download`

What exists now:

- multi-family workbook profiling
- variant-level linkage to `BasicUDIs.xlsx`
- canonical mapping review artifacts
- validation summaries and sample-row evidence
- XML preview, batch preview, XSD validation, and download

What does not exist yet:

- submission history
- manual upload workflow tracking
- database persistence
- M2M / AS4 transport

## Architectural Direction

The intended long-term split is:

1. `Preparation`
2. `Submission`
3. `Delivery`
4. `History`

The current codebase is mostly in `Preparation`, with an initial XML assembly slice that should later become a proper `Submission` layer.

## Current Constraints

- `Template for Accessories_Footspares EUDAMED.xlsx` is visible but excluded from active variant mapping.
- `BasicUDIs.xlsx` is the authoritative variant reference source.
- manufacturer SRN and authorised representative SRN are still supplemented from the legacy tracekey workbook.
- field naming is not fully normalized between the declared canonical model and the XML-facing validation contract.

## Near-Term Direction

- keep workbook parsing, canonical review, validation, and XML generation separate
- reduce naming drift between canonical models and XML-facing field paths
- keep XML profiles explicit by scenario
- avoid adding delivery logic before submission objects are defined
