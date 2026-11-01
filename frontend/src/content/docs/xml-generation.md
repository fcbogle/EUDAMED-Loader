# XML Generation

Updated 1 November 2026 against the current feature-branch workspaces. Operators
prepare and submit XML manually in the intended environment; the application
records evidence but has no automatic EUDAMED transport or live registration lookup.

## Navigation and modes

Open the EUDAMED area and its environment-labelled Testing/Submission workspace.
The six visible modes are POST, Patch XML, Market Info, Bulk UDI-DI POST,
Bulk PATCH and Bulk Market Info. There is no separate accepted-only Generation
navigation page. Parent-only Bulk Basic UDI POST remains supported through its
separate backend/API operation, not a visible mode button.

## Current Selection Model

The XML workflows use a single `Device Model` selector. Each model represents an existing Product Family / Product Variant pair; for example, `Echelon VAC` can be selected directly without first selecting `Echelon`.

The usual flow is:

1. Find a model by name, family or Basic UDI-DI; optionally narrow the list by family.
2. Select the `Device Model` row to set the family and variant together. Searching the list alone does not change the active selection.
3. Let the backend assess the tracked operational state for the selected model and operation.
4. Choose any operation-specific device, parent or bulk scope, then generate XML for the eligible selection. Single POST resolves the next eligible candidate; PATCH and Market Info preserve the selected device and its accepted lineage.

This selector is shared by Single POST, Single PATCH, Single Market Info, Bulk POST, Bulk PATCH and Bulk Market Info. It changes the selection UI, not the underlying family/variant fields or database structure.

Backend assessment still determines eligibility:

- a `POST` may need to seed a new Basic UDI-DI parent registration
- a `POST` may instead register the next eligible child Device UDI-DI under an accepted parent
- a `PATCH` requires the selected device's tracked accepted lineage
- Market Info and bulk operations retain their own registration, version and scope rules

## Current supported outputs

| Workspace | Target and required context |
| --- | --- |
| POST | Parent seed with its first device, or child-only UDI-DI registration under an accepted parent, as assessed. |
| Patch XML | One exact accepted device, supported scenario and base/proposed version context. |
| Market Info | One registered device's market-information collection. |
| Bulk UDI-DI POST | Eligible child-only registrations under the selected accepted parent. |
| Bulk PATCH | Supported scenario over an explicit registered-device scope, preserving individual accepted baselines. |
| Bulk Market Info | Explicit target countries over an eligible registered-device scope with individual Market Info version handling. |

Registration drives POST/PATCH designation. Historical source-operation labels do
not control eligibility. Identity, parent, data-quality, accepted-state and version
guards remain authoritative. Scenario availability is documented in
[Testing Scenarios](testing-scenarios.md); Sterile and Latex PATCH are blocked,
and the five unimplemented scenarios are not enabled by having a catalogue entry.

## Accepted evidence and versions

Accepted state can come from validated successful acknowledgements or an explicit
imported export baseline in the active environment. Imported baseline events are
not successful uploads. Device and Market Info versions are tracked separately.
Review the selected operation's base and proposed versions; the version-2
Equivalent First Patch is a special scenario, not a universal next version.
PATCH retains the latest applicable accepted Market Info countries rather than
reverting to an unrelated or stale POST draft.

Preview/XSD validation, ZIP review and registration are separate. Downloading the
exact ZIP records its review and generation context; it does not submit or accept
that XML. After manual submission, retain returned responses and use the supported
Upload Success XML workflow. Correlation, identity, duplicate/delayed response and
version guards control accepted-state updates and refresh the available operations.
See [Service Contract Findings](eudamed-service-contract-findings.md).

## Selecting Catalogue Numbers In Bulk Workspaces

For Bulk POST, Bulk PATCH or Bulk Market Info, choose **Select catalogue numbers**
and click **Select devices**. A dialog shows the available device list immediately.
Search by catalogue number or Device UDI-DI, tick the required devices, and use
**Show selected only** to review the selection. Filtering does not remove checked
items. The list scrolls within the dialog.

Click **Apply selection** to save and return to the XML workspace. Its compact
summary shows the selected count; **Edit selection** reopens the dialog. Cancel,
Escape or the close button discards edits. **Clear selection** takes effect only
when applied. Changing model or parent clears the selection. Review a fresh preview
after applying changes, then download the ZIP before submitting its XML.
