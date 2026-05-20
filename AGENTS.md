# AGENTS.md

## Project Context

This project is a Python/React web application for preparing EUDAMED regulatory submission data from multiple Excel device-data workbooks and EUDAMED schema files.

The immediate objective is analysis and controlled transformation, not immediate live submission.

The first delivery goal is to:
- inspect and profile the six input Excel device data files
- inspect the available EUDAMED schema/XSD/supporting files
- identify data quality issues
- propose a canonical regulatory device model
- create an initial source-to-canonical mapping approach
- report gaps between available source data and schema/submission requirements

Later phases may generate EUDAMED XML payloads, support manual upload, record submission responses, and eventually integrate through the EUDAMED M2M/eDelivery/AS4 digital gateway.

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
- adding database persistence
- implementing XML generation
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

---

# Current Delivery Priority

The current priority is analysis of data and schemas.

Prioritise:
1. Understanding the six Excel workbooks
2. Profiling workbook/sheet/column structure
3. Identifying common and variable fields across workbooks
4. Identifying incomplete, duplicate, inconsistent or suspicious data
5. Understanding EUDAMED schema files at a high level
6. Proposing canonical model candidates
7. Proposing initial mapping YAML
8. Creating clear reports for human review

Do not implement EUDAMED upload yet.

---

# Intended Phased Delivery

## Phase 1 — Data and Schema Discovery

Build scripts/reports to:
- inventory all input files
- profile Excel sheets and columns
- infer datatypes and null counts
- detect duplicate candidate identifiers
- identify candidate controlled values
- detect inconsistent values
- inventory schema/XSD files
- identify likely schema entry points
- summarize required elements where practical

## Phase 2 — Canonical Model Proposal

Draft Pydantic canonical/domain classes representing regulatory device meaning.

Candidate concepts may include:
- RegulatorySubmission
- SubmissionBatch
- EconomicOperator
- Manufacturer
- BasicDevice
- DeviceRecord
- UdiDevice
- Certificate
- PackagingLevel
- MarketAvailability
- ValidationIssue
- MappingDefinition
- SchemaVersion

Do not assume this list is final. Refine it from the real data and schemas.

## Phase 3 — Mapping and Validation

Create:
- source-to-canonical mapping YAML
- YAML-based business rule definitions
- Python rule execution engine
- validation report structures
- canonical preview output

## Phase 4 — XML Package Generation

Only after mapping and validation are understood, add:
- schema registry
- XML generator
- XSD validation
- XML preview/download
- generated payload archive

## Phase 5 — Manual Submission Support

Support:
- manual EUDAMED upload package preparation
- user-entered upload result/status
- batch-level and object-level status tracking
- audit trail

## Phase 6 — Future M2M Transport

Only after manual XML package generation is proven, add:
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
- PostgreSQL
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
