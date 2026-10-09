# Market Info parity status and verification checklist

Reviewed 9 October 2026. The original August 2026 implementation checklist is
superseded: dedicated assessments and shared refresh/selection plumbing now exist.
This document separates implemented behavior from remaining manual verification.

## Implemented

- `OperationAssessmentType` includes `single_market_info` and `bulk_market_info`.
- `OperationAssessmentService` implements both assessments; routes are
  `/api/xml/assess-single-market-info` and `/api/xml/assess-bulk-market-info`.
- `xmlAssessmentRequest.ts` dispatches all six visible operations, including both
  Market Info flows. `useSuccessXmlUpload` refreshes assessments and read models
  with guards against applying results to a changed device/operation scope.
- `useBulkPostedCohorts` supplies shared posted-parent/device selection for Bulk
  PATCH and Bulk Market Info. Successful DEVICE.POST seeds qualify alongside
  UDI_DI.POST/PATCH evidence after the September 28 cohort fix.
- Single and bulk Market Info have preview, local XSD validation, ZIP download,
  exact-package review recording and acknowledgement import.
- Market Info state/version remains separate from core device/PATCH state.
  Next version uses the accepted version and any observed EUDAMED version floor.
- Mixed starting country lists are permitted for an explicit bulk target list;
  each device retains its own accepted baseline and next version. The earlier
  proposal to block solely because countries differ is superseded.
- Backend and frontend automated tests exist. The frontend uses Node-based
  helper/component/hook tests; they do not establish browser or live portal behavior.

Preview panels may retain operation-specific details. Similar assessment and
refresh behavior does not require collapsing them into one component.

## Remaining operator checks

- Confirm blocked/available/partial assessments explain parent/device scope,
  eligible children, accepted countries, proposed countries and version basis.
- Check exact-device selection, catalogue dialog behavior and scope changes while
  preview or acknowledgement requests are in flight.
- Verify post-acknowledgement refresh displays accepted SQLite state rather than
  the last unsent country draft.
- Exercise mixed baseline countries/versions, exclusions, mixed success/error
  responses, duplicate uploads and delayed acknowledgements in controlled testing.
- Verify PATCH after Market Info preserves the newly accepted countries and
  non-target accepted device fields.

Historical Playground results are recorded in the
[handoff](session-handoff.md) and [test report](eudamed-playground-test-report.md).
Do not treat all checks above as newly executed during this documentation sweep.

## Production boundary

Production imported accepted snapshots now supplement successful registration
acknowledgements. The [importer contract](production-importer-design.md) records
synthetic verification of assessment, Upload Success XML, version progression and
retained countries. First local Production import/operator checks remain pending.
No upload transport was introduced.
