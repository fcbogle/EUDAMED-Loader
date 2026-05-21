# EUDAMED Profiling App

Analysis-first scaffold for profiling source Excel workbooks, reviewing normalization issues, and inventorying EUDAMED schema files before canonical mapping or XML generation.

## Current First-Phase Scope

- `MDR` devices only
- first upload focus is `UDI-DI` device details plus market information
- `UDIDIType.xsd` is the primary schema focus for the current phase
- `Basic UDI` records are already loaded manually and are treated as upstream context
- no approved Playground actor is available yet, so current XML planning should assume controlled manual submission paths

## Structure

- `backend/`: FastAPI API for source profiling and normalization review
- `frontend/`: React/Vite UI for browsing profiling results
- `data/source_excel/`: project-local Excel workbook copies
- `data/schemas/`: project-local EUDAMED schema/supporting files
- `data/basic_udi_reference/`: project-local Basic UDI reference workbook copies
- `config/normalization/`: YAML normalization rules
- `config/canonical_mapping/`: read-only canonical mapping review artifacts
- `docs/reports/`: generated report target

## Source Directories

The scaffold defaults to:

- Excel input: `data/source_excel`
- Schema input: `data/schemas`
- Basic UDI reference input: `data/basic_udi_reference`

Override with:

- `EUDAMED_EXCEL_DIR`
- `EUDAMED_SCHEMA_DIR`
- `EUDAMED_BASIC_UDI_REFERENCE_DIR`

## Run Backend

```bash
cd backend
../.venv/bin/python -m uvicorn app.main:app --reload
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```
