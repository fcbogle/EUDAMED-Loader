"""Dev file preparation and read-only baseline comparison; no database imports."""
import sqlite3

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.config import get_settings
from app.services.dev_batch_preparation import DevBatchPreparation
from app.services.playground_reconciliation import PlaygroundReconciliation

router = APIRouter(prefix="/dev-input-batches", tags=["Dev input preparation"])


def service() -> DevBatchPreparation:
    try:
        return DevBatchPreparation(get_settings())
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


def execute(action):
    try:
        return action()
    except FileNotFoundError as exc:
        raise HTTPException(404, "Batch or prepared workbook not found") from exc
    except sqlite3.Error as exc:
        raise HTTPException(409, "The existing Dev database cannot be read for assessment; no baseline changes were made") from exc
    except (ValueError, KeyError, TypeError, OSError) as exc:
        raise HTTPException(409, str(exc)) from exc


class PreparationRequest(BaseModel):
    inspection_token: str


@router.get("")
def list_batches():
    return execute(service().list_batches)


@router.get("/{batch_id}")
def describe(batch_id: str):
    return execute(lambda: service().describe(batch_id))


@router.post("/{batch_id}/inspect")
def inspect(batch_id: str):
    return execute(lambda: service().inspect(batch_id))


@router.post("/{batch_id}/prepare")
def prepare(batch_id: str, request: PreparationRequest):
    return execute(lambda: service().prepare(batch_id, request.inspection_token))


@router.get("/{batch_id}/prepared/{artifact_id}/{kind}")
def download(batch_id: str, artifact_id: str, kind: str):
    instance = service()
    if kind == "package":
        data = execute(lambda: instance.package(batch_id, artifact_id))
        return Response(data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{batch_id}-workbook-and-audit.zip"'})
    if kind not in {"workbook", "audit"}:
        raise HTTPException(404, "Download type not found")
    _, workbook, audit = execute(lambda: instance.artifact(batch_id, artifact_id))
    path = workbook if kind == "workbook" else audit
    return FileResponse(path, filename=path.name, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if kind == "workbook" else "application/json")


@router.post("/{batch_id}/baseline-assessment")
def assess_playground_baseline(batch_id: str):
    settings = service().settings  # Enforce Dev-only before any database access.
    return execute(lambda: PlaygroundReconciliation(settings).create_report(batch_id))


@router.get("/{batch_id}/baseline-assessment/{report_id}/{kind}")
def download_baseline_assessment(batch_id: str, report_id: str, kind: str):
    settings = service().settings
    path = execute(lambda: PlaygroundReconciliation(settings).artifact(batch_id, report_id, kind))
    return FileResponse(path, filename=path.name, media_type="application/json" if kind == "json" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
