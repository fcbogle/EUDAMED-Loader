# EUDAMED Workspaces And Outcome Capture

Updated 1 November 2026 against the implemented feature-branch navigation.
Production rollout is separate; use the code and configuration of the running
checkout when checking its available controls.

## Navigation

The application areas are Import Management, Data Views, EUDAMED, Reporting and
Help. Within EUDAMED, labels follow the active environment: Testing in Dev and
Submission in Production, with the corresponding summary. There is no separate
accepted-only EUDAMED Generation navigation page.

The six visible XML modes are POST, Patch XML, Market Info, Bulk UDI-DI POST,
Bulk PATCH and Bulk Market Info. Parent-only Bulk Basic UDI POST remains a separate
backend/API capability; do not instruct operators to find a removed mode button.

## Operational pattern

Select the Device Model and operation, obtain an assessment, review the actual
candidate or registered device IDs, inspect the changes and validation results,
then download/review the exact ZIP. Supported response-upload controls record
returned outcomes and refresh the operation's state. A preview or download does
not itself establish EUDAMED acceptance.

Single POST distinguishes parent seeding from child registration. Patch XML is
the only single-device scenario-based PATCH workspace. Bulk UDI-DI POST is
child-only. Bulk PATCH and Bulk Market Info apply operation-specific changes to
explicit registered-device selections using their individual accepted states.

## Status and evidence

Registered, Unregistered and Unknown are source-membership labels, independent
of XML readiness and canonical completeness. Contextual Candidate/Accepted badges
are not a replacement for those labels or for the operation assessment.

Accepted evidence can be a successful returned acknowledgement or an explicitly
imported EUDAMED export baseline in the active environment. Imported baseline
records do not count as successful POST/PATCH operations. Missing evidence must
not be reconstructed from an unrelated draft or an old source label.

## Response capture

Operators submit XML manually in the intended EUDAMED environment and retain the
returned response. Upload Success XML uses the existing parser, correlation,
identity, version and duplicate/delayed-response guards. Reported errors remain
error evidence; they do not accept the rejected payload. Follow the workspace
feedback and check refreshed registration/accepted-version state afterward.

The application has no M2M transport or live EUDAMED lookup. Reporting generation
remains under development. See [XML Generation](xml-generation.md),
[Testing Scenarios](testing-scenarios.md) and
[registration policy](../../../../docs/registration-driven-operation-policy.md).
