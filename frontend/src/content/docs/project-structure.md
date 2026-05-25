# Project Structure

## Context

This application is being developed under the direction of Frank C Bogle, Head of Enterprise Solutions for Blatchford Mobility, to support a structured and extensible approach to EUDAMED data preparation, validation, and XML generation.

[[pill:Frank C Bogle]] [[pill:Head of Enterprise Solutions]] [[pill:Blatchford Mobility]]

## Purpose

The `Project Structure` section explains how the application is organized technically. Its purpose is to show how source Excel review, canonical interpretation, validation, and XML generation are separated so the project can grow into a broader EUDAMED preparation platform rather than a one-off Excel-to-XML script.

## Main Directories

- `frontend/`
  - holds the React UI, tab layouts, API calls, and documentation rendering
- `backend/app/routers/`
  - exposes backend functionality as HTTP endpoints for the frontend
- `backend/app/services/`
  - contains the main business logic for workbook review, canonical interpretation, validation, and XML generation
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
  - holds the shared Basic UDI reference workbook used for family-level enrichment
- `data/schemas/`
  - holds the local EUDAMED schema and supporting files used for validation
- `docs/`
  - holds human-readable project reports and supporting documentation

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
  - generate XML
- `canonical models`
  - represent stable business and regulatory meaning
  - separate workbook structure from XML structure
- `validation models`
  - represent completeness, blockers, field evidence, and review summaries
- `xml models`
  - represent XML previews, validation results, and batch packaging outputs

## Application Flow

The current application flow is:

`Excel input -> workbook review -> canonical interpretation -> canonical validation -> XML generation`

In practical terms:

- source Excel files are reviewed as input evidence
- workbook values are normalized and interpreted
- stable regulatory meaning is assembled in the canonical layer
- the canonical validation layer checks readiness for the current XML-facing subset
- schema-aware EUDAMED XML is generated only after those earlier steps are complete

## Separation of Concerns

The project is intentionally designed so each part of the application has a narrow responsibility.

- the `Workbooks` area reviews source structure and quality
- the `Canonical` area defines intermediary regulatory meaning
- the `Canonical Validation` area checks readiness and highlights missing fields
- the `XML Generation` area produces schema-valid output from validated data
- `routers` handle API traffic, while `services` handle business logic
- normalization rules live in configuration files rather than being hidden inside UI code or XML rendering code

This separation matters because it allows the application to evolve safely. XML generation can change without redesigning workbook review, and future submission features can be added downstream without rewriting the canonical or validation layers.

## Future Extension Points

The current project ends at validated XML generation and manual handoff. The next major extension points are operational rather than analytical.

### Submission History

A future `Submission History` layer could record:

- which XML batches were prepared
- which files were submitted
- when submissions were made
- what responses were received
- which records were accepted, rejected, or require reconciliation

This would add auditability and support controlled manual submission workflows.

### M2M Integration

A future `M2M Integration` layer could add:

- EUDAMED machine-to-machine delivery
- AS4 / eDelivery access-point integration
- transport acknowledgements
- business response handling
- retry and reconciliation logic

This should sit downstream of the existing XML generation layer. The current canonical and XML-generation design is intended to support that future step without requiring a rewrite of the preparation pipeline.
