# Roadmap

## Purpose

This section is a working roadmap for the next design and implementation phases of the application.

It is intended to separate:

- near-term refinement of the current release
- medium-term workflow and architecture improvements
- later expansion into submission, history, and operational reporting

The roadmap is currently organized into:

- `UI Roadmap`
- `Backend Roadmap`
- `Submission And Workflow Roadmap`

Other roadmap areas may be added later if they need their own planning surface, for example:

- `History And Audit Roadmap`
- `Deployment And Operations Roadmap`
- `Testing And Quality Roadmap`

## UI Roadmap

This section captures how the user experience should evolve from the current review-oriented workbench into a more operational regulatory pipeline.

### Navigation And Information Architecture

The current tab model has been useful for discovery and controlled design, but it is not yet the final operational navigation structure.

Near-term direction:

- keep the existing tabs stable for Release 1 review and demonstration
- evaluate a later move from domain tabs to a clearer pipeline-oriented navigation model
- distinguish between:
  - review surfaces
  - operational workflow surfaces

### Pipeline Workflow Design

The UI should increasingly help users move a selected regulatory scope through a sequence of stages rather than only browse analysis areas.

Near-term direction:

- design the user journey as a pipeline
- make downstream stages inherit scope from earlier selections
- present stage transitions more explicitly, for example:
  - source review
  - canonical review
  - canonical validation
  - XML generation
  - submission workflow
  - result review

### Scope Selection Model

The application now operates at more than one meaningful scope:

- workbook and sheet for source review
- product family and product variant for validation and XML generation

Near-term direction:

- clarify where workbook-driven scope is appropriate
- clarify where variant-driven scope is the real operational unit
- reduce situations where users have to reselect equivalent scope repeatedly

### Stage Status And Progress States

The UI should present clearer operational state rather than only counts and evidence panels.

Near-term direction:

- define stage states such as:
  - `not started`
  - `in review`
  - `ready`
  - `blocked`
  - `complete`
- show stage readiness in a way that helps users know what to do next
- make blocker states visually stronger and easier to scan

### Review Surfaces

The current review tables and detail panels are useful, but they should be refined so they feel less like engineering inspection tools and more like controlled review artifacts.

Near-term direction:

- retain strong traceability
- simplify where repetition adds little value
- improve wording for QMS and operational reviewers
- tighten how selected samples and evidence are presented

### Operational Screens

Operational screens should eventually feel distinct from analytical ones.

Near-term direction:

- make `Canonical Validation` and `XML Generation` feel like execution stages
- prepare for later `Submission` and `History` screens
- keep the flow aligned to real business tasks rather than only data structures

### Visual Theme And Design System

The current UI is functional but still reads as an exploratory engineering interface.

Near-term direction:

- strengthen the visual identity
- make status colors and stage semantics more deliberate
- reduce “panel of panels” density where possible
- move toward a clearer product feel rather than an academic prototype feel

## Backend Roadmap

This section captures how the backend should evolve from the current preparation-and-generation platform into a fuller submission-preparation system.

### Canonical Model Evolution

The canonical model is now broad enough to support Release 1, but it still needs continued review against real QMS decisions.

Near-term direction:

- keep `Canonical` as the reference model
- continue tightening field naming consistency
- make visible distinctions between:
  - confirmed fields
  - enriched fields
  - deliberate gaps

### Enrichment And Source Strategy

The system now uses multiple source categories:

- in-scope workbook data
- authoritative `BasicUDIs.xlsx`
- narrow supplemental legacy tracekey data for SRNs

Near-term direction:

- keep enrichment explicit and reviewable
- avoid hidden fallback logic
- clarify where QMS decisions are still needed for missing fields
- preserve source traceability in validation and later submission flows

### Validation Rule Evolution

Validation is now aligned to the canonical model and supports XML readiness, but the rule strategy can still mature.

Near-term direction:

- keep canonical completeness and XML readiness distinct
- formalize any operation-specific rules if `POST` and `PATCH` diverge later
- improve handling of known workbook/header variation through controlled rules rather than scattered ad hoc logic

### Submission Assembly Design

The current XML service assembles wrapped `Push` messages, but the backend still needs a clearer submission-layer boundary.

Near-term direction:

- separate canonical preparation from submission assembly concerns
- define explicit submission-domain models
- keep later manual upload and history tracking independent from XML rendering internals

### XML Packaging And Schema Strategy

The generic XML service now supports both single-record and variant-batch output.

Near-term direction:

- keep batch scoping strictly variant-based
- maintain explicit schema traceability
- continue hardening enum normalization and payload consistency
- refine naming/package conventions where needed

### Service Boundaries And Refactoring

The major Echelon-specific legacy path has now been removed, but the backend should continue moving toward cleaner service boundaries.

Near-term direction:

- keep current generic services cohesive and explicit
- avoid reintroducing family-specific service branches
- simplify shared helper logic where duplication remains
- continue removing leftover historical assumptions from code and docs

## Submission And Workflow Roadmap

This section captures the next planning layer beyond validation and XML generation: how artifacts move through manual submission, outcome capture, and operational follow-up.

### Manual Submission Workflow

Release 1 stops at validated XML generation and download. The next workflow step is controlled manual submission support.

Near-term direction:

- define how generated XML packages are prepared for manual upload
- make submission scope and selected artifacts explicit
- design the operator flow after XML review is complete

### Submission Status Model

The system will need a clearer notion of what happened after generation.

Near-term direction:

- define statuses for generated, reviewed, submitted, accepted, rejected, and corrected states
- keep status design compatible with both manual and later automated delivery modes

### Result Capture

Once XML is manually uploaded, the application should be able to record the outcome in a structured way.

Near-term direction:

- capture submission results and reviewer notes
- support controlled follow-up where a generated artifact needs correction or regeneration
- distinguish business/data issues from transport or portal issues

### Operational Exception Handling

Later workflow screens should help users deal with blocked or failed cases, not just successful ones.

Near-term direction:

- surface failed or partial outcomes clearly
- support re-review and regeneration paths
- keep exception handling traceable and auditable
