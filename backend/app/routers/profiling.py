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
