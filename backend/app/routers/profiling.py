from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.services.excel_profile import ExcelProfiler

router = APIRouter(tags=["profiling"])


@router.get("/workbooks")
def list_workbooks() -> list[dict]:
    return [item.model_dump(mode="json") for item in ExcelProfiler().list_workbooks()]


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
