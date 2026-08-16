from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models import WorkbookImportRunRequest
from app.services.excel_profile import ExcelProfiler
from app.services.workbook_import import WorkbookImportService

router = APIRouter(tags=["profiling"])


@router.get("/workbooks")
def list_workbooks() -> list[dict]:
    return [item.model_dump(mode="json") for item in ExcelProfiler().list_workbooks()]


@router.get("/reference-workbooks")
def list_reference_workbooks() -> list[dict]:
    return [item.model_dump(mode="json") for item in ExcelProfiler().list_reference_workbooks()]


@router.get("/sheets")
def list_sheets() -> list[dict]:
    return [item.model_dump(mode="json") for item in ExcelProfiler().list_sheets()]


@router.get("/sheet-profile")
def sheet_profile(
    workbook: str = Query(...),
    sheet: str = Query(...),
) -> dict:
    profile = ExcelProfiler().get_sheet_profile(workbook, sheet)
    if profile is None:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return profile.model_dump(mode="json")


@router.get("/distinct-values")
def distinct_values(
    column: str = Query(...),
    workbook: str | None = Query(default=None),
    sheet: str | None = Query(default=None),
) -> dict:
    profile = ExcelProfiler().get_distinct_values(column=column, workbook=workbook, sheet=sheet)
    return profile.model_dump(mode="json")


@router.post("/workbook-imports/run")
def run_workbook_import(payload: WorkbookImportRunRequest | None = None) -> dict:
    request = payload or WorkbookImportRunRequest()
    result = WorkbookImportService().run_import(
        imported_by=request.imported_by,
        label=request.label,
        notes=request.notes,
    )
    return result.model_dump(mode="json")


@router.get("/workbook-imports/latest")
def latest_workbook_import() -> dict:
    summary = WorkbookImportService().latest_import_batch()
    if summary is None:
        raise HTTPException(status_code=404, detail="No workbook imports have been recorded.")
    return summary.model_dump(mode="json")


@router.get("/workbook-imports/{import_batch_id}/workbooks")
def imported_workbooks(import_batch_id: int) -> list[dict]:
    return [
        item.model_dump(mode="json")
        for item in WorkbookImportService().imported_workbooks(import_batch_id=import_batch_id)
    ]


@router.get("/workbook-imports/latest/summary")
def latest_workbook_import_summary() -> dict:
    summary = WorkbookImportService().latest_import_snapshot_summary()
    if summary is None:
        raise HTTPException(status_code=404, detail="No workbook imports have been recorded.")
    return summary.model_dump(mode="json")


@router.get("/workbook-imports/schema-summary")
def workbook_import_schema_summary() -> dict:
    return WorkbookImportService().schema_summary().model_dump(mode="json")


@router.get("/workbook-imports/health")
def workbook_import_health_summary() -> dict:
    return WorkbookImportService().database_health_summary().model_dump(mode="json")


@router.get("/workbook-imports/latest/diff")
def latest_workbook_import_diff() -> dict:
    summary = WorkbookImportService().latest_import_diff_summary()
    if summary is None:
        raise HTTPException(status_code=404, detail="No workbook imports have been recorded.")
    return summary.model_dump(mode="json")


@router.get("/workbook-imports/device-subjects")
def list_device_subjects(
    product_family: str | None = Query(default=None),
    product_variant: str | None = Query(default=None),
    catalogue_number: str | None = Query(default=None),
    import_batch_id: int | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=10000),
) -> list[dict]:
    return [
        item.model_dump(mode="json")
        for item in WorkbookImportService().list_device_subjects(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
            import_batch_id=import_batch_id,
            limit=limit,
        )
    ]


@router.get("/workbook-imports/device-subjects/{subject_id}")
def get_device_subject(subject_id: int) -> dict:
    subject = WorkbookImportService().get_device_subject(subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Device subject not found.")
    return subject.model_dump(mode="json")


@router.get("/workbook-imports/source-rows")
def list_source_rows(
    product_family: str | None = Query(default=None),
    product_variant: str | None = Query(default=None),
    catalogue_number: str | None = Query(default=None),
    submission_operation: str | None = Query(default=None),
    import_batch_id: int | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=10000),
) -> list[dict]:
    return [
        item.model_dump(mode="json")
        for item in WorkbookImportService().list_source_rows(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
            submission_operation=submission_operation,
            import_batch_id=import_batch_id,
            limit=limit,
        )
    ]


@router.get("/workbook-imports/source-rows/{source_row_id}")
def get_source_row(source_row_id: int) -> dict:
    source_row = WorkbookImportService().get_source_row(source_row_id)
    if source_row is None:
        raise HTTPException(status_code=404, detail="Source row not found.")
    return source_row.model_dump(mode="json")


@router.get("/workbook-imports/identity-issues")
def list_device_identity_issues(
    issue_code: str | None = Query(default=None),
    product_family: str | None = Query(default=None),
    product_variant: str | None = Query(default=None),
    catalogue_number: str | None = Query(default=None),
    import_batch_id: int | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=10000),
) -> list[dict]:
    return [
        item.model_dump(mode="json")
        for item in WorkbookImportService().list_device_identity_issues(
            issue_code=issue_code,
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
            import_batch_id=import_batch_id,
            limit=limit,
        )
    ]


@router.get("/workbook-imports/identity-issues/{issue_id}")
def get_device_identity_issue(issue_id: int) -> dict:
    issue = WorkbookImportService().get_device_identity_issue(issue_id)
    if issue is None:
        raise HTTPException(status_code=404, detail="Device identity issue not found.")
    return issue.model_dump(mode="json")
