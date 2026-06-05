# Project Structure

## Main Directories

- `frontend/` UI and embedded docs
- `backend/app/routers/` HTTP endpoints
- `backend/app/services/` workbook, canonical, validation, and XML logic
- `backend/app/canonical_models.py` declared canonical domain models
- `backend/app/validation_models.py` readiness and evidence models
- `backend/app/xml_models.py` XML preview and validation models
- `config/canonical_mapping/` canonical review artifacts
- `config/normalization/` normalization rules
- `data/source_excel/` source workbooks
- `data/basic_udi_reference/` Basic UDI reference workbooks
- `data/schemas/` local EUDAMED schemas
- `docs/` reports and sample XML

## Current Flow

`Excel input -> workbook review -> canonical review -> canonical validation -> XML preview/download`

## Current State

- broader multi-family scope is already implemented in workbook review, canonical review, validation, and XML preview
- accessories remain excluded from active variant mapping
- the main remaining cleanup is consistency between canonical model names and XML-facing field paths

## Intended Direction

The long-term architecture is still:

`Preparation -> Submission -> Delivery -> History`

The current scaffold stops before delivery and history.
