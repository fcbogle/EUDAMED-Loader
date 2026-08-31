# AGENTS.md

## Project Context

This project is a Python/React web application for preparing, validating, and tracking EUDAMED submission data from multiple Excel device-data workbooks and EUDAMED schema files.

The immediate objective is controlled XML generation and Playground-backed workflow refinement, with clear separation between:
- single-device `POST`
- single-device `Patch XML`
- `Market Info`
- `Bulk Basic UDI POST`
- `Bulk UDI-DI POST`
- `Bulk PATCH`
- `Bulk Market Info`
- `EUDAMED Generation`

The current delivery goal is to:
- preserve the clean split between parent-only and child-only bulk registration flows
- keep `Patch XML` as the controlled single-device PATCH workspace
- keep `Bulk PATCH` aligned to the latest successful per-device accepted state
- keep `Market Info` and `Bulk Market Info` aligned with the same visual and state-model rules as `POST` and `PATCH`
- make the bulk UI simpler and more operationally accurate
- stabilize and extend the SQLite-backed application persistence layer

Workbook/source analysis remains relevant, but it is no longer the sole active phase. Current work also includes XML generation, local validation, Playground testing support, and persistence for reviewed/testing state.

---

# Collaboration Requirement

The human project owner must remain actively involved in coding and design decisions.

Codex must consult the project owner before making material changes, including:
- changing architecture
- introducing new major dependencies
- changing the canonical model structure
- changing mapping strategy
- changing validation/rule strategy
- deleting or restructuring files
- replacing the current SQLite persistence direction with a different database platform
- changing the XML generation workflow or message lineage rules
- implementing EUDAMED upload/M2M logic

Codex may make small, reversible changes without prior approval, such as:
- adding analysis scripts
- adding tests
- improving comments/docstrings
- adding small utility functions
- creating draft reports in the docs folder

When uncertain, Codex should stop and ask.

---

# Primary Architectural Principle

Do not build a one-off Excel-to-XML script.

Build toward a schema-aware regulatory data preparation platform with clear separation between:
- Excel/source data parsing
- source profiling
- canonical regulatory model
- mapping definitions
- YAML-based business rules
- validation and data-quality reporting
- EUDAMED schema/version metadata
- XML payload generation
- submission/audit history
- future M2M transport integration

The current implementation direction also assumes:
- SQLite is the active persistence layer for testing, import, and read-model state
- Playground testing outcomes inform operational workflow decisions
- bulk parent registration, bulk child registration, and bulk PATCH are distinct regulatory flows, not one generic batch mode

---

# Current Delivery Priority

The current priority is EUDAMED XML workflow refinement, Playground-backed testing support, and SQLite-backed state management.

Prioritise:
1. Maintaining the clean split between `Bulk Basic UDI POST`, `Bulk UDI-DI POST`, and `Bulk PATCH`
2. Keeping `Patch XML` as the only single-device PATCH generation workspace
3. Enforcing the current reviewed-baseline and accepted-state guardrails for PATCH generation
4. Continuing controlled Playground testing for `Bulk UDI-DI POST`, `Bulk PATCH`, `Market Info`, and `Bulk Market Info`
5. Stabilizing and extending the SQLite-backed testing/import/read-model layer
6. Improving the `Submission Data` workspace so database-backed panels become a real read model
7. Keeping documentation aligned with implemented XML/testing behavior
8. Preserving workbook/source analysis as supporting context for the workflows above

Do not implement EUDAMED upload or M2M transport yet.

---

# Intended Phased Delivery

## Phase 1 — XML Workspace And Testing Flow Stabilization

Refine and verify:
- single-device `POST`
- `Patch XML`
- `Market Info`
- `Bulk Basic UDI POST`
- `Bulk UDI-DI POST`
- `Bulk PATCH`
- `Bulk Market Info`
- the current reviewed-baseline and accepted-state guardrails
- current local XSD validation and preview/download behavior

## Phase 2 — SQLite Read Model And Persistence Expansion

Build out the current SQLite-backed application state so it becomes the main operational store for:
- reviewed baseline `POST` state
- successful Playground testing state
- workbook import snapshots and monitoring
- `device_subject` and `source_row` read paths
- later accepted-device state and submission history

## Phase 3 — Relational Identity Cleanup

Move from text-matched lineage to linked relational identity by:
- treating `device_subject` as the stable application identity
- linking reviewed baselines and testing state to `device_subject_id`
- replacing string matching with foreign-key joins where practical
- preserving workbook/source lineage through `source_row`

## Phase 4 — Documentation And Workflow Hardening

Keep the operator-facing implementation coherent by:
- aligning docs with actual XML/testing behavior
- documenting Playground findings and operational constraints
- expanding test coverage around bulk flow guardrails and PATCH lineage
- improving UI feedback for blocked or ineligible actions

## Phase 5 — Broader Canonical Persistence

After the current SQLite relational shape is stable, extend persistence for:
- accepted device state
- submission/audit history
- scenario change tracking
- later canonical/device workflow views

## Phase 6 — Future M2M Transport

Only after the manual XML/testing workflow is proven, add:
- AS4/eDelivery gateway integration
- automated message submission
- response polling/receipt handling
- retry/reconciliation logic

---

# Technology Stack

## Backend
- Python 3.11
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- SQLite for the active application/testing/import state
- pandas/openpyxl for Excel handling
- lxml/xmlschema for XML/XSD handling
- PyYAML for mapping and business rules

## Frontend
- React
- TypeScript
- Vite

## Infrastructure
- Docker
- Azure Container Apps or Azure Container Services
- Prefer container deployment over Azure-managed Python runtime

## Testing
- pytest for backend
- React testing library or equivalent for frontend
- synthetic fixtures only unless explicitly approved

---

# Python Version

Use Python 3.11 as the backend baseline.

Reason:
- stable Azure/container support
- mature dependency compatibility
- avoids unnecessary risk from newer Python runtime edge cases

Docker baseline:

```dockerfile
FROM python:3.11-slim
