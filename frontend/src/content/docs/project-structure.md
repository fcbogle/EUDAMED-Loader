# Project Structure

## Context

This application is being developed under the direction of Frank C Bogle, Head of Enterprise Solutions for Blatchford Mobility, to support a structured and extensible approach to EUDAMED data preparation, validation, and XML generation.

[[pill:Frank C Bogle]] [[pill:Head of Enterprise Solutions]] [[pill:Blatchford Mobility]]

## Purpose

The `Project Structure` section explains how the application is organized technically. Its purpose is to show how source Excel review, canonical interpretation, validation, submission preparation, and future delivery concerns are separated so the project can grow into a broader EUDAMED preparation platform rather than a one-off Excel-to-XML script.

## Main Directories

- `frontend/`
  - holds the React UI, tab layouts, API calls, and documentation rendering
- `backend/app/routers/`
  - exposes backend functionality as HTTP endpoints for the frontend
- `backend/app/services/`
  - contains the main business logic for workbook review, canonical interpretation, validation, and XML generation
  - now also contains the variant-level Basic UDI join logic that resolves workbook sheets to `BasicUDIs.xlsx` `Device Model` rows
- `backend/app/canonical_models.py`
  - defines the intermediary business and regulatory model used between source review and XML output
- `backend/app/xml_models.py`
  - defines the XML-facing preview, validation, and batch response models
- `config/canonical_mapping/`
  - stores the read-only canonical mapping review artifacts
- `config/normalization/`
  - stores normalization and schema-enum mapping rules
- `data/source_excel/`
  - holds the project-local source Excel workbook inputs
- `data/basic_udi_reference/`
  - holds the shared Basic UDI reference workbooks used for canonical enrichment
  - `BasicUDIs.xlsx` is the authoritative source
  - the older tracekey workbook is retained temporarily as legacy comparison material during migration
- `data/schemas/`
  - holds the local EUDAMED schema and supporting files used for validation
- `docs/`
  - holds human-readable project reports and supporting documentation

## Architectural Position

The current implementation is best understood as part of a larger four-layer direction:

1. `Preparation Layer`
2. `Submission Layer`
3. `Delivery Layer`
4. `History Layer`

At present, the codebase is strongest in the `Preparation Layer` and in the first operational slice of the `Submission Layer`, where validated records are turned into XML-ready batches and package previews.

The current workbook and canonical design uses variant-level Basic UDI linkage across the in-scope non-accessories families. The next implementation step is to bring `Canonical Validation` and `XML Generation` into line with that broader scope.

The current workbook and canonical scope is:

- in scope:
  - `Echelon`
  - `Elan`
  - `Elite`
  - `Epirus / Esprit`
  - `Navigator / Javelin / Linx`
- currently out of scope:
  - `Template for Accessories_Footspares EUDAMED.xlsx`
  - this workbook is deliberately excluded from active variant mapping while awaiting accessory mapping rules from QMS
  - those rules are expected shortly and will allow this workbook to be brought back into the main preparation flow

## Backend Layers

The backend is organized into layers with different responsibilities.

- `routers`
  - receive API requests from the frontend
  - call the appropriate backend service
  - return structured responses
- `services`
  - perform the real application work
  - inspect workbooks and schemas
  - assemble canonical meaning
  - validate completeness
  - generate XML and current batch package previews
- `canonical models`
  - represent stable business and regulatory meaning
  - separate workbook structure from XML structure
- `validation models`
  - represent completeness, blockers, field evidence, and review summaries
- `xml models`
  - represent XML previews, validation results, and batch packaging outputs

## Current Application Flow

The current application flow is:

`Excel input -> workbook review -> canonical interpretation -> canonical validation -> XML generation`

In practical terms:

- source Excel files are reviewed as input evidence
- workbook values are normalized and interpreted
- stable regulatory meaning is assembled in the canonical layer
- the canonical validation layer checks readiness for the current XML-facing subset
- schema-aware EUDAMED XML is generated only after those earlier steps are complete

This is a valid first operational slice, but it should be viewed as part of a broader target flow:

`Preparation -> Submission -> Delivery -> History`

## Separation of Concerns

The project is intentionally designed so each part of the application has a narrow responsibility.

- the `Workbooks` area reviews source structure and quality
- the `Canonical` area defines intermediary regulatory meaning
- the `Canonical Validation` area checks readiness and highlights missing fields
- the `XML Generation` area produces schema-valid output from validated data and current batch package previews
- `routers` handle API traffic, while `services` handle business logic
- normalization rules live in configuration files rather than being hidden inside UI code or XML rendering code

This separation matters because it allows the application to evolve safely. XML generation can change without redesigning workbook review, and future submission and delivery features can be added downstream without rewriting the canonical or validation layers.

## Future Extension Points

The current project does not end conceptually at XML generation. Rather, the present implementation currently stops after validated XML generation and package preparation. The next major extension points are operational rather than analytical.

### Submission Layer Refinement

A future refinement of the `Submission Layer` should make explicit:

- what a `SubmissionUnit` is
- how `SubmissionBatch` objects are assembled
- where the `300 records per batch` rule is enforced
- how `SubmissionArtifact` and manifest outputs are represented independently of delivery mode

### Submission History

A future `Submission History` layer could record:

- which XML batches were prepared
- which files were submitted
- when submissions were made
- what responses were received
- which records were accepted, rejected, or require reconciliation

This would add auditability and support controlled manual submission workflows.

### Delivery Modes

A future `Delivery Layer` could support more than one downstream handling mode for the same prepared submission artifact:

- Playground-oriented dry-run or controlled review flows
- manual package export and upload support
- later M2M / AS4 delivery

The preferred direction is that configuration selects the delivery mode while the underlying batch and artifact models remain stable.

### M2M Integration

A future `M2M Integration` layer could add:

- EUDAMED machine-to-machine delivery
- AS4 / eDelivery access-point integration
- transport acknowledgements
- business response handling
- retry and reconciliation logic

This should sit downstream of the existing preparation and submission flow. The target is to add this as an extension of the delivery architecture rather than as a rewrite of the preparation pipeline.

## Near-Term Architectural Check

Before over-refining the future delivery architecture, the likely next structural check is to align the current end-to-end pipeline with the broader family scope now already available in workbook review and canonical mapping.

That is important because it will show whether current assumptions are:

- safely reusable across families
- too dependent on Echelon-specific enrichment patterns
- ready to support more general submission assembly
