from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services.xml_generation import XmlGenerationService
from app.services.testing_state_store import TestingStateStore

router = APIRouter(tags=["xml-generation"])


def _parse_generated_patch_payload(payload: dict) -> tuple[str, str, str, str, str, dict]:
    product_family = payload.get("product_family")
    product_variant = payload.get("product_variant")
    catalogue_number = payload.get("catalogue_number")
    scenario_id = payload.get("scenario_id")
    patch_version = payload.get("patch_version")
    scenario_inputs = payload.get("scenario_inputs") or {}
    if not product_family or not product_variant or not catalogue_number or not scenario_id or patch_version is None:
        raise HTTPException(
            status_code=400,
            detail="product_family, product_variant, catalogue_number, scenario_id, and patch_version are required.",
        )
    return (
        str(product_family),
        str(product_variant),
        str(catalogue_number),
        str(scenario_id),
        str(patch_version),
        scenario_inputs if isinstance(scenario_inputs, dict) else {},
    )


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


@router.post("/xml/preview-post-registration")
def preview_xml_post_registration(payload: dict[str, str]) -> dict:
    product_family = payload.get("product_family")
    product_variant = payload.get("product_variant")
    catalogue_number = payload.get("catalogue_number")
    if not product_family or not product_variant or not catalogue_number:
        raise HTTPException(
            status_code=400,
            detail="product_family, product_variant, and catalogue_number are required.",
        )
    try:
        preview = XmlGenerationService().preview_post_registration(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-post-package")
def download_xml_post_package(payload: dict[str, str]) -> Response:
    product_family = payload.get("product_family")
    product_variant = payload.get("product_variant")
    catalogue_number = payload.get("catalogue_number")
    if not product_family or not product_variant or not catalogue_number:
        raise HTTPException(
            status_code=400,
            detail="product_family, product_variant, and catalogue_number are required.",
        )
    try:
        file_name, zip_bytes = XmlGenerationService().download_post_package(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)


@router.post("/xml/preview-market-info-put")
def preview_xml_market_info_put(payload: dict[str, str]) -> dict:
    product_family = payload.get("product_family")
    product_variant = payload.get("product_variant")
    catalogue_number = payload.get("catalogue_number")
    if not product_family or not product_variant or not catalogue_number:
        raise HTTPException(
            status_code=400,
            detail="product_family, product_variant, and catalogue_number are required.",
        )
    try:
        preview = XmlGenerationService().preview_market_info_put(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-market-info-put")
def download_xml_market_info_put(payload: dict[str, str]) -> Response:
    product_family = payload.get("product_family")
    product_variant = payload.get("product_variant")
    catalogue_number = payload.get("catalogue_number")
    if not product_family or not product_variant or not catalogue_number:
        raise HTTPException(
            status_code=400,
            detail="product_family, product_variant, and catalogue_number are required.",
        )
    try:
        file_name, xml_bytes = XmlGenerationService().download_market_info_put(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=xml_bytes, media_type="application/xml", headers=headers)


@router.post("/xml/preview-generated-patch-scenario")
def preview_generated_patch_scenario(payload: dict) -> dict:
    product_family, product_variant, catalogue_number, scenario_id, patch_version, scenario_inputs = (
        _parse_generated_patch_payload(payload)
    )
    try:
        preview = XmlGenerationService().preview_generated_patch_scenario(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
            scenario_id=scenario_id,
            patch_version=patch_version,
            scenario_inputs=scenario_inputs,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-generated-patch-scenario")
def download_generated_patch_scenario(payload: dict) -> Response:
    product_family, product_variant, catalogue_number, scenario_id, patch_version, scenario_inputs = (
        _parse_generated_patch_payload(payload)
    )
    try:
        file_name, package_bytes = XmlGenerationService().download_generated_patch_scenario(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
            scenario_id=scenario_id,
            patch_version=patch_version,
            scenario_inputs=scenario_inputs,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=package_bytes, media_type="application/zip", headers=headers)


@router.post("/xml/preview-bulk-post")
def preview_xml_bulk_post(payload: dict[str, str | int] | None = None) -> dict:
    data = payload or {}
    product_family = data.get("product_family")
    product_variant = data.get("product_variant")
    record_count = int(data.get("record_count", 1))
    chunk_sequence = int(data.get("chunk_sequence", 1))
    if not product_family or not product_variant:
        raise HTTPException(status_code=400, detail="product_family and product_variant are required.")
    try:
        preview = XmlGenerationService().preview_bulk_post(
            product_family=str(product_family),
            product_variant=str(product_variant),
            record_count=record_count,
            chunk_sequence=chunk_sequence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-bulk-post")
def download_xml_bulk_post(payload: dict[str, str | int] | None = None) -> Response:
    data = payload or {}
    product_family = data.get("product_family")
    product_variant = data.get("product_variant")
    record_count = int(data.get("record_count", 1))
    if not product_family or not product_variant:
        raise HTTPException(status_code=400, detail="product_family and product_variant are required.")
    try:
        file_name, zip_bytes = XmlGenerationService().download_bulk_post(
            product_family=product_family,
            product_variant=product_variant,
            record_count=record_count,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)


@router.post("/xml/preview-bulk-udidi-post")
def preview_xml_bulk_udidi_post(payload: dict[str, str | int] | None = None) -> dict:
    data = payload or {}
    product_family = data.get("product_family")
    product_variant = data.get("product_variant")
    record_count = int(data.get("record_count", 1))
    chunk_sequence = int(data.get("chunk_sequence", 1))
    if not product_family or not product_variant:
        raise HTTPException(status_code=400, detail="product_family and product_variant are required.")
    try:
        preview = XmlGenerationService().preview_bulk_udidi_post(
            product_family=str(product_family),
            product_variant=str(product_variant),
            record_count=record_count,
            chunk_sequence=chunk_sequence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-bulk-udidi-post")
def download_xml_bulk_udidi_post(payload: dict[str, str | int] | None = None) -> Response:
    data = payload or {}
    product_family = data.get("product_family")
    product_variant = data.get("product_variant")
    record_count = int(data.get("record_count", 1))
    if not product_family or not product_variant:
        raise HTTPException(status_code=400, detail="product_family and product_variant are required.")
    try:
        file_name, zip_bytes = XmlGenerationService().download_bulk_udidi_post(
            product_family=str(product_family),
            product_variant=str(product_variant),
            record_count=record_count,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)


@router.post("/xml/preview-bulk-patch")
def preview_xml_bulk_patch(payload: dict | None = None) -> dict:
    data = payload or {}
    product_family = data.get("product_family")
    product_variant = data.get("product_variant")
    basic_udi_di = data.get("basic_udi_di")
    scenario_id = data.get("scenario_id")
    record_count = int(data.get("record_count", 1))
    chunk_sequence = int(data.get("chunk_sequence", 1))
    scenario_inputs = data.get("scenario_inputs") or {}
    selected_catalogue_numbers = data.get("selected_catalogue_numbers") or []
    if not product_family or not product_variant or not basic_udi_di or not scenario_id:
        raise HTTPException(
            status_code=400,
            detail="product_family, product_variant, basic_udi_di, and scenario_id are required.",
        )
    try:
        preview = XmlGenerationService().preview_bulk_patch(
            product_family=str(product_family),
            product_variant=str(product_variant),
            basic_udi_di=str(basic_udi_di),
            record_count=record_count,
            scenario_id=str(scenario_id),
            scenario_inputs=scenario_inputs if isinstance(scenario_inputs, dict) else {},
            selected_catalogue_numbers=[
                str(value) for value in selected_catalogue_numbers if isinstance(value, str) and value.strip()
            ],
            chunk_sequence=chunk_sequence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-bulk-patch")
def download_xml_bulk_patch(payload: dict | None = None) -> Response:
    data = payload or {}
    product_family = data.get("product_family")
    product_variant = data.get("product_variant")
    basic_udi_di = data.get("basic_udi_di")
    scenario_id = data.get("scenario_id")
    record_count = int(data.get("record_count", 1))
    scenario_inputs = data.get("scenario_inputs") or {}
    selected_catalogue_numbers = data.get("selected_catalogue_numbers") or []
    if not product_family or not product_variant or not basic_udi_di or not scenario_id:
        raise HTTPException(
            status_code=400,
            detail="product_family, product_variant, basic_udi_di, and scenario_id are required.",
        )
    try:
        file_name, zip_bytes = XmlGenerationService().download_bulk_patch(
            product_family=str(product_family),
            product_variant=str(product_variant),
            basic_udi_di=str(basic_udi_di),
            record_count=record_count,
            scenario_id=str(scenario_id),
            scenario_inputs=scenario_inputs if isinstance(scenario_inputs, dict) else {},
            selected_catalogue_numbers=[
                str(value) for value in selected_catalogue_numbers if isinstance(value, str) and value.strip()
            ],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)


@router.post("/xml/bulk-patch-posted-entries")
def bulk_patch_posted_entries(payload: dict | None = None) -> dict:
    data = payload or {}
    product_family = data.get("product_family")
    product_variant = data.get("product_variant")
    basic_udi_di = data.get("basic_udi_di")
    if not product_family or not product_variant or not basic_udi_di:
        raise HTTPException(
            status_code=400,
            detail="product_family, product_variant, and basic_udi_di are required.",
        )
    entries = TestingStateStore().posted_entries(
        product_family=str(product_family),
        product_variant=str(product_variant),
        basic_udi_di=str(basic_udi_di),
    )
    return {
        "product_family": str(product_family),
        "product_variant": str(product_variant),
        "basic_udi_di": str(basic_udi_di),
        "entries": entries,
    }


@router.post("/xml/bulk-patch-posted-parents")
def bulk_patch_posted_parents(payload: dict | None = None) -> dict:
    data = payload or {}
    product_family = data.get("product_family")
    product_variant = data.get("product_variant")
    if not product_family or not product_variant:
        raise HTTPException(
            status_code=400,
            detail="product_family and product_variant are required.",
        )
    groups = TestingStateStore().posted_parent_groups(
        product_family=str(product_family),
        product_variant=str(product_variant),
    )
    return {
        "product_family": str(product_family),
        "product_variant": str(product_variant),
        "parents": groups,
    }


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


def download_xml_batch(payload: dict[str, str | int] | None = None) -> Response:
    data = payload or {}
    product_family = data.get("product_family")
    product_variant = data.get("product_variant")
    if not product_family or not product_variant:
        raise HTTPException(status_code=400, detail="product_family and product_variant are required.")
    try:
        file_name, zip_bytes = XmlGenerationService().download_batch(
            product_family=str(product_family),
            product_variant=str(product_variant),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)
