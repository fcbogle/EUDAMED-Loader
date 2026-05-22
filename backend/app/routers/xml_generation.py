from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services.echelon_xml_generation import EchelonXmlGenerationService

router = APIRouter(tags=["xml-generation"])


@router.post("/xml/echelon/preview-record")
def preview_echelon_record(payload: dict[str, str]) -> dict:
    catalogue_number = payload.get("catalogue_number")
    if not catalogue_number:
        raise HTTPException(status_code=400, detail="catalogue_number is required.")
    try:
        preview = EchelonXmlGenerationService().preview_single_record(catalogue_number)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/echelon/download-record")
def download_echelon_record(payload: dict[str, str]) -> Response:
    catalogue_number = payload.get("catalogue_number")
    if not catalogue_number:
        raise HTTPException(status_code=400, detail="catalogue_number is required.")
    try:
        file_name, xml_bytes = EchelonXmlGenerationService().download_single_record(catalogue_number)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=xml_bytes, media_type="application/xml", headers=headers)


@router.post("/xml/echelon/preview-batch")
def preview_echelon_batch(payload: dict[str, int] | None = None) -> dict:
    chunk_sequence = (payload or {}).get("chunk_sequence", 1)
    try:
        preview = EchelonXmlGenerationService().preview_batch(chunk_sequence=chunk_sequence)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/echelon/download-batch")
def download_echelon_batch() -> Response:
    try:
        file_name, zip_bytes = EchelonXmlGenerationService().download_batch()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)
