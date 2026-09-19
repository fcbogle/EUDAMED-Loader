# EUDAMED schema profiles

Prepared 19 September 2026.

| Profile | Directory | Provenance |
|---|---|---|
| Prod | `prod-3.0.30/` | Official European Commission Production XSD package; message version 3.0.30. |
| Dev (Playground) | `dev-3.0.32-derived/` | Copy of the existing project bundle. Based on 3.0.30 with the message version constraint changed to 3.0.32; not an official 3.0.32 release. |

## Production source

[Official Production documentation](https://webgate.ec.europa.eu/eudamed-help/en/documentation/technical-documentation.html) identifies the package as 3.0.30. Its relative download link returned 404 through the documentation path; the archive was downloaded successfully from the official site's [files directory](https://webgate.ec.europa.eu/eudamed-help/en/files/XSD%20schemas.zip).

`manifest.json` records the archive SHA-256, per-file hashes and the exact comparison with the preserved Dev bundle. Production files are extracted unchanged. Dev files are copied unchanged from the active bundle, excluding OS metadata.

## Profile selection

Dev/Prod configuration now selects these profile directories. Dev defaults to `dev-3.0.32-derived`; Prod requires explicit configuration selecting `prod-3.0.30`. The old `data/schemas` tree is retained. Separate roots keep recursive schema inventory scans limited to the selected bundle. See [environment profiles](../../docs/environment-profiles.md) for startup commands and isolation checks. No production database or baseline has been created.

The selected environment binds these settings together:

```dotenv
# Prod
EUDAMED_SCHEMA_DIR=data/schema_profiles/prod-3.0.30
EUDAMED_MESSAGE_SCHEMA_VERSION=3.0.30

# Dev (a separate configuration)
EUDAMED_SCHEMA_DIR=data/schema_profiles/dev-3.0.32-derived
EUDAMED_MESSAGE_SCHEMA_VERSION=3.0.32
```

Both `service/Message.xsd` entrypoints compile successfully with lxml. This verifies that their dependencies resolve and schemas compile, not full compatibility with EUDAMED business rules. Dev's successful Playground history covers tested payloads; it does not establish equivalence to the official 3.0.32 schema.

## Comparison findings

Both bundles contain the same 68 files. Four differ:

- `service/Message/MessageType.xsd`: Production fixes the message version at 3.0.30; preserved Dev fixes it at 3.0.32.
- `service/Service/ServiceType.xsd`: downloaded Production includes additional Basic UDI/UDI-DI date-time search criteria and `SearchId`, absent from preserved Dev.
- `data/Entity/Certificate/RefusedCertificateType.xsd`: downloaded Production uses `stringSRNType` for `NBActorCode`; preserved Dev uses `stringNBActorCodeType`.
- `data/Entity/Device/RegulationDevice/UDIDIType.xsd`: a documentation comment describes unspecified reuse count as `1` in downloaded Production versus `-1` in preserved Dev. This is a comment difference, not an XSD constraint change; do not change emitted values based on this comment alone.

The historical project bundle is therefore not byte-identical to this freshly downloaded official 3.0.30 package even before its message-version edit. Both are retained as obtained; no attempt was made to merge their differences.
