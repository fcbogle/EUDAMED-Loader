from __future__ import annotations

from collections.abc import Iterable
from typing import Protocol, TypedDict, cast

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.models import SuccessXmlUploadRequest, SuccessXmlUploadResult
from app.services.country_reference import market_country_reference_payload
from app.services.operation_assessment import OperationAssessmentService
from app.services.testing_read_model import TestingReadModelService
from app.services.testing_success_xml import TestingSuccessXmlService
from app.services.xml_generation import XmlGenerationService

router = APIRouter(tags=["xml-generation"])


class _BulkPatchPostedParentGroup(TypedDict):
    basic_udi_di: str
    posted_child_count: int
    sample_catalogue_numbers: list[str]


class _ModelDumpable(Protocol):
    def model_dump(self, *, mode: str) -> dict[str, object]: ...


def _xml_service() -> XmlGenerationService:
    return XmlGenerationService(require_import=True)


def _testing_read_model() -> TestingReadModelService:
    return TestingReadModelService()


def _operation_assessment() -> OperationAssessmentService:
    return OperationAssessmentService()


def _testing_success_xml() -> TestingSuccessXmlService:
    return TestingSuccessXmlService()


def _parse_market_info_countries(payload: dict[str, object]) -> list[tuple[str, bool]] | None:
    raw_items = payload.get("market_countries")
    if raw_items is None:
        return None
    if not isinstance(raw_items, list):
        raise HTTPException(status_code=400, detail="market_countries must be a list when provided.")
    parsed_items: list[tuple[str, bool]] = []
    for index, raw_item in enumerate(raw_items, start=1):
        if not isinstance(raw_item, dict):
            raise HTTPException(status_code=400, detail=f"market_countries[{index}] must be an object.")
        raw_country = raw_item.get("country")
        if not isinstance(raw_country, str) or not raw_country.strip():
            raise HTTPException(status_code=400, detail=f"market_countries[{index}].country is required.")
        raw_original = raw_item.get("original_placed_on_market", False)
        parsed_items.append((raw_country, bool(raw_original)))
    return parsed_items


def _required_market_info_countries(payload: dict[str, object]) -> list[tuple[str, bool]]:
    market_countries = _parse_market_info_countries(payload)
    if market_countries is None:
        raise HTTPException(status_code=400, detail="market_countries is required.")
    return market_countries


def _summary_entry(summary: dict | object) -> dict[str, object]:
    if isinstance(summary, dict):
        return cast(dict[str, object], summary)
    return cast(_ModelDumpable, summary).model_dump(mode="python")


def _required_payload_string(payload: dict[str, object], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise HTTPException(status_code=400, detail="product_family, product_variant, and catalogue_number are required.")
    return value.strip()


def _required_string_with_detail(payload: dict[str, object], key: str, detail: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise HTTPException(status_code=400, detail=detail)
    return value.strip()


def _payload_int(payload: dict[str, object], key: str, default: int) -> int:
    value = payload.get(key, default)
    if not isinstance(value, (int, float, str)):
        raise HTTPException(status_code=400, detail=f"{key} must be an integer.")
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"{key} must be an integer.") from exc


def _payload_nonempty_strings(payload: dict[str, object], key: str) -> list[str]:
    value = payload.get(key, [])
    if not isinstance(value, list):
        raise HTTPException(status_code=400, detail=f"{key} must be a list.")
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _bulk_patch_posted_entries_from_summaries(
    summaries: Iterable[object],
    *,
    basic_udi_di: str,
) -> list[dict[str, object]]:
    normalized_basic_udi_di = "".join(basic_udi_di.casefold().split())
    entries: list[dict[str, object]] = []
    for summary in summaries:
        entry = _summary_entry(summary)
        if not entry.get("post_success") or not entry.get("has_successful_child_post_or_patch"):
            continue
        entry_basic_udi_di = str(entry.get("basic_udi_di") or "").strip()
        if not entry_basic_udi_di or "".join(entry_basic_udi_di.casefold().split()) != normalized_basic_udi_di:
            continue
        entries.append(
            {
                "catalogue_number": entry.get("catalogue_number"),
                "primary_udi_di": entry.get("primary_udi_di"),
                "basic_udi_di": entry.get("basic_udi_di"),
                "latest_version": entry.get("latest_successful_version"),
                "baseline_patch_success": bool(entry.get("baseline_patch_success")),
            }
        )
    entries.sort(key=lambda item: str(item.get("catalogue_number") or ""))
    return entries


def _bulk_patch_posted_parent_groups_from_summaries(
    summaries: Iterable[object],
) -> list[_BulkPatchPostedParentGroup]:
    grouped: dict[str, _BulkPatchPostedParentGroup] = {}
    for summary in summaries:
        entry = _summary_entry(summary)
        if not entry.get("post_success") or not entry.get("has_successful_child_post_or_patch"):
            continue
        basic_udi_di = str(entry.get("basic_udi_di") or "").strip()
        catalogue_number = str(entry.get("catalogue_number") or "").strip()
        if not basic_udi_di:
            continue
        group = grouped.setdefault(
            basic_udi_di,
            {
                "basic_udi_di": basic_udi_di,
                "posted_child_count": 0,
                "sample_catalogue_numbers": [],
            },
        )
        group["posted_child_count"] += 1
        if (
            catalogue_number
            and len(group["sample_catalogue_numbers"]) < 10
            and catalogue_number not in group["sample_catalogue_numbers"]
        ):
            group["sample_catalogue_numbers"].append(catalogue_number)
    return [grouped[key] for key in sorted(grouped)]


def _parse_generated_patch_payload(payload: dict) -> tuple[str, str, str, str, str, dict]:
    typed_payload = cast(dict[str, object], payload)
    product_family = _required_string_with_detail(
        typed_payload,
        "product_family",
        "product_family, product_variant, catalogue_number, scenario_id, and patch_version are required.",
    )
    product_variant = _required_string_with_detail(
        typed_payload,
        "product_variant",
        "product_family, product_variant, catalogue_number, scenario_id, and patch_version are required.",
    )
    catalogue_number = _required_string_with_detail(
        typed_payload,
        "catalogue_number",
        "product_family, product_variant, catalogue_number, scenario_id, and patch_version are required.",
    )
    scenario_id = _required_string_with_detail(
        typed_payload,
        "scenario_id",
        "product_family, product_variant, catalogue_number, scenario_id, and patch_version are required.",
    )
    patch_version = payload.get("patch_version")
    scenario_inputs = payload.get("scenario_inputs") or {}
    if patch_version is None:
        raise HTTPException(
            status_code=400,
            detail="product_family, product_variant, catalogue_number, scenario_id, and patch_version are required.",
        )
    return (
        product_family,
        product_variant,
        catalogue_number,
        scenario_id,
        str(patch_version),
        scenario_inputs if isinstance(scenario_inputs, dict) else {},
    )


@router.get("/xml/scope")
def xml_generation_scope() -> dict:
    try:
        scope = _xml_service().generation_scope()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return scope.model_dump(mode="json")


@router.get("/xml/market-country-reference")
def market_country_reference() -> list[dict[str, object]]:
    return market_country_reference_payload()


@router.post("/xml/preview-record")
def preview_xml_record(payload: dict[str, str]) -> dict:
    typed_payload = cast(dict[str, object], payload)
    product_family = _required_payload_string(typed_payload, "product_family")
    product_variant = _required_payload_string(typed_payload, "product_variant")
    catalogue_number = _required_payload_string(typed_payload, "catalogue_number")
    try:
        preview = _xml_service().preview_single_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-record")
def download_xml_record(payload: dict[str, str]) -> Response:
    typed_payload = cast(dict[str, object], payload)
    product_family = _required_payload_string(typed_payload, "product_family")
    product_variant = _required_payload_string(typed_payload, "product_variant")
    catalogue_number = _required_payload_string(typed_payload, "catalogue_number")
    try:
        file_name, xml_bytes = _xml_service().download_single_record(
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
    typed_payload = cast(dict[str, object], payload)
    product_family = _required_payload_string(typed_payload, "product_family")
    product_variant = _required_payload_string(typed_payload, "product_variant")
    catalogue_number = _required_payload_string(typed_payload, "catalogue_number")
    try:
        preview = _xml_service().preview_post_registration(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/preview-next-post-registration")
def preview_xml_next_post_registration(payload: dict[str, str]) -> dict:
    typed_payload = cast(dict[str, object], payload)
    product_family = _required_string_with_detail(typed_payload, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(typed_payload, "product_variant", "product_family and product_variant are required.")
    try:
        preview = _xml_service().preview_next_post_registration(
            product_family=product_family,
            product_variant=product_variant,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-post-package")
def download_xml_post_package(payload: dict[str, str]) -> Response:
    typed_payload = cast(dict[str, object], payload)
    product_family = _required_payload_string(typed_payload, "product_family")
    product_variant = _required_payload_string(typed_payload, "product_variant")
    catalogue_number = _required_payload_string(typed_payload, "catalogue_number")
    try:
        file_name, zip_bytes = _xml_service().download_post_package(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)


@router.post("/xml/upload-success-xml")
def upload_success_xml(payload: SuccessXmlUploadRequest) -> SuccessXmlUploadResult:
    if not payload.xml_content.strip():
        raise HTTPException(status_code=400, detail="Upload a non-empty EUDAMED success XML file.")
    try:
        return _testing_success_xml().record_success_xml(
            xml_bytes=payload.xml_content.encode("utf-8"),
            source_file_name=payload.file_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/xml/preview-market-info-put")
def preview_xml_market_info_put(payload: dict[str, object]) -> dict:
    product_family = _required_payload_string(payload, "product_family")
    product_variant = _required_payload_string(payload, "product_variant")
    catalogue_number = _required_payload_string(payload, "catalogue_number")
    market_info_version = _required_string_with_detail(
        payload,
        "market_info_version",
        "product_family, product_variant, catalogue_number, and market_info_version are required.",
    )
    market_countries = _parse_market_info_countries(payload)
    try:
        preview = _xml_service().preview_market_info_put(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
            market_countries=market_countries,
            market_info_version=market_info_version,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-market-info-put")
def download_xml_market_info_put(payload: dict[str, object]) -> Response:
    product_family = _required_payload_string(payload, "product_family")
    product_variant = _required_payload_string(payload, "product_variant")
    catalogue_number = _required_payload_string(payload, "catalogue_number")
    market_info_version = _required_string_with_detail(
        payload,
        "market_info_version",
        "product_family, product_variant, catalogue_number, and market_info_version are required.",
    )
    market_countries = _parse_market_info_countries(payload)
    try:
        file_name, zip_bytes = _xml_service().download_market_info_put(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
            market_countries=market_countries,
            market_info_version=market_info_version,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)


@router.post("/xml/preview-generated-patch-scenario")
def preview_generated_patch_scenario(payload: dict) -> dict:
    product_family, product_variant, catalogue_number, scenario_id, patch_version, scenario_inputs = (
        _parse_generated_patch_payload(payload)
    )
    try:
        preview = _xml_service().preview_generated_patch_scenario(
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
        file_name, package_bytes = _xml_service().download_generated_patch_scenario(
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
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family and product_variant are required.")
    record_count = _payload_int(data, "record_count", 1)
    chunk_sequence = _payload_int(data, "chunk_sequence", 1)
    try:
        preview = _xml_service().preview_bulk_post(
            product_family=product_family,
            product_variant=product_variant,
            record_count=record_count,
            chunk_sequence=chunk_sequence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-bulk-post")
def download_xml_bulk_post(payload: dict[str, str | int] | None = None) -> Response:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(
        data,
        "product_family",
        "product_family and product_variant are required.",
    )
    product_variant = _required_string_with_detail(
        data,
        "product_variant",
        "product_family and product_variant are required.",
    )
    record_count = _payload_int(data, "record_count", 1)
    try:
        file_name, zip_bytes = _xml_service().download_bulk_post(
            product_family=product_family,
            product_variant=product_variant,
            record_count=record_count,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)


@router.post("/xml/preview-bulk-udidi-post")
def preview_xml_bulk_udidi_post(payload: dict[str, object] | None = None) -> dict:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family and product_variant are required.")
    record_count = _payload_int(data, "record_count", 1)
    chunk_sequence = _payload_int(data, "chunk_sequence", 1)
    selected_catalogue_numbers = _payload_nonempty_strings(data, "selected_catalogue_numbers")
    try:
        preview = _xml_service().preview_bulk_udidi_post(
            product_family=product_family,
            product_variant=product_variant,
            record_count=record_count,
            selected_catalogue_numbers=selected_catalogue_numbers,
            chunk_sequence=chunk_sequence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-bulk-udidi-post")
def download_xml_bulk_udidi_post(payload: dict[str, object] | None = None) -> Response:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family and product_variant are required.")
    record_count = _payload_int(data, "record_count", 1)
    selected_catalogue_numbers = _payload_nonempty_strings(data, "selected_catalogue_numbers")
    try:
        file_name, zip_bytes = _xml_service().download_bulk_udidi_post(
            product_family=product_family,
            product_variant=product_variant,
            record_count=record_count,
            selected_catalogue_numbers=selected_catalogue_numbers,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)


@router.post("/xml/preview-bulk-patch")
def preview_xml_bulk_patch(payload: dict | None = None) -> dict:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(
        data, "product_family", "product_family, product_variant, basic_udi_di, and scenario_id are required."
    )
    product_variant = _required_string_with_detail(
        data, "product_variant", "product_family, product_variant, basic_udi_di, and scenario_id are required."
    )
    basic_udi_di = _required_string_with_detail(
        data, "basic_udi_di", "product_family, product_variant, basic_udi_di, and scenario_id are required."
    )
    scenario_id = _required_string_with_detail(
        data, "scenario_id", "product_family, product_variant, basic_udi_di, and scenario_id are required."
    )
    record_count = _payload_int(data, "record_count", 1)
    chunk_sequence = _payload_int(data, "chunk_sequence", 1)
    scenario_inputs = data.get("scenario_inputs") or {}
    selected_catalogue_numbers = _payload_nonempty_strings(data, "selected_catalogue_numbers")
    try:
        preview = _xml_service().preview_bulk_patch(
            product_family=product_family,
            product_variant=product_variant,
            basic_udi_di=basic_udi_di,
            record_count=record_count,
            scenario_id=scenario_id,
            scenario_inputs=scenario_inputs if isinstance(scenario_inputs, dict) else {},
            selected_catalogue_numbers=selected_catalogue_numbers,
            chunk_sequence=chunk_sequence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-bulk-patch")
def download_xml_bulk_patch(payload: dict | None = None) -> Response:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(
        data, "product_family", "product_family, product_variant, basic_udi_di, and scenario_id are required."
    )
    product_variant = _required_string_with_detail(
        data, "product_variant", "product_family, product_variant, basic_udi_di, and scenario_id are required."
    )
    basic_udi_di = _required_string_with_detail(
        data, "basic_udi_di", "product_family, product_variant, basic_udi_di, and scenario_id are required."
    )
    scenario_id = _required_string_with_detail(
        data, "scenario_id", "product_family, product_variant, basic_udi_di, and scenario_id are required."
    )
    record_count = _payload_int(data, "record_count", 1)
    scenario_inputs = data.get("scenario_inputs") or {}
    selected_catalogue_numbers = _payload_nonempty_strings(data, "selected_catalogue_numbers")
    try:
        file_name, zip_bytes = _xml_service().download_bulk_patch(
            product_family=product_family,
            product_variant=product_variant,
            basic_udi_di=basic_udi_di,
            record_count=record_count,
            scenario_id=scenario_id,
            scenario_inputs=scenario_inputs if isinstance(scenario_inputs, dict) else {},
            selected_catalogue_numbers=selected_catalogue_numbers,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)


@router.post("/xml/preview-bulk-market-info")
def preview_xml_bulk_market_info(payload: dict | None = None) -> dict:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(
        data, "product_family", "product_family, product_variant, basic_udi_di, and market_countries are required."
    )
    product_variant = _required_string_with_detail(
        data, "product_variant", "product_family, product_variant, basic_udi_di, and market_countries are required."
    )
    basic_udi_di = _required_string_with_detail(
        data, "basic_udi_di", "product_family, product_variant, basic_udi_di, and market_countries are required."
    )
    market_countries = _required_market_info_countries(data)
    record_count = _payload_int(data, "record_count", 1)
    chunk_sequence = _payload_int(data, "chunk_sequence", 1)
    selected_catalogue_numbers = _payload_nonempty_strings(data, "selected_catalogue_numbers")
    try:
        preview = _xml_service().preview_bulk_market_info(
            product_family=product_family,
            product_variant=product_variant,
            basic_udi_di=basic_udi_di,
            record_count=record_count,
            market_countries=market_countries,
            selected_catalogue_numbers=selected_catalogue_numbers,
            chunk_sequence=chunk_sequence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


@router.post("/xml/download-bulk-market-info")
def download_xml_bulk_market_info(payload: dict | None = None) -> Response:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(
        data, "product_family", "product_family, product_variant, basic_udi_di, and market_countries are required."
    )
    product_variant = _required_string_with_detail(
        data, "product_variant", "product_family, product_variant, basic_udi_di, and market_countries are required."
    )
    basic_udi_di = _required_string_with_detail(
        data, "basic_udi_di", "product_family, product_variant, basic_udi_di, and market_countries are required."
    )
    market_countries = _required_market_info_countries(data)
    record_count = _payload_int(data, "record_count", 1)
    selected_catalogue_numbers = _payload_nonempty_strings(data, "selected_catalogue_numbers")
    try:
        file_name, zip_bytes = _xml_service().download_bulk_market_info(
            product_family=product_family,
            product_variant=product_variant,
            basic_udi_di=basic_udi_di,
            record_count=record_count,
            market_countries=market_countries,
            selected_catalogue_numbers=selected_catalogue_numbers,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)


@router.post("/xml/bulk-patch-posted-entries")
def bulk_patch_posted_entries(payload: dict | None = None) -> dict:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family, product_variant, and basic_udi_di are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family, product_variant, and basic_udi_di are required.")
    basic_udi_di = _required_string_with_detail(data, "basic_udi_di", "product_family, product_variant, and basic_udi_di are required.")
    entries = _testing_read_model().bulk_patch_posted_entries(
        product_family=product_family,
        product_variant=product_variant,
        basic_udi_di=basic_udi_di,
    )
    return {
        "product_family": product_family,
        "product_variant": product_variant,
        "basic_udi_di": basic_udi_di,
        "entries": entries,
    }


@router.post("/xml/bulk-patch-posted-parents")
def bulk_patch_posted_parents(payload: dict | None = None) -> dict:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family and product_variant are required.")
    summaries = _testing_read_model().list_subject_summaries(
        product_family=product_family,
        product_variant=product_variant,
        limit=10000,
    )
    groups = _bulk_patch_posted_parent_groups_from_summaries(summaries)
    return {
        "product_family": product_family,
        "product_variant": product_variant,
        "parents": groups,
    }


@router.post("/xml/testing-workspace-summary")
def testing_workspace_summary(payload: dict | None = None) -> dict:
    data = payload or {}
    summary = _testing_read_model().workspace_summary(
        product_family=str(data["product_family"]) if data.get("product_family") else None,
        product_variant=str(data["product_variant"]) if data.get("product_variant") else None,
    )
    return summary.model_dump(mode="json")


@router.post("/xml/assess-single-post")
def assess_single_post(payload: dict | None = None) -> dict:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family and product_variant are required.")
    assessment = _operation_assessment().assess_single_post(
        product_family=product_family,
        product_variant=product_variant,
        catalogue_number=str(data["catalogue_number"]) if data.get("catalogue_number") else None,
    )
    return assessment.model_dump(mode="json")


@router.post("/xml/assess-single-patch")
def assess_single_patch(payload: dict | None = None) -> dict:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family and product_variant are required.")
    assessment = _operation_assessment().assess_single_patch(
        product_family=product_family,
        product_variant=product_variant,
        catalogue_number=str(data["catalogue_number"]) if data.get("catalogue_number") else None,
    )
    return assessment.model_dump(mode="json")


@router.post("/xml/assess-single-market-info")
def assess_single_market_info(payload: dict | None = None) -> dict:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family and product_variant are required.")
    assessment = _operation_assessment().assess_single_market_info(
        product_family=product_family,
        product_variant=product_variant,
        catalogue_number=str(data["catalogue_number"]) if data.get("catalogue_number") else None,
    )
    return assessment.model_dump(mode="json")


@router.post("/xml/assess-bulk-post")
def assess_bulk_post(payload: dict | None = None) -> dict:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family and product_variant are required.")
    assessment = _operation_assessment().assess_bulk_post(
        product_family=product_family,
        product_variant=product_variant,
    )
    return assessment.model_dump(mode="json")


@router.post("/xml/assess-bulk-market-info")
def assess_bulk_market_info(payload: dict | None = None) -> dict:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family and product_variant are required.")
    assessment = _operation_assessment().assess_bulk_market_info(
        product_family=product_family,
        product_variant=product_variant,
        basic_udi_di=str(data["basic_udi_di"]) if data.get("basic_udi_di") else None,
    )
    return assessment.model_dump(mode="json")


@router.post("/xml/assess-bulk-patch")
def assess_bulk_patch(payload: dict | None = None) -> dict:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family and product_variant are required.")
    assessment = _operation_assessment().assess_bulk_patch(
        product_family=product_family,
        product_variant=product_variant,
        basic_udi_di=str(data["basic_udi_di"]) if data.get("basic_udi_di") else None,
    )
    return assessment.model_dump(mode="json")


@router.post("/xml/testing-subject-summaries")
def testing_subject_summaries(payload: dict | None = None) -> list[dict]:
    data = cast(dict[str, object], payload or {})
    limit = _payload_int(data, "limit", 200)
    if limit < 1 or limit > 10000:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 10000.")
    summaries = _testing_read_model().list_subject_summaries(
        product_family=str(data["product_family"]) if data.get("product_family") else None,
        product_variant=str(data["product_variant"]) if data.get("product_variant") else None,
        limit=limit,
    )
    return [summary.model_dump(mode="json") for summary in summaries]


@router.post("/xml/testing-events")
def testing_events(payload: dict | None = None) -> list[dict]:
    data = cast(dict[str, object], payload or {})
    limit = _payload_int(data, "limit", 500)
    if limit < 1 or limit > 10000:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 10000.")
    events = _testing_read_model().list_events(
        product_family=str(data["product_family"]) if data.get("product_family") else None,
        product_variant=str(data["product_variant"]) if data.get("product_variant") else None,
        limit=limit,
    )
    return [event.model_dump(mode="json") for event in events]


@router.get("/xml/testing-subjects/{subject_id}/history")
def testing_subject_history(subject_id: int) -> dict:
    history = _testing_read_model().subject_history(subject_id)
    if history is None:
        raise HTTPException(status_code=404, detail="Testing subject not found.")
    return history.model_dump(mode="json")


def preview_xml_batch(payload: dict[str, str | int] | None = None) -> dict:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family and product_variant are required.")
    chunk_sequence = _payload_int(data, "chunk_sequence", 1)
    try:
        preview = _xml_service().preview_batch(
            product_family=product_family,
            product_variant=product_variant,
            chunk_sequence=chunk_sequence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return preview.model_dump(mode="json")


def download_xml_batch(payload: dict[str, str | int] | None = None) -> Response:
    data = cast(dict[str, object], payload or {})
    product_family = _required_string_with_detail(data, "product_family", "product_family and product_variant are required.")
    product_variant = _required_string_with_detail(data, "product_variant", "product_family and product_variant are required.")
    try:
        file_name, zip_bytes = _xml_service().download_batch(
            product_family=product_family,
            product_variant=product_variant,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)
