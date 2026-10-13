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
- `data/schemas/` local EUDAMED schemas
- `docs/` reports and sample XML

## Current Flow

Dev: `Raw templates + reference -> SQLite import -> canonical validation -> operation assessment -> XML preview/download`

Production: `Templates + reference + exported XML -> prepared workbook/audit -> assessed import -> SQLite canonical data and export baselines -> operation assessment -> XML preview/download`

Successful acknowledgement uploads update accepted state and recorded history
in the active environment. Downloading XML does not submit it.

## Current State

- broader multi-family scope is already implemented in workbook review, canonical review, validation, and XML preview
- Dev retains its configured source/mapping exclusions; Production follows the approved prepared-workbook scope and owner exclusions
- Production importing and export-baseline evidence are implemented; initial local startup/import completed on 10 October 2026
- Registration State includes a Parents & Children view with lazy-loaded 20-child pages in both environments
- canonical completeness, XML eligibility and registration evidence remain separate
- the main remaining cleanup includes canonical/XML field-name consistency and transitional text/alias identity paths

See [Architecture Position](architecture-position.md), the
[architecture definition](../../../../docs/architecture-definition-draft.md) and
[Canonical Validation](canonical-validation.md) for current boundaries.

## Intended Direction

The long-term architecture is still:

`Preparation -> Submission -> Delivery -> History`

Operational import, package, batch and acknowledgement history already exists in
SQLite. Automated delivery/M2M and a complete formal submission/audit solution
remain future work.
