# Architecture Position

Updated 11 October 2026 against the implemented Dev and Production application.
See the [architecture definition](../../../../docs/architecture-definition-draft.md)
for detailed responsibilities and state transitions.

## Current implementation

The application prepares, validates and tracks EUDAMED XML using a shared
Python/FastAPI backend, React/TypeScript UI and SQLite persistence. Dev and
Production use the same database design and XML workflow services, with separate
configuration, source data, actor settings, schemas and databases.

There are two import paths:

| Environment | Source and import flow |
| --- | --- |
| Dev | Existing raw-template parsing, Basic UDI reference linkage and source/canonical import. |
| Production | Templates, approved parent reference and exported XML are reconciled into a prepared workbook/audit pair. The UI assesses that pair before the operator confirms database import. |

The first local Production startup and reviewed import were completed on
10 October. Subsequent source updates follow the same prepared-pair and reviewed
import process; they do not silently overwrite accepted device state.

## Implemented boundaries

- **Source and canonical data:** imported workbook evidence, source lineage, stable device subjects, identity issues and a saved canonical projection.
- **Validation:** canonical completeness, XML-required data and local message XSD validation are distinct checks. Production completeness notes can coexist with XML readiness.
- **Operation assessment:** shared backend rules decide availability for POST, child POST, PATCH and Market Info.
- **XML generation:** six visible workspaces—POST, Patch XML, Market Info, Bulk UDI-DI POST, Bulk PATCH and Bulk Market Info. Bulk Basic UDI POST remains a separate supported backend/API operation.
- **Review:** ZIP download records review of that exact archive; preview or download does not establish registration.
- **Accepted evidence:** validated Production exports establish imported baselines. Successful acknowledgement uploads advance the relevant accepted state under correlation and version guards.
- **History and read models:** SQLite records source imports, generated contexts, packages, response events and batches. These are operational evidence, not a complete formal audit/replay solution.

Imported export baselines are recorded separately from upload successes. A device
registered outside this application can therefore support the appropriate next
operation without inventing local POST history. Dev's default unregistered flag
is not proof that a device needs registration. Trusted Production template-only
classification supplies awaiting-registration status for the approved import.

See [Production importer design](../../../../docs/production-importer-design.md),
[Canonical Validation](canonical-validation.md) and
[registration evidence](../../../../docs/registration-counts.md).

## Shared UI and read-model behaviour

Submission Data and Canonical Validation read the imported SQLite projection.
Registration State offers **Registration State** and **Parents & Children** tabs
in both environments, sharing model/search and readiness filters. Parent identity
includes issuing entity plus Basic UDI-DI; child identity includes issuing entity
plus UDI-DI. Expanded child details load on demand in pages of 20.

Registration summaries use uncapped reconciled identities and the same operation
assessments as generation. Scoped readiness and request-local state reuse improve
refresh performance while whole-import identity checks and snapshot consistency
remain in place. Registration status is displayed separately from XML eligibility.

The environment banner shows schema details and configured manufacturer and
authorised representative SRNs. Documentation renders internal links and tables,
including navigation between related guides.

## Current constraints

- Some selection and lineage paths still use aliases/text matching alongside device-subject links.
- Historical accepted snapshots can be partial; missing evidence is not reconstructed from an unrelated draft.
- Export baselines reflect their supplied evidence, not a live EUDAMED lookup.
- Browser performance and controlled manual XML testing remain separate from synthetic regression results.
- Direct submission, AS4/eDelivery/M2M transport, automatic polling, formal audit retention and deployment/access-control arrangements remain future work.

## Further development

Continue operational verification, identity cleanup, source-quality review and
bounded extraction of UI/service responsibilities. Keep parent-only, child-only
and update flows distinct, and preserve accepted device and Market Info lineage.

An OpenAI-based read-only assistant using document retrieval and existing database
services is under discussion. It is not implemented or approved for database
changes, regulatory decisions or submission. See the [roadmap](roadmap.md) for
implemented and deferred work.
