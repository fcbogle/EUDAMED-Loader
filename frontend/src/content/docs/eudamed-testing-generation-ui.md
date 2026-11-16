# EUDAMED Workspaces And Outcome Capture

Updated 14 November 2026. Workspace labels and data follow the active Dev or
Production profile; confirm the environment banner before generating XML.

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

## Single PATCH: model, scenario, device

Select the model first using **Select Device Model**, then open **Single PATCH**.
Inside the PATCH Scenario Workspace, select **PATCH scenario** before finding a
device. Single and Bulk PATCH offer Trade Name, Critical Warnings, Storage
Conditions and Device Market Status in both Dev and Production. Retired candidates
and Equivalent First Patch are not selectable business changes. Base Quantity is
not selectable: Playground rejected quantity changes with
ERR-DTX-UDI-031-033.02, Quantity of Device is not updatable. The backend also blocks
new Base Quantity previews and downloads. Existing history and response evidence
remain available; new registrations still include the required quantity.

Enter at least two characters of a Device UDI-DI or catalogue number. Search
narrows within the selected model in the active environment, preserves leading
zeros, puts exact matches first and shows at most ten results with a total count.
Choose **Select for PATCH** to load that exact device's accepted baseline. Typing
or clearing the query does not change the selected device. Missing/ambiguous
identity and existing XML blockers prevent selection. A matching search result
alone does not establish registration or PATCH eligibility.

The Before/After controls appear after the accepted baseline loads. Failures appear
beside the scenario card with **Reload accepted baseline**. Changing the model or
device clears the previous draft and preview; changing the scenario resets the
scenario draft/preview while retaining a valid selection within the same model.
Pending requests for an old selection cannot replace the current preview.

## Device Market Status: Single and Bulk PATCH

**Withdrawal Market Information rule:** Single and Bulk withdrawal PATCHes omit
Market Information in both environments. Playground explicitly rejected the Dev
retained-country experiment (APP-DTX-000123540.xml): Market Info is not allowed
when changing from On the EU market to No longer placed on the EU market. The
experiment has been reverted. Katie's earlier Production rejection of the omitted
shape remains unresolved; the revert is not a verified fix for that rejection.

This option currently supports only **On the EU market → No longer placed on the
EU market**. Before is the recorded accepted status. Select the permitted After
value, review the identity and next version, and generate/validate the preview.
The outgoing withdrawal PATCH retains other accepted device attributes and the
registration, and omits Market Info. Review linked container package statuses
following EUDAMED acceptance. Do not use a missing accepted status as a workbook
or default-value fallback.

The option is available in both Dev/Playground and Production for Single and Bulk
PATCH following successful Playground tests. The active environment determines
the database, accepted evidence and schema profile; keep Production and Playground
evidence separate. Each device must have a usable accepted baseline with an
On the EU market status. Missing or already withdrawn statuses are not eligible.

Review the identity, proposed status and next version before downloading the ZIP.
Preview and download do not accept the draft or change current device attributes.
Upload the matching response XML after manual submission. A successful correlated
acknowledgement updates the accepted state and the changed current device
attribute; failures retain existing values. Newer conflicting local edits require
review. Original source/workbook evidence is preserved.

## Status and evidence

Registered, Unregistered and Unknown are source-membership labels, independent
of XML readiness and canonical completeness. Contextual Candidate/Accepted badges
are not a replacement for those labels or for the operation assessment.

Accepted evidence can be a successful returned acknowledgement or an explicitly
imported EUDAMED export baseline in the active environment. Imported baseline
records do not count as successful POST/PATCH operations. Missing evidence must
not be reconstructed from an unrelated draft or an old source label.

## Current device data after a successful PATCH

A correlated success response for Trade Name, Critical Warnings, Storage Conditions
or Device Market Status updates that changed current attribute and
its accepted history together. Source workbook rows and original XML evidence are
retained, with a link from the current value to the response event. Preview/download,
errors and unrelated acknowledgements do not update current device values.

The application checks the device identity, payload and accepted version, and the
current value captured when generating the draft. A newer local edit is retained
and reported for review; the EUDAMED success remains recorded. Duplicate responses
do not repeat the update, and older responses cannot replace newer current values.
Projection rebuilds retain qualified changes rather than restoring older source
values. Original workbook files still require normal source maintenance.

After upload, current-data views and accepted summaries are refreshed. If that
refresh fails, the message distinguishes the recorded response from the refresh
failure; reload the page to see the saved state. Reconciliation against an older
extract can still show a difference until a fresh extract is imported. Off-market
records retain country evidence, with Market Info treated as not applicable in the
current comparison. Earlier unrelated differences are not bulk-overwritten.

## Response capture

Operators submit XML manually in the intended EUDAMED environment and retain the
returned response. Upload Success XML uses the existing parser, correlation,
identity, version and duplicate/delayed-response guards. Reported errors remain
error evidence; they do not accept the rejected payload. Follow the workspace
feedback and check refreshed registration/accepted-version state afterward.

The application has no M2M transport or live EUDAMED lookup. Reporting provides the Model Reconciliation Summary. See [XML Generation](xml-generation.md),
[Testing Scenarios](testing-scenarios.md) and
[registration policy](../../../../docs/registration-driven-operation-policy.md).


### Bulk Device Market Status

Choose the model and Basic UDI-DI group in Bulk PATCH, then Device Market Status.
Select the devices and choose No longer placed on the EU market. Review the
accepted status of each candidate and preview the exact included devices, next
versions and exclusions before downloading the ZIP. Only devices whose accepted
status is On the EU market qualify. Each included device uses its own accepted
version plus one; Market Info is omitted from withdrawal PATCH messages.

Upload the response from the active EUDAMED environment through the response XML control. Successful
acknowledgements update the corresponding current device status and accepted
version. Failed devices retain their values and versions. Single and bulk
withdrawal have been verified in Playground and are available in Production.
