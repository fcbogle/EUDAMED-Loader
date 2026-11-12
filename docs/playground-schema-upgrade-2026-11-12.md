# Playground schema upgrade — November 12, 2026

The owner approved comparison, Dev integration and regression verification for
XSD 3.0.36.1. This change does not import the supplied sources or perform manual
Playground submissions. Production remains on its existing official 3.0.30
profile in both configuration and schema bytes.

## Schema impact

Compared the preserved derived 3.0.32 profile with the official 3.0.36.1 package.
Ignored XML comments, documentation annotations and formatting for the core
constraint comparison; the stored official files themselves remain unchanged.

| Area | Finding and consequence |
| --- | --- |
| Basic UDI, UDI-DI, common device and Market Info type definitions | Same constraints after documentation/formatting removal; existing XML field mappings and payload ordering remain applicable. |
| Message envelope | Version fixed at 3.0.36.1; additional certificate and SSCP payload alternatives. Existing device flow/service choices are retained. |
| Service search | Adds optional Basic UDI/UDI-DI date-time filters and SearchId. No automated search/M2M implemented. |
| Shared reuse-count type | integer-1ToMax now restricts xs:integer to -1 through 999999, instead of xs:short with minimum -1. Official schema enforces the new limits; no device values changed. |
| Country enumerations | General/non-EU lists remove some codes. EU, EEA/Turkey and EU-with-special market lists are unchanged. Every market country offered by the application validates in both retained official Dev and Production profiles. |
| Other modules | Actor, certificate, vigilance, market-surveillance and supporting definitions also differ. This is not an implementation or verification claim for those unrelated workflows. |

## Integration

- Dev defaults and `.env.dev.example` select
  `data/schema_profiles/dev-3.0.36.1-official` and version 3.0.36.1.
- The ignored local development-worktree `.env.dev` has the same two settings
  updated. Its existing actor, database, batch and output paths are retained.
  The original/main checkout profiles are unchanged. Other installations need
  to update their local Dev profile explicitly; process environment overrides
  still take precedence and stale 3.0.32 values will be rejected.
- The environment API/banner identifies the new profile as Official package.
- Source receipt, draft review, batch inspection and Playground reconciliation
  use the selected Dev schema version. Wrong manufacturer, absent version,
  old version and unsupported future version remain rejected.
- Reporting already compares retained extract versions with the active setting;
  it now selects suitable retained 3.0.36.1 sets. No reporting upload added.
- Source-check tokens include the selected message version, so checks/artifacts
  cannot remain current across a schema switch. Previous source bytes, batches,
  registration evidence and accepted-state history are not rewritten.
- Historical 3.0.32 source sets are preserved, but do not qualify for current
  source review or current-version retained report selection. Replace the full
  XML set through Data Import and review again. This does not invalidate or
  delete historical registration evidence recorded in the database.

## Verification

The local Dev `--check-config` reports 3.0.36.1 and compiles the official package
without starting services or opening SQLite. Production configuration remains
3.0.30; synthetic configuration tests cover its existing isolation checks.

All five owner-provided November 12 extracts pass official full XSD validation
and the updated source-admission validator. All 241 exported records project
through the existing accepted-snapshot reader without unsupported-field notes.
This read-only source smoke check does not create a batch or import database state.

Synthetic automated regressions cover single and combined DEVICE.POST,
UDI_DI.POST, UDI_DI.PATCH and MARKET_INFO.PUT against both official schema
profiles; package provenance hashes; current/unsupported source versions;
manufacturer mismatch; read-only report rejection of old-version evidence;
market-country compatibility and the new reuse-count boundaries. Existing
service-level tests additionally cover parent-only bulk registration, child-only
bulk registration, PATCH lineage, package persistence and transaction guardrails.

Verification completed: 460 backend tests passed in 241.27 seconds (two existing
FastAPI deprecation warnings); 136 frontend tests and the TypeScript/Vite build
passed (existing bundle-size advisory). All 143 protected file fingerprints,
including both operational databases and original/main checkpoints, are unchanged.
The session handoff records the delivery checkpoint.
Local XSD validity does not establish Playground business-rule acceptance.
Browser review and a controlled manual Playground submission remain separate
operator verification. No application server or live submission was started.

## Next operator step

Restart Dev from the development worktree after reviewing the completed checks.
Confirm the environment banner reports Playground, 3.0.36.1 and Official package.
Then start the fresh Data Import review with the eight supplied Templates,
October 9 BasicUDI reference and complete five-page November 12 extract.
Accessories remains excluded under the current scope. Review actual database
identity/catalogue differences before preparing or confirming an additive import.
