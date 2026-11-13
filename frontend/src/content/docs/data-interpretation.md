# Data Interpretation

## Purpose

This note explains how the current workbook rows should be interpreted as regulatory device records, and what the current XML generation flows are actually targeting.

## Identity Levels

The current data needs to be read at several levels:

- `Product Family`
  - UI and review grouping such as `Elan`, `Echelon`, or `Elite`
- `Product Variant`
  - variant-level grouping such as `Elan IC` or `Echelon VT`
- `Basic UDI-DI`
  - shared regulatory parent context for many related UDI-DI records
- `UDI-DI`
  - the individual registered device record identity targeted by current XML messages
- physical manufactured unit
  - not the main target of current registration messages; this would be distinguished by production identifiers such as serial or batch context

## Historical Dev dataset example

The retained Dev Template checkpoint described here contained the following;
these are not live totals for every environment or import:

- `8424` in-scope device rows
- `8424` distinct primary `UDI-DI` values
- `14` distinct Basic UDI identifiers

This means the current source set is effectively modeling:

- a relatively small number of shared Basic UDI groups
- a much larger number of distinct UDI-DI-level registerable product configurations underneath them

In practical terms, each unique UDI-DI in the current source scope can be treated as one distinct registerable device configuration. That is close to a manufacture-ready definition, even though the stricter regulatory interpretation is a UDI-DI device-registration record rather than an individual physical unit.

## Basic UDI And UDI-DI

The Basic UDI-DI is shared context.

Example:

- `GS1:5050649ELANICNM`

This is not the unique identifier for one device row. It is the shared Basic UDI context for many Elan IC UDI-DI records.

The UDI-DI is the row-level EUDAMED device-record identity.

Example:

- `ELANIC22L1S` -> `GS1:05050649096501`
- `ELANIC22L1SD` -> `GS1:05050649098291`

Both records can share the same Basic UDI while still having different UDI-DIs.

## Message targets and selection

Parent identity is issuing entity plus Basic UDI-DI; child identity is issuing
entity plus UDI-DI. DEVICE.POST can seed a parent with its first child; child-only
UDI_DI.POST adds a device under a registered parent. A separate parent-only bulk
backend/API operation exists. UDI_DI.PATCH updates a device and MARKET_INFO.PUT
maintains that device's market-information collection. Bulk packaging does not
turn a catalogue number into regulatory identity.

The shared Device Model selector sets family/variant context. Catalogue numbers
are business references and selection aids. Review exact UDI-DIs when selecting
individual or bulk targets. Unresolved catalogue collisions block the new Dev
source import; existing ambiguous selection/readiness guards remain separate.

## Proposed values and accepted evidence

Templates/BasicUDI sources describe proposed data. XML extracts provide a dated
view of recorded EUDAMED state; they do not provide live synchronization or prove
parent-only registration absence. Explicit imported baselines remain distinguishable
from actual successful acknowledgements. Neither a source POST/PATCH field nor
preview generation establishes registration.

The current labels are Registered when supported by recorded EUDAMED evidence,
Unregistered when present in imported Template/BasicUDI data but absent from that
evidence, and Unknown outside those sources. Identity problems and XML readiness
are separate. Interpret each label in the active environment and agreed source scope.

## PATCH and Market Info

The former paired POST/equivalent-PATCH comparison is historical. Patch XML is a
controlled scenario workflow using the selected device's accepted lineage.
Equivalent First Patch has a special version-2 contract; other operations use
their assessed state/version controls. PATCH must retain applicable accepted
countries. Single and Bulk Market Info are implemented standalone operations with
separate accepted/observed market-version handling.

See [XML Generation](xml-generation.md), [Testing Scenarios](testing-scenarios.md)
and [registration policy](../../../../docs/registration-driven-operation-policy.md).
