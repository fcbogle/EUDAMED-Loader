# Testing Scenarios

Updated 1 November 2026 against current scenario controls and generation services.
Implementation, local validation, recorded Playground outcomes and formal QMS
approval are separate evidence levels. This guide does not certify every scenario
for every device or environment.

## Current operational workflows

The six visible XML modes are POST, Patch XML, Market Info, Bulk UDI-DI POST,
Bulk PATCH and Bulk Market Info. Parent-only Bulk Basic UDI POST remains a
separate supported backend/API operation. POST may seed a parent with its first
child, or add a child under a registered parent. PATCH and Market Info require
the exact device's accepted evidence in the active environment.

PATCH is a controlled update workflow, not merely a paired comparison scaffold.
Accepted evidence can come from a successful acknowledgement or an explicitly
imported export baseline. Imports do not fabricate successful submissions.

## PATCH scenario availability

| Scenario | Current implementation status |
| --- | --- |
| Equivalent First Patch | Implemented special version-2 baseline scenario, subject to its accepted-version prerequisites; not a universal next version. |
| Trade Name Edit | Implemented; replacement trade-name text. |
| Critical Warnings | Implemented; controlled warning code and optional comment. |
| Storage Condition Edit | Implemented; controlled storage-condition changes. |
| Base Quantity | Implemented; positive integer. |
| Status Code | Implemented; controlled device-status values, subject to generation checks and EUDAMED rules. |
| Sterile | Blocked after recorded Playground rejection; not available for PATCH generation. |
| Latex | Blocked after recorded Playground rejection; not available for PATCH generation. |
| Production Identifier | Not implemented. |
| Sterilization | Not implemented. |
| Reprocessed | Not implemented. |
| Number Of Reuses | Not implemented. |
| MDN Codes | Not implemented. |

Sterile and Latex testing returned ERR-DTX-UDI-031-033.02. Do not interpret their
historical boolean examples or scenario names as permission to generate them.
A scenario appearing in the catalogue does not establish that it is enabled,
accepted by EUDAMED or formally approved for the intended business change.

## Device selection and versions

Select the Device Model, then the exact eligible device or bulk scope. Searchable
bulk selection supports catalogue numbers and Device UDI-DIs. Review the exact
identifiers, accepted baseline, proposed changes, versions and exclusions.
Unresolved identity/catalogue ambiguity must not be bypassed with a guessed target.

Use the current workspace's assessed base/proposed version. The equivalent-first
scenario has a specific version-2 contract. Other update workflows use accepted
state and operation-specific version controls; bulk generation derives versions
per device. Do not apply a blanket manual version rule to mixed-version devices.
Refresh and regenerate when accepted state changes. Market Info has separate
accepted/observed version handling; device and Market Info versions are not
interchangeable.

## Market Info testing

Single Market Info and Bulk Market Info are implemented standalone MARKET_INFO.PUT
workflows. They operate on the selected registered devices' market-information
collections and preserve the applicable identity/version guards. A country change
should be prepared in the appropriate market-information workspace rather than
assuming an unchanged POST/PATCH comparison represents that change.

When a PATCH contains marketInfos, current accepted countries must be preserved.
Historical paired examples do not define current country or version selection.

## Recommended verification

1. Confirm the active environment, manufacturer, selected model and device IDs.
2. Assess the operation; review its candidate/registered prerequisites and blockers.
3. Check preview changes, local XSD results, base/proposed versions and bulk exclusions.
4. Download and review the exact ZIP before manual EUDAMED submission.
5. Retain returned responses, upload them through the supported acknowledgement
   workflow and check the recorded outcome and refreshed next-operation state.

Use synthetic isolated data for automated regressions. Manual Playground outcomes
are separate from Production acceptance and formal validation. The derived Dev
3.0.32 profile and official Prod 3.0.30 profile are selected by configuration.

For recorded executions, see the [Playground report](../../../../docs/eudamed-playground-test-report.md).
For current readiness and message boundaries, see [XML Generation](xml-generation.md)
and [Service Contract Findings](eudamed-service-contract-findings.md). QMS/source
owners still determine whether the intended business change is appropriate.
