from __future__ import annotations

from typing import get_args, get_origin

import pytest
from fastapi import HTTPException
from pydantic import BaseModel

from app.canonical_models import BasicDevice, DeviceRecord, Manufacturer, MarketAvailability
from app.routers.canonical import canonical_validation
from app.services.canonical_projection import CanonicalProjectionNoImportError
from app.services.canonical_review import CanonicalReviewService
from app.services.canonical_validation import CanonicalValidationService


def _canonical_paths_for_model(model_class: type[BaseModel], prefix: str) -> set[str]:
    paths: set[str] = set()
    for field_name, field_info in model_class.model_fields.items():
        path = f"{prefix}.{field_name}"
        paths.add(path)

        annotation = field_info.annotation
        origin = get_origin(annotation)
        args = get_args(annotation)
        nested_model: type[BaseModel] | None = None

        if isinstance(annotation, type) and issubclass(annotation, BaseModel):
            nested_model = annotation
        elif origin in {list, tuple, set, frozenset}:
            for arg in args:
                if isinstance(arg, type) and issubclass(arg, BaseModel):
                    nested_model = arg
                    break
        elif origin is not None:
            for arg in args:
                if arg is type(None):
                    continue
                if isinstance(arg, type) and issubclass(arg, BaseModel):
                    nested_model = arg
                    break

        if nested_model is not None:
            paths.update(_canonical_paths_for_model(nested_model, path))
    return paths


def _canonical_path_vocabulary() -> set[str]:
    vocabulary = set()
    for prefix, model_class in (
        ("manufacturer", Manufacturer),
        ("basic_device", BasicDevice),
        ("device_record", DeviceRecord),
        ("market_availability", MarketAvailability),
    ):
        vocabulary.update(_canonical_paths_for_model(model_class, prefix))
    return vocabulary


def test_canonical_status_normalizes_short_eu_market_value() -> None:
    assert CanonicalValidationService._status_code("On the EU") == "ON_THE_MARKET"


def test_canonical_validation_service_builds_multi_family_bundle() -> None:
    CanonicalValidationService.clear_cache()
    bundle = CanonicalValidationService().build_validation_bundle()

    assert bundle.family_scope == "In-scope non-accessories families"
    assert bundle.total_source_records > 0
    assert bundle.validation_subset_records > 0
    assert bundle.total_source_records == bundle.validation_subset_records
    assert bundle.matched_reference_records == bundle.validation_subset_records
    assert bundle.excluded_records == 0
    assert bundle.tracked_required_fields > 0
    assert bundle.tracked_xml_required_fields > 0
    assert bundle.ready_records + bundle.blocked_records == bundle.validation_subset_records
    assert bundle.xml_ready_records + bundle.xml_blocked_records == bundle.validation_subset_records
    assert len(bundle.family_summaries) == 5
    assert {summary.product_family for summary in bundle.family_summaries} == {
        "Echelon",
        "Elan",
        "Elite",
        "Epirus / Esprit",
        "Navigator / Javelin / Linx",
    }
    assert len(bundle.variant_summaries) == 14
    assert any(summary.product_variant == "Echelon ER" for summary in bundle.variant_summaries)
    assert any(summary.product_variant == "EliteVT" for summary in bundle.variant_summaries)
    assert all(
        summary.workbook != "Template for Accessories_Footspares EUDAMED.xlsx"
        for summary in bundle.deferred_scope_summaries
    )
    assert bundle.source_field_total > 0
    assert any(summary.status == "represented" for summary in bundle.source_field_coverage_summaries)
    assert len(bundle.sample_records) == 14

    record = bundle.records[0]
    assert record.product_family in {
        "Echelon",
        "Elan",
        "Elite",
        "Epirus / Esprit",
        "Navigator / Javelin / Linx",
    }
    assert record.product_variant is not None
    assert record.submission_operation in {"POST", "PATCH"}
    assert record.xml_readiness.total_required_fields > 0
    assert any(field.canonical_path == "basic_device.basic_udi_di" for field in record.fields)
    assert any(field.canonical_path == "manufacturer.manufacturer_srn" for field in record.fields)
    assert any(field.canonical_path == "device_record.production_identifier" for field in record.fields)
    assert any(field.canonical_path == "device_record.market_availabilities" for field in record.fields)
    assert any(field.canonical_path == "basic_device.authorised_representative_srn" for field in record.fields)


def test_canonical_validation_field_set_matches_canonical_review_bundle() -> None:
    CanonicalValidationService.clear_cache()
    bundle = CanonicalValidationService().build_validation_bundle()
    review_bundle = CanonicalReviewService().load_review_bundle()

    validation_paths = {field.canonical_path for field in bundle.records[0].fields}
    canonical_paths = {
        field_review.mapping.canonical_path
        for entity_review in review_bundle.entity_reviews
        for field_review in entity_review.field_reviews
    }

    assert validation_paths == canonical_paths


def test_canonical_validation_field_set_uses_declared_canonical_model_paths() -> None:
    CanonicalValidationService.clear_cache()
    bundle = CanonicalValidationService().build_validation_bundle()
    canonical_vocabulary = _canonical_path_vocabulary()

    emitted_paths = {field.canonical_path for field in bundle.records[0].fields}
    invalid_paths = sorted(emitted_paths - canonical_vocabulary)

    assert invalid_paths == []


def test_canonical_validation_emits_unique_canonical_paths_per_record() -> None:
    CanonicalValidationService.clear_cache()
    bundle = CanonicalValidationService().build_validation_bundle()

    emitted_paths = [field.canonical_path for field in bundle.records[0].fields]

    assert len(emitted_paths) == len(set(emitted_paths))


def test_canonical_validation_service_payload_returns_multi_family_payload() -> None:
    payload = CanonicalValidationService().build_validation_bundle().model_dump(mode="json")

    assert payload["family_scope"] == "In-scope non-accessories families"
    assert len(payload["family_summaries"]) == 5
    assert len(payload["variant_summaries"]) == 14
    assert payload["xml_blocked_records"] >= payload["blocked_records"]
    assert payload["records"][0]["product_variant"]


def test_canonical_validation_route_requires_import(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.routers.canonical.CanonicalProjectionService.latest_bundle",
        lambda self, require_import=False: (_ for _ in ()).throw(
            CanonicalProjectionNoImportError(
                "No workbook import snapshot exists yet. Import workbooks before loading canonical validation."
            )
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        canonical_validation()

    assert exc_info.value.status_code == 404
    assert "Import workbooks before loading canonical validation" in str(exc_info.value.detail)


def test_canonical_validation_recognizes_alternate_udi_di_header_variants() -> None:
    CanonicalValidationService.clear_cache()
    bundle = CanonicalValidationService().build_validation_bundle()

    target = next(
        record
        for record in bundle.records
        if record.product_family == "Navigator / Javelin / Linx"
        and record.product_variant == "Navigator"
        and record.catalogue_number == "NAV22LWO"
    )

    assert target.primary_udi_di == "05050649089343"
    assert "Primary UDI-DI is not populated." not in target.blockers
    assert "UDI-DI Identifier is not populated." not in target.blockers


def test_canonical_validation_uses_legacy_tracekey_srn_fallback_for_all_products() -> None:
    CanonicalValidationService.clear_cache()
    bundle = CanonicalValidationService().build_validation_bundle()

    echelon_target = next(
        record
        for record in bundle.records
        if record.product_family == "Echelon" and record.product_variant == "Echelon" and record.catalogue_number == "EC22L1S"
    )
    manufacturer_field = next(
        field for field in echelon_target.fields if field.canonical_path == "manufacturer.manufacturer_srn"
    )
    ar_field = next(
        field for field in echelon_target.fields if field.canonical_path == "basic_device.authorised_representative_srn"
    )

    assert manufacturer_field.value == "UK-MF-000048777"
    assert manufacturer_field.source == "legacy_basic_udi_reference"
    assert ar_field.value == "DE-AR-000006292"
    assert ar_field.source == "legacy_basic_udi_reference"
    assert "Manufacturer SRN is not populated for XML generation." not in echelon_target.xml_blockers

    non_echelon_target = next(
        record
        for record in bundle.records
        if record.product_family == "Elan" and record.product_variant == "Elan"
    )
    non_echelon_manufacturer_field = next(
        field for field in non_echelon_target.fields if field.canonical_path == "manufacturer.manufacturer_srn"
    )
    non_echelon_ar_field = next(
        field
        for field in non_echelon_target.fields
        if field.canonical_path == "basic_device.authorised_representative_srn"
    )

    assert non_echelon_manufacturer_field.value == "UK-MF-000048777"
    assert non_echelon_manufacturer_field.source == "legacy_basic_udi_reference"
    assert non_echelon_ar_field.value == "DE-AR-000006292"
    assert non_echelon_ar_field.source == "legacy_basic_udi_reference"
    assert "Manufacturer SRN is not populated for XML generation." not in non_echelon_target.xml_blockers


def test_canonical_validation_reuses_cached_bundle_when_inputs_do_not_change() -> None:
    CanonicalValidationService.clear_cache()

    first = CanonicalValidationService().build_validation_bundle()
    second = CanonicalValidationService().build_validation_bundle()

    assert first is second
