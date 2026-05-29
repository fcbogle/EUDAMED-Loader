# Architecture Position

## Purpose

This note records the current architectural position for the EUDAMED preparation platform. It is intended to guide near-term implementation choices so the application remains usable for the current in-scope non-accessories product families while staying extensible for future `Playground`, `manual upload`, and `M2M / AS4` delivery modes.

## Current Reality

The application is now designed to support multiple in-scope non-accessories product families through a shared preparation model. Workbook review and canonical mapping use variant-level `Basic UDI-DI` linkage from the authoritative `BasicUDIs.xlsx` workbook, so the same preparation approach can be applied across the current family set rather than being tied to one product line.

In practical terms:

- `Workbooks` supports review of the in-scope product-family workbooks as a shared intake set
- `Canonical` supports variant-level Basic UDI linkage and field-level mapping across that same scope
- `Canonical Validation` now supports family-aware and variant-aware readiness review across that same scope
- `XML Generation` now operates at `Product Variant` level within each product family for both:
  - `Single XML`
  - `Variant Batch XML`

The current family scope should be understood explicitly:

- in scope:
  - `Echelon`
  - `Elan`
  - `Elite`
  - `Epirus / Esprit`
  - `Navigator / Javelin / Linx`
- currently out of scope:
  - `Template for Accessories_Footspares EUDAMED.xlsx`
  - this workbook is deliberately excluded from active variant mapping while awaiting QMS mapping rules for accessories and footspares
  - those QMS rules are expected shortly

## Architectural Bias

The preferred direction is to treat the application as a layered submission-preparation platform rather than an XML script with a UI.

The bias is toward four clear layers:

1. `Preparation Layer`
2. `Submission Layer`
3. `Delivery Layer`
4. `History Layer`

This is the simplest structure that still fits the real future needs of:

- controlled manual upload
- Playground-oriented review and dry-run workflows
- future M2M / AS4 submission
- historic retention and auditability

## Preparation Layer

The `Preparation Layer` is responsible for turning source evidence into validated regulatory meaning.

It should include:

- source workbook ingestion and profiling
- normalization rules
- canonical mapping
- enrichment from supporting sources such as `Basic UDI-DI` reference data
- data-quality checks
- canonical validation and readiness assessment

This layer should answer questions such as:

- what source records exist
- how complete they are
- what controlled value normalization has been applied
- which records are ready to proceed
- which records are blocked and why

It should not know anything about:

- manual upload workflows
- Playground transport behavior
- AS4 envelopes
- transport receipts

## Submission Layer

The `Submission Layer` should convert validated canonical records into explicit submission objects.

This layer is where the application should become deliberate about:

- what a submit-ready unit is
- how records are grouped into batches
- how the `300 records per batch` limit is enforced
- how artifacts are generated deterministically
- how a manifest is produced for review and later audit

This layer should introduce stable objects such as:

- `SubmissionUnit`
- `SubmissionBatch`
- `SubmissionArtifact`
- `SubmissionManifest`

The important position here is that these models should remain environment-agnostic.

For example:

- a `SubmissionBatch` should describe the records grouped for submission
- a `SubmissionArtifact` should describe the generated XML or package output
- neither object should care whether the next step is `Playground`, `manual`, or `M2M / AS4`

The batch-size rule should live here, not in UI code and not inside transport logic.

## Delivery Layer

The `Delivery Layer` should be responsible for handling an already-generated submission artifact.

Its responsibility is not to reinterpret business meaning, and not to rebuild the XML payload. Its job is to decide how a finished artifact is handled in a given environment.

Likely concerns include:

- Playground preview or dry-run handling
- manual package export
- future M2M / AS4 delivery
- transport message wrapping where needed
- receipt or response parsing
- immediate delivery outcome reporting

This suggests an adapter-style design, for example:

- `PlaygroundTransportAdapter`
- `ManualTransportAdapter`
- `As4TransportAdapter`

The configuration should select the active delivery mode, but the submission objects should remain stable underneath that switch.

## History Layer

The `History Layer` should preserve what happened to a submission over time.

This layer is important because the application is expected to support controlled upload and historic retention across more than one delivery mode.

Likely concepts include:

- `SubmissionAttempt`
- `SubmissionResult`
- `TransportReceipt`
- `AuditEvent`
- batch-level and object-level statuses

The bias here should be toward append-oriented traceability rather than replacing prior state without evidence.

This matters because future manual, Playground, and M2M flows should all be traceable in a common way.

## Environment Switching

Environment-based switching makes sense, but it should be applied to workflow wiring and delivery adapters rather than embedded inside the core batch or artifact models.

A better pattern is:

- configuration selects the active submission mode
- the application resolves the correct delivery adapter
- the same `SubmissionBatch` and `SubmissionArtifact` pass through that selected adapter

Example configuration intent:

- `EUDAMED_SUBMISSION_MODE=playground`
- `EUDAMED_SUBMISSION_MODE=manual`
- `EUDAMED_SUBMISSION_MODE=m2m_as4`

The key principle is:

- switch delivery behavior by configuration
- keep submission meaning stable in the domain models

## Software Engineering Principles That Fit This Design

The following principles fit the current and future needs of the application.

### Single Responsibility Principle

Each layer should have a narrow and defensible concern.

- preparation should prepare
- submission should assemble
- delivery should deliver
- history should record

### Open/Closed Principle

The architecture should allow extension without repeated rewrites of the core flow.

Examples:

- add a new transport adapter without rewriting canonical mapping
- add a new schema profile without rewriting workbook profiling
- add a new product family mapping without rewriting delivery behavior

### Dependency Inversion

Higher-level workflow code should depend on abstractions for delivery and response handling rather than directly on one concrete transport path.

### Stable Core, Variable Edges

The core objects should remain stable:

- canonical records
- submission units
- submission batches
- submission artifacts
- validation and audit structures

The edges can vary:

- family-specific mapping/enrichment
- schema-specific rendering
- manual transport
- Playground handling
- future AS4 delivery

## Anti-Patterns To Avoid

The following patterns would likely create refactoring pressure later.

- putting transport-specific behavior inside canonical models
- making XML generation depend directly on UI workflow assumptions
- hard-coding the `300` batch rule inside frontend behavior
- treating Playground as a special one-off path unrelated to later delivery
- coupling audit history only to M2M and not to manual or Playground modes
- assuming the Echelon family shape is the universal shape for all future families

## Immediate Constraint: End-To-End Path Still Needs Hardening

The current end-to-end path is now generalized across the current in-scope non-accessories family set, but it still needs architectural hardening.

The present limitation is no longer family scope. It is that the new generalized path still coexists with legacy Echelon-specific services and has not yet been fully simplified into one durable submission path.

That means the application is currently proving:

- broader family-aware workbook review and canonical mapping
- family-aware canonical validation
- product-variant-based single and batch XML generation

It is not yet fully proving:

- removal of legacy Echelon-only XML code
- clean separation between preparation concerns and submission-assembly concerns
- stable artifact/package conventions for later manual upload and future delivery modes

## Likely Next Step

Before major refinement of the full `Preparation -> Submission -> Delivery -> History` model, the likely next step is to harden and simplify the current generalized end-to-end path.

That matters because it will expose whether:

- the aligned canonical field set is now stable enough to remain the long-term XML source contract
- enrichment rules remain defensible across the full in-scope family set
- batch assembly inputs and file/package naming are stable across variants
- legacy Echelon-specific code can now be removed without losing useful behavior
- later manual-upload and future delivery workflows can consume the same submission artifacts

In other words, the next major architectural learning may come less from AS4 planning and more from simplifying the generalized validation/XML path into a durable submission layer.

## Recommended Near-Term Direction

The recommended direction is:

1. remove or retire the legacy Echelon-only validation and XML paths once the generic path is fully reviewed
2. separate `Submission Layer` concerns from the current XML-generation service
3. introduce explicit submission models before implementing transport expansion
4. add delivery-mode switching through configuration and adapter selection
5. design history tracking so manual, Playground, and future M2M flows can share the same audit model
6. keep accessories out of active scope until QMS provides the missing mapping rules

## Position Summary

The architecture should be judged by whether it keeps future change localized.

The desired outcome is that:

- additional product families can pass through the same preparation logic with limited family-specific extensions
- batches of `300` can be assembled and reviewed consistently
- the same submission artifacts can support Playground, manual, and later M2M paths
- historical retention can be applied consistently across all delivery modes

That is the standard for being materially better than a one-off Excel-to-XML script.
