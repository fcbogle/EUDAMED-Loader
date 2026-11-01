# XML Sample Comparison

Reviewed 1 November 2026. The original sample comparison is historical evidence,
not the current operator workflow or accepted-state baseline.

## Retained conclusions

- Local XSD validity does not prove EUDAMED service/business-rule acceptance.
- DEVICE.POST, child-only UDI_DI.POST, UDI_DI.PATCH and MARKET_INFO.PUT have distinct responsibilities.
- Lifecycle, identity, device versions and Market Info versions must be interpreted in their own message context.

Earlier equivalent POST/PATCH pairs demonstrated a version-2 update shape and
repeated marketInfos for comparison. Current Patch XML uses the exact device's
accepted baseline and applicable countries; it does not require a comparison
POST to be generated first. Standalone single/bulk Market Info is implemented,
not an undecided future service.

## Current references and open work

Use [XML Generation](xml-generation.md), [Service Contract Findings](eudamed-service-contract-findings.md)
and [Testing Scenarios](testing-scenarios.md) for supported operations and guards.
The [sample files](../../../../docs/xml_samples/README.md) may lag current rendering
and remain illustrative. Further business-rule interpretation and formal scenario
approval require current evidence; neither a sample nor successful local XSD
validation establishes blanket approval for an untested change.
