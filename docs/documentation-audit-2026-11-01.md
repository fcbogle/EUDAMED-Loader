# Documentation audit — 1 November 2026

## Remediation status — 1 November 2026

Owner-authorised Markdown remediation is complete in the development worktree.
The findings and inventory below are the **initial audit snapshot**, retained for
traceability; their line numbers and stale-status labels describe the files before
remediation, not the current guides.

- Updated onboarding, index, environment, architecture, canonical, registration,
  workbook, XML workflow, schema/version and testing-scenario guidance.
- Corrected publishing instructions to use the intended branch/worktree.
- Marked superseded Dev procedures and older batch/baseline instructions as
  historical, preserving measurements and investigation evidence.
- Distinguished current Dev Import Data, retained legacy Dev import and the
  Production configured-workbook contract. Corrected dated first-startup claims.
- Replaced four nonportable Production workbook/audit download links with
  explicitly qualified original-checkout file references. No Production files
  were copied to repair these links.
- Refreshed the handoff and registered worktree/registration-policy guides in
  Help; Help now has 35 documents. Application changes are documentation imports,
  section metadata and navigation entries only.

Verification: all 122 existing frontend tests pass, including Help-link and
Markdown-rendering regressions; the frontend production build passes. Its bundle
size advisory remains. Local documentation file targets and whitespace were
checked. No backend or operational database tests were needed or run for these
text/Help-metadata changes.

The previously selected Work Instruction DOCX/PDF copies are synchronized with
main. Their content was not edited or regenerated in this remediation. The
PowerPoint master selection remains open; visual comparison of formal documents,
SharePoint verification, and extending the controlled Work Instruction/validation
scope for new workflows remain separate review tasks. No files were deleted or
restructured, and main, Production configuration and operational databases were
not changed.

## Scope and basis

Audit of the development worktree on `feature/import-management-reporting`,
commit `1e5c395` (Simplify Import Management and enforce source review showstoppers).
The worktree was clean at the start. This is an audit report, not a document
migration, release approval or authorization to change Production.

Reviewed **46 Markdown files**: repository/development instructions, documentation,
embedded Help content and schema-profile guidance. **33 documents are registered
in the application's Help viewer**, so stale embedded text is visible to operators.
Also extracted text from the two local Word documents and compared the four formal
Word/PDF/PowerPoint artifacts with their same-named original/main-checkout copies.
Screenshots, PDF/PPT visual layout, external URLs and SharePoint copies were not
visually or externally verified. Word metadata dates were not treated as proof
of freshness: these files can retain old properties after content edits.

Current implementation was checked in navigation, import workflow/review policy,
registration labels, workbook importer selection, XML generation/version handling,
canonical validation/mapping definitions, regression tests and publishing scripts.
No application services, database imports, test suites or remote publishing were
run for the initial audit. Only this report was added at that stage; source
guides and formal documents were not edited or deleted. A subsequently authorised
copy synchronization is recorded below.

**Important boundary:** the current Dev feature is not the Production application
on `main`. A Production-only guide is not obsolete merely because Dev has a new
flow. Legacy raw-template import also still exists; documents should distinguish
it from the new primary Dev Import Data workflow, not claim it was removed.

## Initial highest-priority findings

| Priority | File / section | Confirmed stale guidance | Recommended treatment |
| --- | --- | --- | --- |
| High | [Dev workbook preparation test guide](dev-workbook-preparation-testing.md), lines 3–6, 56–148 | Says browser uploads and database importing are unavailable; instructs users to select removed Import Source Files/Assess & Import pages, Check source data, ZIP/audit downloads and disabled confirmation. | Mark the whole procedure superseded and direct operators to source-batch-receipt.md. Preserve dated test evidence if needed, rather than retain this as an active runbook. |
| High | [Publishing remotes](publishing-remotes.md), line 7 | Tells the user to work in the original checkout. That checkout is `main`; the feature changes are in the development worktree. The script publishes the branch of the checkout from which it runs. | Update the instruction to select the intended worktree, inspect branch/status and then commit/publish there. Keep the filtering/normal-push safeguards. This is directly relevant to the recent wrong-checkout commit confusion. |
| High | [Service contract findings](../frontend/src/content/docs/eudamed-service-contract-findings.md), lines 7–10 and 30–39 | Presents 3.0.30 as a universal current baseline and says later PATCH requires a user-supplied version and should not auto-increment. | Separate Prod 3.0.30 from the derived Dev 3.0.32 package. Document operation-specific accepted-state/version guards; do not use this old scaffold note as current version-selection instructions. |
| High | [Testing scenarios](../frontend/src/content/docs/testing-scenarios.md), lines 37–80 and 119–129 | Describes PATCH mainly as a comparison scaffold and lists Sterile and Latex in the implemented single-scenario catalogue without their present rejection status. | Update against current scenario availability and retained Playground evidence. Sterile/Latex are explicitly blocked in current UI/backend. Do not describe all candidate scenarios as implemented: Production Identifier, Sterilization, Reprocessed, Number of Reuses and MDN Codes remain unimplemented in the current controls. |
| High | [Registration counts](registration-counts.md), lines 72–78 | Defines devices without acceptance as Unknown except for trusted Production classification. | Align with the owner's source-membership labels: Registered when evidenced; Unregistered when in imported Template/BasicUDI sources but absent from recorded EUDAMED evidence; Unknown outside those sources. Preserve the distinction from live lookup and XML readiness. |
| High | [EUDAMED UI note](../frontend/src/content/docs/eudamed-testing-generation-ui.md), lines 14–29 and 51–65; [XML Generation](../frontend/src/content/docs/xml-generation.md), lines 7–25 | Describes EUDAMED Testing/Generation as separate top-level areas, includes a visible Bulk Basic UDI-DI POST mode and omits Bulk Market Info from the mode list. The UI note also treats accepted evidence as success-XML-only. | Match current navigation and six visible XML modes. Distinguish the retained parent-only backend/API capability from visible UI modes. Include imported export baselines as a separate accepted-evidence source. |
| High | Formal Work Instruction / PDF / screenshot PPT copies | Same filenames differ between main and the development worktree. | Identify the authoritative document copies before further edits, publishing or screenshot replacement. Do not merge or overwrite binary documents automatically. See copy comparison below. |

Implementation anchors for these findings:

- [ApplicationNavigation.tsx](../frontend/src/components/ApplicationNavigation.tsx): Import Data is a single page; there is no Generation navigation page.
- [ImportFlowWorkspace.tsx](../frontend/src/components/ImportFlowWorkspace.tsx) and [import_review_policy.py](../backend/app/services/import_review_policy.py): three primary actions, automatic saving, v2 review policy and labelled pills.
- [registration_summary.py](../backend/app/services/registration_summary.py), function registration_status: the three source-membership labels.
- [xml_generation.py](../backend/app/services/xml_generation.py): blocked_scenarios contains Sterile/Latex, while unimplemented_scenarios separately names the five unimplemented scenarios. Existing version-resolution logic must be documented per operation.
- [publish_remotes.py](../scripts/publish_remotes.py): reads the current branch and HEAD of the working checkout before publishing.

## Initial partially stale guides

| File | What to update; what remains useful |
| --- | --- |
| [Documentation index](README.md) | Reviewed October 11 and omits the two current Dev import guides, worktree guide and later operation/registration policies. Existing historical/current separation is useful. Help already registers the two new import guides; the index has not caught up. |
| [Repository README](../README.md) | Analysis-first scaffold and legacy source-directory overview omit the resumable Dev import process and batch storage. Startup commands and no-M2M boundary remain useful. |
| [Environment profiles](environment-profiles.md), lines 108–130 | Says first local Production startup/import remain pending, contradicting the completed October 10 checkpoint. Add the new Dev batch-root setting and distinguish the legacy raw importer from Import Data. Preserve isolation/actor/schema rules. |
| [Production importer design](production-importer-design.md), lines 234–259 | Heading says first Prod run pending despite completed status at the top. Integration section says the current route directly invokes the Dev importer, although the selector chooses by environment. Production's actual contract remains useful; do not replace it with Dev's new policy. |
| [Architecture definition](architecture-definition-draft.md), lines 125 and 150 | Blanket claims that Dev imports cannot establish acceptance omit the new explicit imported Playground-export baseline path. Raw source import alone still does not prove acceptance. Add the new file/review/batch lifecycle and distinguish both Dev paths. |
| [Architecture Position](../frontend/src/content/docs/architecture-position.md), lines 18 and 32 | Dev is described only as raw-template import and imported acceptance only as Production. Keep the useful separation of generation, registration, read models and future transport. |
| [Project Overview](../frontend/src/content/docs/project-structure.md), lines 19–28 | Lists legacy schemas and a raw-template-only Dev flow; misses schema profiles, import-batches and source-reviews. |
| [Canonical Validation](../frontend/src/content/docs/canonical-validation.md), lines 22–26 | Sends all operators to Submission Data and describes Dev inputs as raw workbooks/reference only. Add Import Data with XML evidence; legacy import remains available. Preserve the separation of completeness, XML readiness and registration. |
| [Workbooks](../frontend/src/content/docs/workbooks.md), lines 5–13 | Describes a read-only source-profiling tab, not the full current Submission Data snapshot/import-monitoring/database workspace. Retain source-profiling details under their actual subview. |
| [Canonical](../frontend/src/content/docs/canonical.md), lines 25–45 | Examples such as basic_device.type versus basic_device.device_type are no longer current emitted canonical paths; validation/mapping code uses declared names and has a regression asserting that. The blanket legacy-SRN/source description needs environment/path scope. Basic UDI parent registration is supported, not merely future upstream context. Do not infer that every wider canonical/XML design question is solved. |
| [Data Interpretation](../frontend/src/content/docs/data-interpretation.md), lines 87–135 | Core family/Basic UDI/device identity explanations remain useful. Paired-PATCH framing and future/appears-to-target Market Info wording need replacement by the implemented standalone workflows. Date/scope the 8,424-device example. |
| [XML Sample Comparison](../frontend/src/content/docs/xml-sample-comparison.md), Remaining Questions | Standalone Market Info is already implemented. Retain original comparison findings as historical evidence and separate genuinely open questions. |
| [Roadmap](../frontend/src/content/docs/roadmap.md) | Add implemented Dev Import Data and current review rules. The deferred Production preparation rollout is still a separate decision; do not mark Production deployed just because Dev is implemented. |
| [Software Engineering Patterns](../frontend/src/content/docs/software-engineering-patterns.md), Current Weak Spot | Review the broad claim that field naming is the principal unfinished gap against the now-strict emitted-path tests. Layering, normalization and canonical separation remain valid; this audit does not establish that all identity/alias work is complete. |
| [Schema profile provenance](../data/schema_profiles/README.md), line 18 | No Production database or baseline has been created is an old preparation-stage statement. Label it historical. The derived-Dev versus official-Prod provenance is still important and should not be removed. |
| [Registration-driven operation policy](registration-driven-operation-policy.md), lines 74–76 | The business policy is current, but feature changes are not yet committed is no longer current. Date or update the repository-status note. |
| [Session handoff](session-handoff.md), latest checkpoint | Current process/policy is captured, but No commit was created and pre-existing document-change status are earlier checkpoints; the feature now has commit 1e5c395 and was clean at audit start. Keep dated history, but refresh the current repository-status summary. |

Additional canonical-path evidence: [canonical_validation.py](../backend/app/services/canonical_validation.py)
emits basic_device.device_type and basic_device.administering_medicinal_product;
[test_canonical_validation.py](../backend/tests/test_canonical_validation.py) asserts
that emitted paths belong to the declared canonical model vocabulary. A scenario
name appearing in an enum alone was not treated as proof that it is implemented.

## Formal documents: initial duplicate-copy findings

The table records the initial snapshot, before owner-authorised synchronization.
These are repository copies, not a verification of the SharePoint master. Hashes
below are the first 16 hexadecimal characters of SHA-256; sizes are bytes.

| Artifact | Development worktree | Original/main checkout | Conclusion |
| --- | --- | --- | --- |
| Work Instruction DOCX | 3ae29f2bece6f94f; 8,340,720 | d9f72f0fac9d6699; 5,904,669 | Different copies under the same name. |
| Work Instruction PDF | 6c4d9fa3b4f54409; 7,213,657 | fac40858b30cb254; 5,097,857 | Different copies; do not assume either matches its sibling DOCX. |
| EUDAMED screenshot PPTX | 740823b1e6065ef7; 16,017,494 | 4fc426608c2418e2; 17,072,027 | Different image/document decks; visual freshness not established by this audit. |
| Master Validation DOCX | ead3ec1606615b79; 176,995 | ead3ec1606615b79; 176,995 | Byte-identical across the two checkouts. No copy divergence found. |

Paths, relative to each checkout:

- `docs/work instruction/BQP 06-20 Annex B Issue D WI SOP EUDAMED Loader.docx`
- `docs/work instruction/BQP 06-20 Annex B Issue D WI SOP EUDAMED Loader.pdf`
- `docs/work instruction/EUDAMED_Diagrams_FCB_0.1.pptx`
- `docs/master validation/EUDAMED In-house XML application_FCB.docx`

The formal Work Instruction has intentionally not yet been extended for the new
Dev Import Management/Reporting work. That is a pending controlled-document scope
update, not permission to rewrite an approved Production procedure. Master
Validation likewise needs an owner/QMS scope decision before the new Dev feature
is represented as covered by existing formal validation. This audit has not
validated screenshots, signatures, Appendix B/C execution evidence or regulatory
approval status, and does not mark those artifacts approved or obsolete.

### Owner follow-up — authoritative DOCX and PDF selected

On 1 November the owner selected the newer original/main Work Instruction DOCX
and PDF as the files to use. Both were copied to the development worktree without
changing their contents or source timestamps. The original/main files were left
unchanged. SHA-256 verification now confirms:

- Work Instruction DOCX: both copies begin `d9f72f0fac9d6699`.
- Work Instruction PDF: both copies begin `fac40858b30cb254`.

The DOCX/PDF copy divergence is resolved. This does not establish that the PDF's
rendered content exactly matches the DOCX; neither regeneration nor visual
validation was requested. Screenshot PPT divergence remains open; no PowerPoint
or Master Validation file was copied or changed. Future development edits should
use the synchronized Work Instruction copies, not the earlier worktree versions.

## Historical records: preserve them

The dated Playground export/batch/quantity/reconciliation reports, approved
baseline application, test-isolation incident, prior performance measurements,
SQLite proposal and sample XML documentation are evidence of their own checkpoint.
Their old device/version counts are not stale merely because a later extract has
more devices. Do not update old measurements to today's counts or delete them.

At the initial audit, some historical files contained operative-looking instructions, notably
[the October 25 batch report](dev-input-batch-2026-10-25.md) and
[baseline assessment](playground-baseline-assessment-2026-10-25.md). Add a clear
historical/superseded workflow banner and a current-guide pointer when these are
next maintained. The SQLite proposal, XML samples and identity-policy proposal
already carry useful historical qualifiers; keep those. The identity proposal's
Dev fallback-matching summary should explicitly say legacy raw importer if it is
refreshed, rather than imply the new exact-identity batch importer uses fallback.

## Link and worktree portability checks

No broken local Markdown-to-Markdown file targets were found in the 46 audited
files. This was a file-target check, not a heading-anchor or external-URL audit.

At the initial audit, four local workbook/audit links did not resolve from the feature worktree:

- production-import-preparation.md, lines 57–58: current production-import.xlsx
  and production-import.audit.json.
- session-handoff.md, lines 1728–1729: the dated October 9 workbook/audit pair.

All four artifacts **exist in the original checkout** under its ignored
`data/prod/import_file/` directory. This is a local-data/worktree-link portability
problem, not evidence that Production files were lost. Do not copy Production
inputs into the feature worktree merely to make those links work. Clarify the
original-checkout location or present them as local references rather than
portable Help downloads.

## Original suggested remediation order

1. Supersede the old Dev test guide and correct worktree publishing instructions.
2. Refresh embedded Help: service/version rules, testing scenario availability,
   navigation and registration labels. These can mislead operators now.
3. Update index/onboarding/architecture/canonical guides to describe current Dev
   alongside the unchanged Production path and any retained legacy operations.
4. Confirm the authoritative Work Instruction/PDF/PPT copies; update controlled
   documents/screenshots only for the intended, approved deployment scope.
5. Keep historical evidence in a clearly labelled archive/index and refresh only
   its navigation/status banners. No deletion is recommended by this audit.

## Initial Markdown inventory

Statuses below distinguish stale instructions from omissions, current guidance,
Production-specific documents, historical evidence and development instructions.
The audit report itself is new and is excluded from the original 46-file count.

| File | Status at initial audit | Notes |
| --- | --- | --- |
| [README.md](../README.md) | Partial | Scaffold/source-directory description omits the current Dev Import Data workflow. |
| [AGENTS.md](../AGENTS.md) | Instructions | Owner/development constraints; retained, not rewritten by this audit. |
| [docs/README.md](README.md) | Partial | October 11 index omits current import guides and later operational policies. |
| [docs/architecture-definition-draft.md](architecture-definition-draft.md) | Partial | Dev source-only state-transition wording excludes the new Dev imported-export baselines. |
| [docs/basic-udi-registration-comparison-2026-09-18.md](basic-udi-registration-comparison-2026-09-18.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/code-consolidation-2026-09-09.md](code-consolidation-2026-09-09.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/dev-input-batch-2026-10-25.md](dev-input-batch-2026-10-25.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/dev-playground-baseline-applied-2026-10-25.md](dev-playground-baseline-applied-2026-10-25.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/dev-test-isolation-incident-2026-10-25.md](dev-test-isolation-incident-2026-10-25.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/dev-workbook-confirmation.md](dev-workbook-confirmation.md) | Current | Matches current Dev workflow, catalogue blocking and retained database safeguards. |
| [docs/dev-workbook-preparation-testing.md](dev-workbook-preparation-testing.md) | Stale | Superseded operator procedure; disabled upload/import and removed buttons/endpoints. |
| [docs/development-and-production.md](development-and-production.md) | Current | Useful worktree, environment-switching, database-isolation and test instructions. |
| [docs/environment-profiles.md](environment-profiles.md) | Partial | Correct isolation model; stale Production-startup-pending statement and incomplete Dev import scope. |
| [docs/eudamed-playground-test-report.md](eudamed-playground-test-report.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/linx22l5sd-quantity-investigation-2026-10-25.md](linx22l5sd-quantity-investigation-2026-10-25.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/market-info-parity-checklist.md](market-info-parity-checklist.md) | Current | Implemented controls and remaining operator checks are explicitly separated. |
| [docs/playground-baseline-assessment-2026-10-25.md](playground-baseline-assessment-2026-10-25.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/playground-baseline-reconciliation-proposal-2026-10-25.md](playground-baseline-reconciliation-proposal-2026-10-25.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/playground-export-review-2026-10-25.md](playground-export-review-2026-10-25.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/production-import-preparation.md](production-import-preparation.md) | Production | Production-specific preparation remains valid; local artifact links need worktree context. |
| [docs/production-import-workbook-design.md](production-import-workbook-design.md) | Production | Production contract, not the new Dev admission policy; keep dated population context. |
| [docs/production-importer-design.md](production-importer-design.md) | Partial | Production core contract remains useful; contradictory first-run status and obsolete integration wording. |
| [docs/publishing-remotes.md](publishing-remotes.md) | Stale | Original-checkout-only instruction is unsafe guidance for feature-worktree commits/publishing. |
| [docs/registration-counts.md](registration-counts.md) | Partial | Parents/children guidance remains useful; Unknown/Unregistered definition is superseded. |
| [docs/registration-coverage-confirmation-2026-10-25.md](registration-coverage-confirmation-2026-10-25.md) | Policy + evidence | Current owner clarification with dated Dev coverage evidence; preserve limitations. |
| [docs/registration-driven-operation-policy.md](registration-driven-operation-policy.md) | Current + note | Current source-membership policy; final uncommitted/clean-status claim needs a date/update. |
| [docs/reports/device-subject-identity-policy.md](reports/device-subject-identity-policy.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/session-handoff.md](session-handoff.md) | Current + history | Latest implementation/policy is current; commit-status sentences lag and old sections are historical. |
| [docs/source-batch-receipt.md](source-batch-receipt.md) | Current | Primary guide for the current three-stage Import Data workflow. |
| [docs/sqlite-event-logging-schema-proposal.md](sqlite-event-logging-schema-proposal.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/xml-generation-performance-2026-09-16.md](xml-generation-performance-2026-09-16.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [docs/xml_samples/README.md](xml_samples/README.md) | Historical | Dated investigation, execution evidence, sample or explicitly labelled proposal; preserve rather than rewrite as current instructions. |
| [frontend/src/content/docs/architecture-position.md](../frontend/src/content/docs/architecture-position.md) | Partial | Dev raw-only and Production-only imported-baseline descriptions need qualification. |
| [frontend/src/content/docs/canonical-validation.md](../frontend/src/content/docs/canonical-validation.md) | Partial | SQLite/readiness guidance is useful; Dev import instructions omit Import Data and XML inputs. |
| [frontend/src/content/docs/canonical.md](../frontend/src/content/docs/canonical.md) | Stale | Lists corrected canonical aliases as current drift; parent registration/source-role guidance also lags. |
| [frontend/src/content/docs/data-interpretation.md](../frontend/src/content/docs/data-interpretation.md) | Partial | Core identities remain useful; paired-PATCH/future-Market-Info framing is obsolete. |
| [frontend/src/content/docs/eudamed-service-contract-findings.md](../frontend/src/content/docs/eudamed-service-contract-findings.md) | Stale | Single 3.0.30 baseline and manual PATCH-version instructions are not current general guidance. |
| [frontend/src/content/docs/eudamed-testing-generation-ui.md](../frontend/src/content/docs/eudamed-testing-generation-ui.md) | Stale | Obsolete top-level areas/mode list and success-only accepted-evidence description. |
| [frontend/src/content/docs/project-structure.md](../frontend/src/content/docs/project-structure.md) | Partial | Dev flow and schema/data-directory inventory omit current profiles/batch storage. |
| [frontend/src/content/docs/roadmap.md](../frontend/src/content/docs/roadmap.md) | Partial | New Dev workflow is missing; Production deployment/preparation UI must still be distinguished. |
| [frontend/src/content/docs/software-engineering-patterns.md](../frontend/src/content/docs/software-engineering-patterns.md) | Review | Layered architecture remains valid; reassess the broad field-naming weak-spot claim. |
| [frontend/src/content/docs/testing-scenarios.md](../frontend/src/content/docs/testing-scenarios.md) | Stale | PATCH-scaffold framing and Sterile/Latex eligibility contradict current controls. |
| [frontend/src/content/docs/workbooks.md](../frontend/src/content/docs/workbooks.md) | Partial | Source profiling describes only part of the current Submission Data/read-model workspace. |
| [frontend/src/content/docs/xml-generation.md](../frontend/src/content/docs/xml-generation.md) | Partial | Current model-selection section is useful, but old areas/modes and evidence descriptions remain. |
| [frontend/src/content/docs/xml-sample-comparison.md](../frontend/src/content/docs/xml-sample-comparison.md) | Partial | Historical comparison conclusions should not describe standalone Market Info as undecided. |
| [data/schema_profiles/README.md](../data/schema_profiles/README.md) | Provenance + note | Schema provenance remains useful; no-Production-baseline sentence needs historical qualification. |

Initial audit result: only this report was added; no documents were deleted, no application code changed and no operational databases were opened. The later owner-authorised follow-up synchronized the two Work Instruction copies and recorded the decision in the session handoff; original/main files remained unchanged.
