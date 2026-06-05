# EUDAMED Profiling App

Analysis-first scaffold for reviewing source Excel workbooks, Basic UDI reference data, EUDAMED schemas, canonical mappings, validation results, and XML previews.

## Current Scope

- `MDR` only
- source workbooks under `data/source_excel/`
- authoritative Basic UDI reference workbook: `data/basic_udi_reference/BasicUDIs.xlsx`
- legacy SRN fallback workbook retained for comparison and enrichment
- XML work is limited to review, preview, validation, and download
- no live submission or M2M transport is implemented

## Structure

- `backend/` FastAPI API
- `frontend/` React/Vite UI
- `config/normalization/` normalization rules
- `config/canonical_mapping/` review artifacts
- `data/schemas/` local XSD pack
- `docs/` reports and XML samples

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

## Environment Overrides

- `EUDAMED_EXCEL_DIR`
- `EUDAMED_SCHEMA_DIR`
- `EUDAMED_BASIC_UDI_REFERENCE_DIR`
