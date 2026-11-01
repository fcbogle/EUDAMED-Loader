# EUDAMED Service Contract Findings

Updated 1 November 2026. This guide describes the implemented manual XML
preparation workflows, not an automatic EUDAMED transport service.

## Environment-specific schema profiles

| Environment | Configured message version | Schema provenance |
| --- | --- | --- |
| Dev / Playground | 3.0.32 | Preserved 3.0.30-derived project bundle with a changed message constraint; not an official 3.0.32 release. |
| Production | 3.0.30 | Separate official downloaded Production package. |

Check the active environment banner and startup configuration. Local validation
uses that profile's service/Message.xsd, not the retained data/schemas tree as a
universal default. See [schema provenance](../../../../data/schema_profiles/README.md).

## Message responsibilities

| Operation | Service/message | Meaning |
| --- | --- | --- |
| Parent seed with first child | DEVICE.POST | Establish the Basic UDI parent and initial device shape where assessment permits. |
| Child-only registration | UDI_DI.POST | Add an eligible device under an already registered parent. |
| Device update | UDI_DI.PATCH | Apply a supported scenario to an exact registered-device baseline. |
| Market information | MARKET_INFO.PUT | Update a device's market-information collection separately from ordinary device changes. |

Parent-only Bulk Basic UDI POST remains a supported backend/API capability.
The visible child-registration bulk mode is Bulk UDI-DI POST. Bulk PATCH and
Bulk Market Info retain independent accepted state/version handling per device.

## Accepted state and versions

The selected environment's successful acknowledgements and explicit imported
export baselines can provide accepted evidence. A generated preview, ZIP download,
source POST/PATCH label or version number alone does not prove registration.
Imported snapshots are marked IMPORTED, not successful uploads.

The equivalent-first PATCH is a special version-2 scenario with version-1
baseline prerequisites. It is not the default for an already updated device.
Later PATCH generation uses accepted state with the workspace's scenario/version
controls. Review the base and proposed version shown for the actual target;
refresh if acceptance changes. Bulk PATCH derives versions per device rather
than applying one guessed version to the whole selection. Market Info has its
own accepted/observed version rules.

When PATCH carries marketInfos, retain the latest applicable accepted countries.
Do not restore stale POST countries merely to reproduce an old comparison sample.
Missing required accepted metadata cannot be invented to enable a message.

## Validation boundary

Local XSD validity does not establish EUDAMED business-rule acceptance. Sterile
and Latex PATCH scenarios are blocked after recorded Playground rejections;
other unimplemented scenarios must not be treated as available. Operators review
ZIP contents, submit manually, retain responses and import acknowledgements.
Live lookup, automatic submission, AS4/eDelivery/M2M and polling remain deferred.
