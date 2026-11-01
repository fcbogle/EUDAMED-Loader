# Documentation index

Reviewed 1 November 2026 against the development feature branch. The new Dev
Import Data workflow is implemented; Production retains its existing main-branch
workflow until a separately reviewed release. The first local Production
startup/import completed on 10 October. This index does not authorize database
initialization, regulatory approval or M2M submission.

## Current operator and development guides

| Document | Purpose |
| --- | --- |
| [Import Data in Dev](source-batch-receipt.md) | Three primary actions, automatic saving, source corrections, review pills and file retention. |
| [Dev import safeguards](dev-workbook-confirmation.md) | Transaction, backup, identity, repeat-import and accepted-history protections. |
| [Development and Production](development-and-production.md) | Correct worktree/branch, environment switching, startup and isolated tests. |
| [Environment profiles](environment-profiles.md) | Profile selection, actor/schema/storage separation and read-only configuration checks. |
| [Registration operation policy](registration-driven-operation-policy.md) | Registered/Unregistered/Unknown and registration-driven POST/PATCH selection. |
| [Registration counts](registration-counts.md) | SQLite evidence, parent/child views, scope and readiness distinctions. |
| [Publishing remotes](publishing-remotes.md) | Commit/publish from the intended worktree; filtered GitHub history safeguards. |
| [Session handoff](session-handoff.md) | Current checkpoint followed by explicitly historical decisions and execution evidence. |

## Architecture and Production-specific contracts

| Document | Scope |
| --- | --- |
| [Architecture](architecture-definition-draft.md) | Implemented boundaries and remaining deployment/transport design. |
| [Production workbook contract](production-import-workbook-design.md) | Production three-tab workbook and review policy; dated input populations are evidence, not live totals. |
| [Production preparation](production-import-preparation.md) | Configured-file command, local locations, optional URL policy and historical results. |
| [Production importer](production-importer-design.md) | Production assessment/confirmation, imported baselines and additive repeat imports. |
| [Market Info parity](market-info-parity-checklist.md) | Implemented controls and remaining operator verification. |

Help also contains the current XML, testing-scenario, canonical and source-data
guides. The Work Instruction and Master Validation documents have separate
controlled-document ownership; application documentation does not establish their
approval or validation status.

## Historical evidence and proposals

| Document | Scope |
| --- | --- |
| [Playground tests](eudamed-playground-test-report.md) | Dated executions; later checkpoints are in the handoff. |
| [Parent comparison](basic-udi-registration-comparison-2026-09-18.md) | September input comparison, not current inventory. |
| [XML consolidation](code-consolidation-2026-09-09.md) | September implementation checkpoint. |
| [Performance](xml-generation-performance-2026-09-16.md) | Historical synthetic measurements and reproduction method. |
| [SQLite proposal](sqlite-event-logging-schema-proposal.md) | Historical design, not current migration DDL. |
| [Identity proposal](reports/device-subject-identity-policy.md) | Historical matching design; distinguish the legacy raw importer from current exact-identity batch imports. |
| [XML samples](xml_samples/README.md) | Illustrations, not current accepted baselines. |

Other dated batch, export, reconciliation and incident files remain retained
evidence. `dev-workbook-preparation-testing.md` is a superseded procedure; use the
current Dev guide above. The November documentation audit is retained in
`docs/documentation-audit-2026-11-01.md` with remediation status.

Production inputs and outputs are local, ignored application files in the
original checkout. The current pair is `production-import.xlsx` and
`production-import.audit.json`; dated pairs remain historical evidence. Relative
links into another worktree's ignored data are not portable downloads.
