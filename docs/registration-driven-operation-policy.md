# Registration-driven POST/PATCH policy

The owner confirmed that the former testing-era POST/PATCH label must no longer
control operational selection. The same policy applies independently to Dev and
Production, using each environment's configured database and accepted evidence.

| Evidence in the active environment | Operational designation |
| --- | --- |
| Device registered, supported by a successful registration event or an imported accepted baseline | PATCH |
| No supported device registration evidence | POST candidate, subject to data/identity checks and operator confirmation |
| Registration lookup unavailable | Unresolved; do not infer a designation from a source label |

The owner clarified that status labels describe source membership:
**Registered** means recorded EUDAMED registration evidence; **Unregistered** means
present in imported Template or BasicUDI workbook data but absent from that
evidence; **Unknown** means absent from all those sources. This applies to Device
UDI-DIs and Basic UDI-DIs, independently in each environment. Identity problems
remain separate generation blockers. These labels do not imply a live EUDAMED
lookup or complete coverage of parent-only registrations. A POST candidate still
requires data/identity checks and operator review.

## Implemented behavior

- Single POST, bulk parent/child POST and readiness selection no longer filter on
  imported `submission_operation` for either environment.
- Actual POST XML is projected explicitly as POST without changing source data.
- Registered devices are excluded by registration-based operational assessment,
  next-candidate selection and bulk rules. The single POST package download also
  rechecks registration and refuses a duplicate, including after a stale preview.
- Known parent registration selects child UDI-DI POST; the existing parent-first
  bulk split remains intact.
- PATCH and Market Info readiness require actual registration evidence. Existing
  accepted-state/version/country safeguards still apply.
- Legacy flags such as `post_success`, `baseline_patch_success` and testing-wave
  exclusions do not assign the operational designation. They remain historical
  fields; they are not rewritten or converted into successful submissions.
- The readiness API supplies `registration_known` and `operational_operation`.
  Frontend POST candidate counts use server readiness. The PATCH selector accepts
  successful-event/imported-baseline evidence, excluding a legacy flag alone.
- Source POST/PATCH counters and the canonical source-operation badge were removed
  from current-status displays. Mapping details label the retained source field
  **Historical source label (unused)**. Registration/audit table totals are no
  longer labelled as testing-data rows.
- Preview anchors no longer unconditionally claim EUDAMED acceptance: their text
  states whether registration is evidenced in Dev / Playground or Production.

Source workbooks, raw mappings and their recorded operation values are preserved
for provenance. Source-oriented XML diagnostics/fixtures are separate from the
operational POST/PATCH workspace policy. The operation policy does not rewrite
historical events or source status. The separately approved Dev coverage
confirmation adds one metadata table/record; environment paths and existing data
tables remain unchanged.

## Scope and verification

Implementation is in the feature worktree. Main and the operational Production
application/database were not changed. Production behavior is tested using
synthetic, isolated databases only. A regression uses the exact same synthetic
UDI in separate Dev and Production databases, proving that a Dev registration
does not establish a Production registration.

Synthetic tests cover both environments, old PATCH source labels, legacy flags,
POST/child-POST rendering, registered-device exclusion and duplicate download
blocking. Read-only runtime checks against Dev preserve the approved baseline,
validate POST previews for Echelon/ER/VT and child POST for Echelon VAC, and compare
database fingerprints. Full test results are in `session-handoff.md`.

Restart the Dev backend and refresh its frontend before reviewing the new labels
and candidates. Production rollout requires a separate reviewed merge/release;
this feature change is not a Production data reconciliation.

The latest source-label verification passed 344 backend tests (234.94 seconds),
40 focused registration tests, 123 frontend tests and the build. Both operational
database fingerprints are unchanged during this label clarification. Main is
clean, and the feature changes are not yet committed. Operator browser acceptance
and a separately reviewed Production rollout remain outstanding.
