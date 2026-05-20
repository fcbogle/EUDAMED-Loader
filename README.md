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
- `config/normalization/`: YAML normalization rules
- `config/canonical_mapping/`: read-only canonical mapping review artifacts
- `docs/reports/`: generated report target

## Source Directories

The scaffold defaults to:

- Excel input: `/Users/frankbogle/Documents/EUDAMED/InputExcel/EUDAMED_Excels`
- Schema input: `/Users/frankbogle/Documents/EUDAMED/Schema/EUDAMED_Schemas`

Override with:

- `EUDAMED_EXCEL_DIR`
- `EUDAMED_SCHEMA_DIR`

## Run Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```
