# Project Overview

## Project Creator

Created by **Frank C Bogle**, Head of Enterprise Solutions, Blatchford Mobility UK.

The application supports source workbook analysis, canonical regulatory modelling, and the preparation, validation and tracking of EUDAMED XML submissions.

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
- `data/schema_profiles/` active environment-specific XSD profiles; `data/schemas/` is retained legacy evidence
- `data/dev/import-batches/` configured Dev batches, prepared workbooks and source-review revisions (ignored)
- `data/testing/` and `data/prod/` separate configured operational data roots
- `docs/` reports and sample XML

## Current Flow

Dev feature: `Uploaded Templates + BasicUDI + XML extracts -> automatically saved source review -> dated batch/workbook/audit -> confirmed additive SQLite import -> operation assessment -> XML preview/download`

Legacy Dev: `Configured raw templates + reference -> source/canonical SQLite import`.
The legacy path remains available; it is not the new source-batch workflow.

Production: `Templates + reference + exported XML -> prepared workbook/audit -> assessed import -> SQLite canonical data and export baselines -> operation assessment -> XML preview/download`

Successful acknowledgement uploads update accepted state and recorded history
in the active environment. Downloading XML does not submit it.

Configured local data roots can point to the original checkout while development
code runs in a separate worktree. Do not move/copy the operational databases when
switching environments. See [Development and Production](../../../../docs/development-and-production.md).

## Current State

- broader multi-family scope is already implemented in workbook review, canonical review, validation, and XML preview
- Dev retains its configured source/mapping exclusions; Production follows the approved prepared-workbook scope and owner exclusions
- Production importing and export-baseline evidence are implemented; initial local startup/import completed on 10 October 2026
- Registration State includes a Parents & Children view with lazy-loaded 20-child pages in both environments
- canonical completeness, XML eligibility and registration evidence remain separate
- emitted canonical paths have declared-model regression checks; remaining text/alias identity paths, source-quality and deployment controls still need targeted work

See [Architecture Position](architecture-position.md), the
[architecture definition](../../../../docs/architecture-definition-draft.md) and
[Canonical Validation](canonical-validation.md) for current boundaries.

## Intended Direction

The long-term architecture is still:

`Preparation -> Submission -> Delivery -> History`

Operational import, package, batch and acknowledgement history already exists in
SQLite. Automated delivery/M2M and a complete formal submission/audit solution
remain future work.
