from __future__ import annotations

from app.routers.canonical import canonical_validation
from app.services.canonical_validation import CanonicalValidationService


def test_canonical_validation_service_builds_multi_family_bundle() -> None:
    bundle = CanonicalValidationService().build_validation_bundle()

    assert bundle.family_scope == "In-scope non-accessories families"
    assert bundle.total_source_records > 0
    assert bundle.validation_subset_records > 0
    assert bundle.matched_reference_records == bundle.validation_subset_records
    assert bundle.excluded_records > 0
    assert bundle.tracked_required_fields > 0
    assert bundle.ready_records + bundle.blocked_records == bundle.validation_subset_records
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
    assert any(summary.sheet_name == "Adaptors_Socket_Accessories" for summary in bundle.deferred_scope_summaries)
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
    assert any(field.canonical_path == "basic_device.basic_udi_di" for field in record.fields)
    assert any(field.canonical_path == "device_record.market_availabilities" for field in record.fields)


def test_canonical_validation_api_returns_multi_family_payload() -> None:
    payload = canonical_validation()

    assert payload["family_scope"] == "In-scope non-accessories families"
    assert len(payload["family_summaries"]) == 5
    assert len(payload["variant_summaries"]) == 14
    assert payload["records"][0]["product_variant"]


def test_canonical_validation_recognizes_alternate_udi_di_header_variants() -> None:
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
