# Architecture Position

## Purpose

This note records the current architectural position for the EUDAMED preparation platform. It is intended to guide near-term implementation choices so the application remains usable for the current `Echelon` family scope while staying extensible for future `Playground`, `manual upload`, and `M2M / AS4` delivery modes.

## Current Reality

The current pipeline already proves an important point: the application can inspect workbook data, normalize values, enrich records with `Basic UDI-DI` context, validate canonical readiness, and generate schema-valid XML batch packages.

However, the next implementation pass changes one important source assumption: `Basic UDI-DI` context is no longer modeled as one shared family-level lookup bundle. The authoritative `BasicUDIs.xlsx` workbook provides explicit variant-level Basic UDI rows across the in-scope product families.

That means:

- the present end-to-end implementation is a valid first operational slice
- the present implementation is not yet proof that the architecture generalizes cleanly to all product families and product-accessory categories
- the current Echelon-specific shared Basic UDI assumption is known to be incorrect and is being replaced by variant-level linkage
- the next important step is not only refinement of transport architecture, but also proof that the same preparation and submission pattern can be exercised with additional family data

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

## Immediate Constraint: Echelon Only

The current end-to-end path is still constrained by a real business-data limitation:

- only the `Echelon` family currently has the required `Basic UDI-DI` context available to support the existing complete pipeline

That means the application is currently proving:

- one family-specific preparation and XML generation path

It is not yet fully proving:

- family-agnostic preparation
- family-agnostic enrichment assumptions
- family-agnostic submission assembly

## Likely Next Step

Before major refinement of the full `Preparation -> Submission -> Delivery -> History` model, the likely next step is to prove the current pipeline end to end with additional product family data.

That matters because it will expose whether:

- current canonical assumptions are too Echelon-specific
- enrichment rules depend too heavily on one family workbook pattern
- validation coverage generalizes cleanly
- batch assembly inputs are stable across families
- XML generation assumptions remain defensible beyond the current slice

In other words, the next major architectural learning may come less from AS4 planning and more from trying to run another product family through the same preparation path.

## Recommended Near-Term Direction

The recommended direction is:

1. preserve the current Echelon end-to-end flow as the reference slice
2. prove the preparation pipeline against at least one additional family when supporting `Basic UDI-DI` data becomes available
3. separate `Submission Layer` concerns from the current XML-generation service
4. introduce explicit submission models before implementing transport expansion
5. add delivery-mode switching through configuration and adapter selection
6. design history tracking so manual, Playground, and future M2M flows can share the same audit model

## Position Summary

The architecture should be judged by whether it keeps future change localized.

The desired outcome is that:

- additional product families can pass through the same preparation logic with limited family-specific extensions
- batches of `300` can be assembled and reviewed consistently
- the same submission artifacts can support Playground, manual, and later M2M paths
- historical retention can be applied consistently across all delivery modes

That is the standard for being materially better than a one-off Excel-to-XML script.
