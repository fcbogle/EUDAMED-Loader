# EUDAMED Data Preparation Application

Python/FastAPI and React application for reviewing device sources, preparing and
validating EUDAMED XML, and tracking registration evidence and returned responses
in SQLite. Scope is MDR. Operators submit XML manually; live submission, polling
and M2M transport are not implemented.

## Current workflows

- **Dev Import Data:** upload Template workbooks, the BasicUDI reference and XML
  extracts; review sources, create the batch/workbook, then confirm import.
  Progress saves automatically and workbook download is optional.
- **Production:** retain the existing configured prepared workbook/audit and
  reviewed import workflow. New Dev features are not a Production rollout.
- **XML operations:** separate POST, Patch XML, Market Info, Bulk UDI-DI POST,
  Bulk PATCH and Bulk Market Info. Preview/XSD checks and ZIP review are distinct
  from EUDAMED acceptance. Returned acknowledgements update tracked state.
- **Read models:** Submission Data, Canonical Validation and Registration State
  read the active environment's saved data and evidence. Reporting generation
  remains under development.

See [Import Data in Dev](docs/source-batch-receipt.md),
[Dev import safeguards](docs/dev-workbook-confirmation.md),
[Development and Production](docs/development-and-production.md) and the
[documentation index](docs/README.md).

## Structure

- `backend/`: Python 3.11/FastAPI, import, validation, generation and SQLite services.
- `frontend/`: React/TypeScript/Vite and embedded Help.
- `config/`: canonical mapping and normalization rules.
- `data/schema_profiles/`: active, separate Dev and Prod XSD profiles; `data/schemas/` is the retained legacy pack.
- `data/dev/import-batches/`: local Dev batches, source reviews and prepared evidence, ignored by Git.
- `data/source_excel/` and `data/basic_udi_reference/`: retained legacy Dev inputs; the upload flow accepts sources from any local folder.
- `data/testing/` and `data/prod/`: separate configured operational state and storage.
- `docs/`: current guides, proposals, historical evidence and formal documents.

## Run locally

Use the correct checkout and one environment at a time. For this installation,
Production uses the original checkout on main; Dev uses `.worktrees/development`
on `feature/import-management-reporting`. Read the worktree guide before switching.
From the intended checkout, validate Dev configuration before starting:

```bash
cd backend
../.venv/bin/python -m app.run --environment dev --env-file .env.dev --check-config
../.venv/bin/python -m app.run --environment dev --env-file .env.dev --reload
```

In a separate terminal in that checkout's frontend directory:

```bash
npm install
npm run dev
```

Configuration checks start no services and open no database. Startup itself uses
the existing application initialization path. Profile paths, actor settings and
schemas must belong to the intended environment; never copy the Playground
database into Production. See [environment profiles](docs/environment-profiles.md).

## Deployment scope

Uploads are retained by the backend where it runs. Hosted deployments need
persistent, separated Dev/Production storage and appropriate access controls.
Azure storage integration and authenticated importer attribution are not yet
implemented. Git ignore is not a backup mechanism.
