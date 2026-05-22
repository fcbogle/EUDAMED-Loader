from __future__ import annotations

from app.routers.canonical import echelon_canonical_validation
from app.services.echelon_validation import EchelonValidationService


def test_echelon_validation_service_builds_subset_bundle() -> None:
    bundle = EchelonValidationService().build_validation_bundle()

    assert bundle.family_scope == "Echelon only"
    assert bundle.total_source_records == 2946
    assert bundle.validation_subset_records == 2946
    assert bundle.excluded_records == 0
    assert bundle.matched_reference_records == 2946
    assert bundle.tracked_required_fields == 52
    assert bundle.after_complete_records == 2946
    assert len(bundle.sheet_summaries) == 4
    assert bundle.source_field_total == 36
    assert any(summary.status == "represented" and summary.field_count > 0 for summary in bundle.source_field_coverage_summaries)
    assert any(
        entry.coverage_status == "represented"
        and entry.source_field == "Clinical size applicable e.g. NO"
        for entry in bundle.source_field_coverage
    )
    assert any(
        entry.coverage_status == "represented"
        and entry.source_field == "Storage /handling conditions type e.g. Lower limit of temp"
        for entry in bundle.source_field_coverage
    )
    assert bundle.sheet_summaries[0].record_count >= 1
    assert any(summary.business_label == "Basic UDI-DI" for summary in bundle.blocker_summaries)
    assert len(bundle.sample_records) == 4

    record = bundle.records[0]
    assert record.catalogue_number == "EC22L1S"
    assert record.basic_reference_material_number == "5050649ECHELONMV"
    assert record.before_completeness.missing_required_fields == 16
    assert record.after_completeness.missing_required_fields == 0
    assert len(record.storage_condition_items) == 2
    assert record.storage_condition_items[0].item_type == "Lower limit of temp"
    assert record.storage_condition_items[0].normalized_code == "SHC006"
    assert len(record.critical_warning_items) == 1
    assert record.critical_warning_items[0].item_type == "Consult instructions for use"
    assert record.critical_warning_items[0].normalized_code == "CW010"
    assert any(field.canonical_path == "basic_device.basic_udi_di" for field in record.fields)


def test_echelon_validation_api_returns_scope_payload() -> None:
    payload = echelon_canonical_validation()

    assert payload["family_scope"] == "Echelon only"
    assert payload["validation_subset_records"] == 2946
    assert payload["excluded_records"] == 0
    assert len(payload["sheet_summaries"]) == 4
    assert payload["source_field_total"] == 36
    assert len(payload["source_field_coverage"]) == 36
    assert len(payload["sample_records"]) == 4
    assert payload["records"][0]["catalogue_number"] == "EC22L1S"
