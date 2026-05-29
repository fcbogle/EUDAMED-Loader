from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services.xml_generation import XmlGenerationService

router = APIRouter(tags=["xml-generation"])


@router.get("/xml/scope")
def xml_generation_scope() -> dict:
    scope = XmlGenerationService().generation_scope()
    return scope.model_dump(mode="json")


@router.post("/xml/preview-record")
def preview_xml_record(payload: dict[str, str]) -> dict:
    product_family = payload.get("product_family")
    product_variant = payload.get("product_variant")
    catalogue_number = payload.get("catalogue_number")
    if not product_family or not product_variant or not catalogue_number:
        raise HTTPException(
            status_code=400,
            detail="product_family, product_variant, and catalogue_number are required.",
        )
    try:
        preview = XmlGenerationService().preview_single_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-record")
def download_xml_record(payload: dict[str, str]) -> Response:
    product_family = payload.get("product_family")
    product_variant = payload.get("product_variant")
    catalogue_number = payload.get("catalogue_number")
    if not product_family or not product_variant or not catalogue_number:
        raise HTTPException(
            status_code=400,
            detail="product_family, product_variant, and catalogue_number are required.",
        )
    try:
        file_name, xml_bytes = XmlGenerationService().download_single_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=xml_bytes, media_type="application/xml", headers=headers)


@router.post("/xml/preview-batch")
def preview_xml_batch(payload: dict[str, str | int] | None = None) -> dict:
    data = payload or {}
    product_family = data.get("product_family")
    product_variant = data.get("product_variant")
    chunk_sequence = int(data.get("chunk_sequence", 1))
    if not product_family or not product_variant:
        raise HTTPException(status_code=400, detail="product_family and product_variant are required.")
    try:
        preview = XmlGenerationService().preview_batch(
            product_family=str(product_family),
            product_variant=str(product_variant),
            chunk_sequence=chunk_sequence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-batch")
def download_xml_batch(payload: dict[str, str] | None = None) -> Response:
    data = payload or {}
    product_family = data.get("product_family")
    product_variant = data.get("product_variant")
    if not product_family or not product_variant:
        raise HTTPException(status_code=400, detail="product_family and product_variant are required.")
    try:
        file_name, zip_bytes = XmlGenerationService().download_batch(
            product_family=product_family,
            product_variant=product_variant,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)

