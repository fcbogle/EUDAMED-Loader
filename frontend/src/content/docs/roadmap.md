# Roadmap

Updated 9 October 2026. Implemented capabilities are separated from approved next
work and deferred features. This roadmap does not describe future features as
already available.

## Implemented foundation

- Dev raw-template workbook import, source profiling and canonical projections.
- SQLite source/identity persistence, testing history and accepted-state snapshots.
- Separate single/bulk POST, PATCH and Market Info workflows, local XSD validation,
  reviewed ZIP downloads and Upload Success XML reconciliation.
- Explicit Dev/Prod configuration and environment labels.
- Standalone Production preparation of To Register, Registered and Summary tabs,
  with a companion source/hash audit and exception reporting.

## Implemented — Production workbook importer

The owner approved the initial import flow and repeat-import policy:

- Preserve Dev raw-template import; select the prepared-workbook importer in Prod
  using the backend environment and the same SQLite structure/application workflows.
- Read the configured current workbook/audit pair, assess it, show counts and
  exceptions, then confirm import of the assessed content.
- Import only Review Required = No rows. Include all 940 optional-URL devices;
  defer the current five review rows.
- Record exported accepted baselines with explicit provenance, separately from
  successful submission acknowledgements. Preserve Upload Success XML and
  accepted-state/version progression.
- Use updated versions of the same workbook/audit pair for new devices and
  corrected exceptions. Add new eligible identities, skip unchanged devices,
  stop/report changed existing devices, retain absent devices and protect newer
  locally accepted state.
- Coherent fixed-name workbook/audit replacement and synthetic isolated-database
  verification of single/bulk workflows.

The importer and fixed-name replacement are implemented. First local Production
startup and reviewed import are next. Two eligible Echelon devices share catalogue
EC27LN7S and remain blocked for XML generation until identity selection is resolved.
Detailed contracts are in Production Importer Design under Documentation.

## Deferred — Production preparation UI

The owner requested a dedicated UI for importing new or updated device Template
workbooks, the applicable Basic UDI reference, and EUDAMED-generated export XMLs.
Design and implementation can wait until after the initial Production importer.

Planned scope:

- Select the preparation inputs and preserve original source evidence.
- Validate/reconcile templates and accepted XML, then show exceptions and source
  conflicts for review, with clear inclusion/exclusion counts.
- Generate an updated three-tab import workbook and matching audit from the
  reviewed inputs, using the existing preparation utility as the starting point.
- Maintain the same current workbook/audit pair for subsequent device imports.
- Keep workbook preparation separate from database import and its confirmation.

UI layout, file handling, exception-resolution controls and regeneration details
will be designed with the owner later. This feature is deferred and does not add
EUDAMED upload/M2M transport.

## Further workflow and data hardening

- Reduce field-name drift and harden source parsing against header variations.
- Continue controlled testing of accepted-state lineage, retained countries,
  partial responses and duplicate/delayed acknowledgements.
- Expand relational identity use and canonical/submission persistence as separate,
  reviewed increments; retain source and audit lineage.
- Measure generation performance on representative imports and in the browser.
- Keep operator documentation aligned with implemented behavior.

## Later — transport and operational deployment

- Design artifact retention, operational support and deployment controls.
- Extend submission-domain models and delivery adapters where approved.
- Consider M2M / AS4 only after the manual workflow is proven and explicitly approved.
