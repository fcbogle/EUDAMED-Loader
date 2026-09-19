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
- `data/schema_profiles/` separate Prod and Dev XSD bundles and provenance
- `data/schemas/` preserved legacy XSD pack
- `docs/` reports and XML samples

## Run Backend

```bash
cd backend
../.venv/bin/python -m app.run --environment dev --reload
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Overrides

- `EUDAMED_ENVIRONMENT` (`dev` or `prod`, selected at startup)
- `EUDAMED_ENV_FILE` (optional explicit profile file)
- `EUDAMED_EXCEL_DIR`
- `EUDAMED_SCHEMA_DIR`
- `EUDAMED_BASIC_UDI_REFERENCE_DIR`

See [Dev and Prod configuration](docs/environment-profiles.md) for profile files,
read-only configuration checks, storage isolation and current production limitations.
