# EUDAMED Profiling App

Analysis-first scaffold for profiling source Excel workbooks, reviewing normalization issues, and inventorying EUDAMED schema files before canonical mapping or XML generation.

## Structure

- `backend/`: FastAPI API for source profiling and normalization review
- `frontend/`: React/Vite UI for browsing profiling results
- `config/normalization/`: YAML normalization rules
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
