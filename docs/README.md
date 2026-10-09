# Documentation index

Reviewed 9 October 2026. Current guides describe implemented behavior; importer
proposals and historical findings are labelled separately. Files under `docs`
are documentation/evidence, not authorization to initialize Production or submit
through M2M. The application Production importer is not implemented yet.

## Current guides and design

| Document | Status / purpose |
| --- | --- |
| [Session handoff](session-handoff.md) | Current decisions and next steps, followed by dated checkpoints. |
| [Architecture](architecture-definition-draft.md) | Implemented boundaries and remaining Production/transport design. |
| [Environment profiles](environment-profiles.md) | Implemented profile selection/isolation and read-only checks. |
| [Workbook contract](production-import-workbook-design.md) | Implemented three-tab preparation; six review rows, 10,028 eligible. |
| [Preparation](production-import-preparation.md) | Current command, paths, optional URL policy and historical results. |
| [Production importer](production-importer-design.md) | Draft for review; application importer and fixed-name replacement pending. |
| [Registration counts](registration-counts.md) | Implemented uncapped acknowledgement-based SQLite aggregates. |
| [Market Info parity](market-info-parity-checklist.md) | Implemented assessments/refresh and remaining operator verification. |
| [Publishing remotes](publishing-remotes.md) | Business/GitHub publishing script and temporary-clone lifecycle. |

## Historical evidence and proposals

| Document | Scope |
| --- | --- |
| [Playground tests](eudamed-playground-test-report.md) | Historical executions; later checkpoints are also in the handoff. |
| [Parent comparison](basic-udi-registration-comparison-2026-09-18.md) | September reference/export comparison; not current parent-reference counts. |
| [XML consolidation](code-consolidation-2026-09-09.md) | September 9 implementation checkpoint. |
| [Performance](xml-generation-performance-2026-09-16.md) | September 16 synthetic measurements and reproduction method. |
| [SQLite proposal](sqlite-event-logging-schema-proposal.md) | Original proposal, partly implemented; not current migration DDL. |
| [Identity policy](reports/device-subject-identity-policy.md) | Original policy plus current status; Production issuer-aware adaptation pending. |
| [XML samples](xml_samples/README.md) | Illustrations that may lag current rendering and accepted state. |

Production workbook/audit inputs and outputs are local and ignored by Git.
Current files use the `20261009-114955-299236` suffix. The agreed fixed names
`production-import.xlsx` / `production-import.audit.json` are not yet in use.
Earlier pair filenames are historical references, not promised retained artifacts.
