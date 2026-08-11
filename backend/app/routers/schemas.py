from __future__ import annotations

from fastapi import APIRouter

from app.services.schema_inventory import SchemaInventoryService

router = APIRouter(tags=["schemas"])


@router.get("/schemas")
def schema_inventory() -> dict:
    return SchemaInventoryService().inventory().model_dump(mode="json")


@router.get("/schemas/critical-warning-codes")
def critical_warning_codes() -> list[dict[str, str]]:
    return SchemaInventoryService().critical_warning_codes()
