from __future__ import annotations

from app.routers.canonical import echelon_canonical_validation
from app.services.echelon_validation import EchelonValidationService


def test_echelon_validation_service_builds_subset_bundle() -> None:
    bundle = EchelonValidationService().build_validation_bundle()

    assert bundle.family_scope == "Echelon only"
    assert bundle.total_source_records == 2946
    assert bundle.validation_subset_records == 1
    assert bundle.excluded_records == 2945
    assert bundle.matched_reference_records == 1
    assert bundle.after_complete_records == 1

    record = bundle.records[0]
    assert record.catalogue_number == "EVAC22L1S"
    assert record.basic_reference_material_number == "5050649ECHELONMV"
    assert record.before_completeness.missing_required_fields == 3
    assert record.after_completeness.missing_required_fields == 0
    assert any(field.canonical_path == "basic_device.basic_udi_di" for field in record.fields)


def test_echelon_validation_api_returns_scope_payload() -> None:
    payload = echelon_canonical_validation()

    assert payload["family_scope"] == "Echelon only"
    assert payload["validation_subset_records"] == 1
    assert payload["excluded_records"] == 2945
    assert payload["records"][0]["catalogue_number"] == "EVAC22L1S"
