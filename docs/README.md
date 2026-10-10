# Documentation index

Reviewed 9 October 2026. Current guides describe implemented behavior; importer
proposals and historical findings are labelled separately. Files under `docs`
are documentation/evidence, not authorization to initialize Production or submit
through M2M. The application Production importer is implemented; first local Production
startup and reviewed import remain pending.

## Current guides and design

| Document | Status / purpose |
| --- | --- |
| [Session handoff](session-handoff.md) | Current decisions and next steps, followed by dated checkpoints. |
| [Architecture](architecture-definition-draft.md) | Implemented boundaries and remaining Production/transport design. |
| [Environment profiles](environment-profiles.md) | Implemented profile selection/isolation and read-only checks. |
| [Workbook contract](production-import-workbook-design.md) | Implemented three-tab preparation; five review rows, 10,026 eligible. |
| [Preparation](production-import-preparation.md) | Current command, paths, optional URL policy and historical results. |
| [Production importer](production-importer-design.md) | Implemented assessment/import, baseline provenance, repeat-import safeguards. |
| [Registration counts](registration-counts.md) | Implemented uncapped SQLite aggregates with exported registration evidence. |
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
| [Identity policy](reports/device-subject-identity-policy.md) | Original policy plus current status; historical text-key policy; Prod uses issuer/UDI-DI identity. |
| [XML samples](xml_samples/README.md) | Illustrations that may lag current rendering and accepted state. |

Production workbook/audit inputs and outputs are local and ignored by Git.
The current pair is `production-import.xlsx` / `production-import.audit.json`.
The October 9 dated pair remains a historical preparation source.
