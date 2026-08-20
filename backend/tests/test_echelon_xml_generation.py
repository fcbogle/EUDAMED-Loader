from __future__ import annotations

from io import BytesIO
from types import SimpleNamespace
from typing import cast
from zipfile import ZipFile

from fastapi import HTTPException

from app.config import get_settings
from app.services.canonical_validation import CanonicalValidationService
from app.routers.xml_generation import (
    download_generated_patch_scenario,
    download_xml_bulk_patch,
    download_xml_market_info_put,
    download_xml_batch,
    download_xml_record,
    preview_generated_patch_scenario,
    preview_xml_next_post_registration,
    preview_xml_bulk_patch,
    preview_xml_market_info_put,
    preview_xml_batch,
    preview_xml_record,
)
from app.services.xml_generation import XmlGenerationService
from app.services.xml_selection import ValidationRecordSelector
from app.validation_models import CanonicalValidationBundle, CanonicalValidationRecord


def test_required_positive_int_input_rejects_bool_values() -> None:
    service = XmlGenerationService()

    try:
        service._required_positive_int_input({"new_base_quantity": True}, "new_base_quantity")
    except ValueError as exc:
        assert str(exc) == "new_base_quantity must be a positive integer."
    else:
        raise AssertionError("Expected ValueError for boolean base quantity input.")


def test_generic_single_record_preview_generates_schema_valid_xml() -> None:
    preview = XmlGenerationService().preview_single_record(
        product_family="Echelon",
        product_variant="Echelon",
        catalogue_number="EC22L1S",
    )

    assert preview.file_name == "echelon-echelon-EC22L1S.xml"
    assert preview.product_family == "Echelon"
    assert preview.product_variant == "Echelon"
    assert preview.submission_operation == "PATCH"
    assert preview.catalogue_number == "EC22L1S"
    assert preview.validation.valid is True
    assert "<m:Push" in preview.xml
    assert "<s:serviceOperation>PATCH</s:serviceOperation>" in preview.xml


def test_generic_single_record_preview_normalizes_udi_pi_variants_for_elan_ic() -> None:
    preview = XmlGenerationService().preview_single_record(
        product_family="Elan",
        product_variant="Elan IC",
        catalogue_number="ELANIC22L1S",
    )

    assert preview.validation.valid is True
    assert "<udidi:productionIdentifier>SERIALISATION_NUMBER</udidi:productionIdentifier>" in preview.xml


def test_generic_preview_route_returns_single_record_payload() -> None:
    payload = preview_xml_record(
        {
            "product_family": "Echelon",
            "product_variant": "Echelon",
            "catalogue_number": "EC22L1S",
        }
    )

    assert payload["product_family"] == "Echelon"
    assert payload["product_variant"] == "Echelon"
    assert payload["catalogue_number"] == "EC22L1S"
    assert payload["validation"]["valid"] is True


def test_next_post_preview_route_returns_payload() -> None:
    expected_preview = XmlGenerationService().preview_post_registration(
        product_family="Elan",
        product_variant="Elan IC",
        catalogue_number="ELANIC22L1S",
    )
    original = XmlGenerationService.preview_next_post_registration
    XmlGenerationService.preview_next_post_registration = lambda self, **kwargs: expected_preview
    try:
        payload = preview_xml_next_post_registration(
            {
                "product_family": "Echelon",
                "product_variant": "Echelon",
            }
        )
    finally:
        XmlGenerationService.preview_next_post_registration = original

    assert payload["mode"] == "post_registration"
    assert payload["product_family"] == "Elan"
    assert payload["product_variant"] == "Elan IC"
    assert payload["post_validation"]["valid"] is True


def test_single_record_preview_can_override_manufacturer_srn_for_playground(monkeypatch) -> None:
    monkeypatch.setenv("EUDAMED_MANUFACTURER_SRN_OVERRIDE", "UK-MF-000033261")
    get_settings.cache_clear()
    try:
        preview = XmlGenerationService().preview_post_registration(
            product_family="Elan",
            product_variant="Elan IC",
            catalogue_number="ELANIC22L1S",
        )
    finally:
        monkeypatch.delenv("EUDAMED_MANUFACTURER_SRN_OVERRIDE", raising=False)
        get_settings.cache_clear()

    assert "<basicudi:MFActorCode>UK-MF-000033261</basicudi:MFActorCode>" in preview.post_xml
    assert "<s:nodeActorCode>UK-MF-000033261</s:nodeActorCode>" in preview.post_xml


def test_single_post_preview_switches_to_child_udidi_post_when_parent_is_already_registered(monkeypatch) -> None:
    service = XmlGenerationService()
    monkeypatch.setattr(
        service.testing_state_store,
        "has_successful_basic_udi_post",
        lambda **kwargs: True,
    )

    preview = service.preview_post_registration(
        product_family="Elan",
        product_variant="Elan IC",
        catalogue_number="ELANIC22L1S",
    )

    assert preview.message_type == "UDI_DI.POST"
    assert preview.post_file_name.endswith("udidi-post-ELANIC22L1S.xml")
    assert "<s:serviceID>UDI_DI</s:serviceID>" in preview.post_xml
    assert "<device:MDRBasicUDI>" not in preview.post_xml
    assert "<device:UDIDIData" in preview.post_xml


def test_next_valid_post_record_skips_known_posted_parent_and_child(monkeypatch) -> None:
    service = XmlGenerationService()
    first_known = cast(
        CanonicalValidationRecord,
        service.selector.find_post_record(
            product_family="Elite",
            product_variant="Elite2",
            catalogue_number="EL22-24-1KIT-S",
        ),
    )
    second_new = cast(
        CanonicalValidationRecord,
        first_known.model_copy(
            update={
                "catalogue_number": "EC22L1S-NEW",
                "primary_udi_di": "05050649030109-NEW",
            }
        ),
    )

    monkeypatch.setattr(
        service,
        "_variant_post_records_with_exclusions",
        lambda **kwargs: ([first_known, second_new], [], 2),
    )
    original_bulk_record_summary = service._bulk_record_summary
    monkeypatch.setattr(
        service,
        "_bulk_record_summary",
        lambda record: (
            cast(
                type(original_bulk_record_summary(record)),
                original_bulk_record_summary(record).model_copy(update={"basic_udi_di": "NEW-BASIC-UDI-DI"}),
            )
            if record.catalogue_number == "EC22L1S-NEW"
            else original_bulk_record_summary(record)
        ),
    )
    monkeypatch.setattr(
        service.testing_state_store,
        "has_successful_basic_udi_post",
        lambda **kwargs: kwargs["basic_udi_di"] == basicUdiDiForRecordForTest(first_known),
    )
    monkeypatch.setattr(
        service.testing_state_store,
        "has_successful_primary_udi_post",
        lambda **kwargs: kwargs["primary_udi_di"] == first_known.primary_udi_di,
    )

    selected = service._next_valid_post_record(
        product_family="Elite",
        product_variant="Elite2",
    )

    assert selected.catalogue_number == "EC22L1S-NEW"


def test_next_valid_post_record_blocks_when_parent_exists(monkeypatch) -> None:
    service = XmlGenerationService()
    record = cast(
        CanonicalValidationRecord,
        service.selector.find_post_record(
            product_family="Elite",
            product_variant="Elite2",
            catalogue_number="EL22-24-1KIT-S",
        ),
    )

    monkeypatch.setattr(
        service,
        "_variant_post_records_with_exclusions",
        lambda **kwargs: ([record], [], 1),
    )
    monkeypatch.setattr(
        service.testing_state_store,
        "has_successful_basic_udi_post",
        lambda **kwargs: True,
    )
    monkeypatch.setattr(
        service.testing_state_store,
        "has_successful_primary_udi_post",
        lambda **kwargs: False,
    )

    selected_record = service._next_valid_post_record(product_family="Elite", product_variant="Elite2")

    assert selected_record.catalogue_number == "ELT22"


def basicUdiDiForRecordForTest(record: CanonicalValidationRecord) -> str | None:
    for field in record.fields:
        if field.canonical_path in {"basic_device.basic_udi_di", "device_record.basic_udi_identifier"} and field.value:
            return field.value
    return None


def test_market_info_put_preview_generates_schema_valid_xml() -> None:
    preview = XmlGenerationService().preview_market_info_put(
        product_family="Echelon",
        product_variant="Echelon",
        catalogue_number="EC22L1S",
    )

    assert preview.file_name == "echelon-echelon-market-info-put-EC22L1S.xml"
    assert preview.product_family == "Echelon"
    assert preview.product_variant == "Echelon"
    assert preview.catalogue_number == "EC22L1S"
    assert preview.primary_udi_di == "05050649030109"
    assert preview.validation.valid is True
    assert preview.registered_device_anchor.catalogue_number == "EC22L1S"
    assert preview.registered_device_anchor.primary_udi_di == "05050649030109"
    assert "<mktinfo:DTXMarketInfo>" in preview.xml
    assert "<s:serviceID>MARKET_INFO</s:serviceID>" in preview.xml
    assert "<s:serviceOperation>PUT</s:serviceOperation>" in preview.xml
    assert "<marketinfo:uDIDIIdentifier>" in preview.xml


def test_market_info_put_routes_return_payloads() -> None:
    payload = preview_xml_market_info_put(
        {
            "product_family": "Echelon",
            "product_variant": "Echelon",
            "catalogue_number": "EC22L1S",
        }
    )

    assert payload["mode"] == "market_info_put"
    assert payload["validation"]["valid"] is True
    assert payload["registered_device_anchor"]["catalogue_number"] == "EC22L1S"

    response = download_xml_market_info_put(
        {
            "product_family": "Echelon",
            "product_variant": "Echelon",
            "catalogue_number": "EC22L1S",
        }
    )

    assert response.media_type == "application/xml"
    assert 'filename="echelon-echelon-market-info-put-EC22L1S.xml"' in response.headers["Content-Disposition"]
    assert b"<mktinfo:DTXMarketInfo>" in response.body


def test_generic_download_route_returns_xml_file() -> None:
    response = download_xml_record(
        {
            "product_family": "Echelon",
            "product_variant": "Echelon",
            "catalogue_number": "EC22L1S",
        }
    )

    assert response.media_type == "application/xml"
    assert 'filename="echelon-echelon-EC22L1S.xml"' in response.headers["Content-Disposition"]
    assert b"<m:Push" in response.body


def test_generic_batch_preview_generates_variant_scoped_schema_valid_xml() -> None:
    preview = XmlGenerationService().preview_batch(
        product_family="Echelon",
        product_variant="Echelon VT",
        chunk_sequence=1,
    )

    assert preview.product_family == "Echelon"
    assert preview.product_variant == "Echelon VT"
    assert preview.submission_operation == "PATCH"
    assert preview.package_file_name == "echelon-echelon-vt-batch-package.zip"
    assert preview.total_ready_records == 1696
    assert preview.excluded_records == 0
    assert preview.max_records_per_file == 300
    assert preview.chunk_count == 6
    assert preview.selected_chunk_sequence == 1
    assert preview.selected_chunk_file_name == "echelon-echelon-vt-batch-01-of-06.xml"
    assert preview.selected_chunk_record_count == 300
    assert preview.selected_chunk_validation.valid is True
    assert len(preview.chunks) == 6
    assert preview.chunks[-1].record_count == 196
    assert "<m:Push" in preview.selected_chunk_xml
    assert "<s:serviceOperation>PATCH</s:serviceOperation>" in preview.selected_chunk_xml


def test_generic_batch_preview_route_returns_variant_batch_payload() -> None:
    payload = preview_xml_batch(
        {
            "product_family": "Echelon",
            "product_variant": "Echelon VT",
            "chunk_sequence": 2,
        }
    )

    assert payload["mode"] == "batch"
    assert payload["product_family"] == "Echelon"
    assert payload["product_variant"] == "Echelon VT"
    assert payload["chunk_count"] == 6
    assert payload["selected_chunk_sequence"] == 2
    assert payload["selected_chunk_record_count"] == 300
    assert payload["selected_chunk_validation"]["valid"] is True


def test_generic_batch_download_route_returns_zip_package() -> None:
    response = download_xml_batch(
        {
            "product_family": "Echelon",
            "product_variant": "Echelon VT",
        }
    )

    assert response.media_type == "application/zip"
    assert 'filename="echelon-echelon-vt-batch-package.zip"' in response.headers["Content-Disposition"]

    with ZipFile(BytesIO(response.body)) as archive:
        names = archive.namelist()
        assert "manifest.json" in names
        assert "echelon-echelon-vt-batch-01-of-06.xml" in names
        assert "echelon-echelon-vt-batch-06-of-06.xml" in names

def test_generated_trade_name_patch_scenario_reuses_latest_successful_patch_state() -> None:
    XmlGenerationService().preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )
    preview = XmlGenerationService().preview_generated_patch_scenario(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
        scenario_id="trade_name_edit",
        patch_version="5",
        scenario_inputs={
            "new_trade_name": "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS UPDATED",
        },
    )

    assert preview.mode == "generated_patch_scenario"
    assert preview.context.parent_post_version == "1"
    assert preview.context.base_message_type == "PATCH"
    assert preview.context.base_version == "4"
    assert preview.context.proposed_patch_version == "5"
    assert preview.context.base_state_source == "sqlite_latest_successful_patch"
    assert preview.context.base_state_label == "Latest successful PATCH version 4"
    assert preview.registered_device_anchor.catalogue_number == preview.catalogue_number
    assert preview.base_validation.valid is True
    assert preview.derived_patch_validation.valid is True
    assert "<e:version>4</e:version>" in preview.base_xml
    assert "<e:version>5</e:version>" in preview.derived_patch_xml
    assert "Store in a dry location" in preview.base_xml
    assert "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS UPDATED" in preview.derived_patch_xml
    assert any(delta.field_key == "trade_name" for delta in preview.field_deltas)


def test_equivalent_first_patch_scenario_uses_post_as_base_for_version_two() -> None:
    XmlGenerationService().preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )
    preview = XmlGenerationService().preview_generated_patch_scenario(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
        scenario_id="equivalent_first_patch",
        patch_version="2",
        scenario_inputs={},
    )

    assert preview.context.base_message_type == "POST"
    assert preview.context.base_version == "1"
    assert preview.context.proposed_patch_version == "2"
    assert "<s:serviceOperation>POST</s:serviceOperation>" in preview.base_xml
    assert "<s:serviceOperation>PATCH</s:serviceOperation>" in preview.derived_patch_xml
    assert "<e:version>2</e:version>" in preview.derived_patch_xml


def test_generated_trade_name_patch_scenario_preserves_registered_device_identity() -> None:
    XmlGenerationService().preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )
    preview = XmlGenerationService().preview_generated_patch_scenario(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
        scenario_id="trade_name_edit",
        patch_version="5",
        scenario_inputs={
            "new_trade_name": "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS UPDATED",
        },
    )

    assert preview.registered_device_anchor.catalogue_number == "EVAC22L1S"
    assert preview.registered_device_anchor.primary_udi_di == "05050649062025"
    assert preview.context.catalogue_number == "EVAC22L1S"
    assert preview.context.primary_udi_di == "05050649062025"
    assert "<commondi:DICode>05050649062025</commondi:DICode>" in preview.base_xml
    assert "<commondi:DICode>05050649062025</commondi:DICode>" in preview.derived_patch_xml
    assert "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS" in preview.base_xml
    assert "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS UPDATED" in preview.derived_patch_xml
    assert all(delta.field_key in {"patch_version", "trade_name"} for delta in preview.field_deltas)


def test_generated_trade_name_patch_scenario_preserves_latest_successful_trade_name_as_base() -> None:
    XmlGenerationService().preview_post_registration(
        product_family="Elan",
        product_variant="Elan IC",
        catalogue_number="ELANIC22L1S",
    )
    preview = XmlGenerationService().preview_generated_patch_scenario(
        product_family="Elan",
        product_variant="Elan IC",
        catalogue_number="ELANIC22L1S",
        scenario_id="warning_add",
        patch_version="5",
        scenario_inputs={
            "new_warning_code": "CW011",
            "new_warning_comment": None,
        },
    )

    assert preview.context.base_version == "4"
    assert preview.context.base_state_source == "sqlite_latest_successful_patch"
    assert "<e:version>4</e:version>" in preview.base_xml
    assert "ELANIC 22L CAT1 -EXT.FOOT PROSTHESIS UPDATED" in preview.base_xml
    assert "ELANIC 22L CAT1 -EXT.FOOT PROSTHESIS UPDATED" in preview.derived_patch_xml


def test_generated_warning_patch_scenario_replaces_warning_set() -> None:
    XmlGenerationService().preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )
    preview = XmlGenerationService().preview_generated_patch_scenario(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
        scenario_id="warning_add",
        patch_version="5",
        scenario_inputs={
            "new_warning_code": "CW011",
            "new_warning_comment": None,
        },
    )

    assert "<e:version>5</e:version>" in preview.derived_patch_xml
    assert "<commondi:warningValue>CW011</commondi:warningValue>" in preview.derived_patch_xml
    assert "<commondi:warningValue>CW010</commondi:warningValue>" not in preview.derived_patch_xml
    assert preview.derived_patch_validation.valid is True


def test_generated_storage_condition_patch_scenario_updates_comments() -> None:
    XmlGenerationService().preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )
    preview = XmlGenerationService().preview_generated_patch_scenario(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
        scenario_id="storage_condition_edit",
        patch_version="5",
        scenario_inputs={
            "updated_conditions": [
                {
                    "condition_code": "SHC006",
                    "replacement_comment": "Minus 10",
                },
                {
                    "condition_code": "SHC007",
                    "replacement_comment": "Plus 45",
                },
            ]
        },
    )

    assert "<e:version>4</e:version>" in preview.base_xml
    assert "<e:version>5</e:version>" in preview.derived_patch_xml
    assert "Store in a dry location" in preview.base_xml
    assert "Minus 10" in preview.derived_patch_xml
    assert "Plus 45" in preview.derived_patch_xml
    assert preview.derived_patch_validation.valid is True


def test_generated_base_quantity_patch_scenario_updates_quantity() -> None:
    XmlGenerationService().preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )
    preview = XmlGenerationService().preview_generated_patch_scenario(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
        scenario_id="base_quantity_edit",
        patch_version="5",
        scenario_inputs={"new_base_quantity": 7},
    )

    assert "<e:version>5</e:version>" in preview.derived_patch_xml
    assert "<udidi:baseQuantity>7</udidi:baseQuantity>" in preview.derived_patch_xml
    assert any(delta.field_key == "base_quantity" and delta.after_value == "7" for delta in preview.field_deltas)
    assert preview.derived_patch_validation.valid is True


def test_generated_sterile_patch_scenario_updates_boolean() -> None:
    XmlGenerationService().preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )
    preview = XmlGenerationService().preview_generated_patch_scenario(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
        scenario_id="sterile_edit",
        patch_version="5",
        scenario_inputs={"new_sterile": True},
    )

    assert "<e:version>5</e:version>" in preview.derived_patch_xml
    assert "<udidi:sterile>true</udidi:sterile>" in preview.derived_patch_xml
    assert any(delta.field_key == "sterile" and delta.after_value == "true" for delta in preview.field_deltas)
    assert preview.derived_patch_validation.valid is True


def test_generated_latex_patch_scenario_updates_boolean() -> None:
    XmlGenerationService().preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )
    preview = XmlGenerationService().preview_generated_patch_scenario(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
        scenario_id="latex_edit",
        patch_version="5",
        scenario_inputs={"new_contains_latex": True},
    )

    assert "<e:version>5</e:version>" in preview.derived_patch_xml
    assert "<udidi:latex>true</udidi:latex>" in preview.derived_patch_xml
    assert any(delta.field_key == "latex" and delta.after_value == "true" for delta in preview.field_deltas)
    assert preview.derived_patch_validation.valid is True


def test_generated_status_code_patch_scenario_updates_enum() -> None:
    XmlGenerationService().preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )
    preview = XmlGenerationService().preview_generated_patch_scenario(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
        scenario_id="status_code_edit",
        patch_version="5",
        scenario_inputs={"new_status_code": "NO_LONGER_PLACED_ON_THE_MARKET"},
    )

    assert "<e:version>5</e:version>" in preview.derived_patch_xml
    assert "<commondi:code>NO_LONGER_PLACED_ON_THE_MARKET</commondi:code>" in preview.derived_patch_xml
    assert any(
        delta.field_key == "status_code" and delta.after_value == "NO_LONGER_PLACED_ON_THE_MARKET"
        for delta in preview.field_deltas
    )
    assert preview.derived_patch_validation.valid is True


def test_generated_patch_scenario_route_returns_comparison_payload() -> None:
    XmlGenerationService().preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )
    payload = preview_generated_patch_scenario(
        {
            "product_family": "Echelon",
            "product_variant": "Echelon VAC",
            "catalogue_number": "EVAC22L1S",
            "scenario_id": "trade_name_edit",
            "patch_version": 5,
            "scenario_inputs": {
                "new_trade_name": "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS UPDATED",
            },
        }
    )

    assert payload["mode"] == "generated_patch_scenario"
    assert payload["context"]["base_version"] == "4"
    assert payload["context"]["proposed_patch_version"] == "5"
    assert payload["derived_patch_validation"]["valid"] is True


def test_generated_patch_scenario_download_route_returns_zip_package() -> None:
    XmlGenerationService().preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )
    response = download_generated_patch_scenario(
        {
            "product_family": "Echelon",
            "product_variant": "Echelon VAC",
            "catalogue_number": "EVAC22L1S",
            "scenario_id": "trade_name_edit",
            "patch_version": 5,
            "scenario_inputs": {
                "new_trade_name": "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS UPDATED",
            },
        }
    )

    assert response.media_type == "application/zip"
    assert 'filename="echelon-echelon-vac-patch-trade-name-edit-EVAC22L1S.zip"' in response.headers["Content-Disposition"]
    with ZipFile(BytesIO(response.body)) as archive:
        members = archive.namelist()
        patch_xml = archive.read("echelon-echelon-vac-patch-trade-name-edit-EVAC22L1S.xml")
    assert "echelon-echelon-vac-patch-trade-name-edit-EVAC22L1S.xml" in members
    assert "manifest.json" in members
    assert b"<e:version>5</e:version>" in patch_xml


def test_generated_patch_scenario_requires_reviewed_post_baseline() -> None:
    try:
        XmlGenerationService().preview_generated_patch_scenario(
            product_family="Echelon",
            product_variant="Echelon VAC",
            catalogue_number="EVAC22L1S",
            scenario_id="trade_name_edit",
            patch_version="5",
            scenario_inputs={
                "new_trade_name": "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS UPDATED",
            },
        )
    except ValueError as exc:
        assert str(exc) == "Generate and review the baseline POST for this exact selected record before drafting a PATCH."
    else:
        raise AssertionError("Expected reviewed POST baseline requirement to be enforced.")


def test_generated_patch_scenario_requires_tracked_successful_post_for_version_2(monkeypatch) -> None:
    service = XmlGenerationService()
    service.preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )
    monkeypatch.setattr(
        service.testing_state_store,
        "has_successful_primary_udi_post",
        lambda **_: False,
    )

    try:
        service.preview_generated_patch_scenario(
            product_family="Echelon",
            product_variant="Echelon VAC",
            catalogue_number="EVAC22L1S",
            scenario_id="equivalent_first_patch",
            patch_version="2",
            scenario_inputs={},
        )
    except ValueError as exc:
        assert (
            str(exc)
            == "This device does not yet have a tracked successful Playground registration, so PATCH cannot be generated."
        )
    else:
        raise AssertionError("Expected tracked successful POST requirement to be enforced for version 2 PATCH.")


def test_generated_patch_scenario_route_requires_reviewed_post_baseline() -> None:
    try:
        preview_generated_patch_scenario(
            {
                "product_family": "Echelon",
                "product_variant": "Echelon VAC",
                "catalogue_number": "EVAC22L1S",
                "scenario_id": "trade_name_edit",
                "patch_version": 5,
                "scenario_inputs": {
                    "new_trade_name": "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS UPDATED",
                },
            }
        )
    except HTTPException as exc:
        assert exc.status_code == 404
        assert exc.detail == "Generate and review the baseline POST for this exact selected record before drafting a PATCH."
    else:
        raise AssertionError("Expected HTTPException when baseline POST has not been reviewed.")


def test_generated_patch_scenario_route_requires_tracked_successful_post_for_version_2(monkeypatch) -> None:
    original = XmlGenerationService.preview_generated_patch_scenario

    def raise_missing_registration(self, **kwargs):
        raise ValueError("This device does not yet have a tracked successful Playground registration, so PATCH cannot be generated.")

    monkeypatch.setattr(XmlGenerationService, "preview_generated_patch_scenario", raise_missing_registration)

    try:
        preview_generated_patch_scenario(
            {
                "product_family": "Echelon",
                "product_variant": "Echelon VAC",
                "catalogue_number": "EVAC22L1S",
                "scenario_id": "equivalent_first_patch",
                "patch_version": 2,
                "scenario_inputs": {},
            }
        )
    except HTTPException as exc:
        assert exc.status_code == 404
        assert (
            exc.detail
            == "This device does not yet have a tracked successful Playground registration, so PATCH cannot be generated."
        )
    else:
        raise AssertionError("Expected HTTPException when successful Playground POST has not been tracked.")
    finally:
        XmlGenerationService.preview_generated_patch_scenario = original


def test_post_preview_marks_reviewed_post_for_following_patch_generation() -> None:
    service = XmlGenerationService()
    service.preview_post_registration(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )

    assert service.testing_state_store.has_reviewed_post(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
    )

    preview = service.preview_generated_patch_scenario(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number="EVAC22L1S",
        scenario_id="trade_name_edit",
        patch_version="5",
        scenario_inputs={
            "new_trade_name": "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS UPDATED",
        },
    )

    assert preview.derived_patch_validation.valid is True


def test_preview_bulk_post_scans_full_variant_population_before_message_cap(monkeypatch) -> None:
    service = XmlGenerationService()
    original = service._variant_post_records_with_exclusions
    requested_counts: list[int | None] = []

    def spy(*, product_family: str, product_variant: str, record_count: int | None):
        requested_counts.append(record_count)
        return original(product_family=product_family, product_variant=product_variant, record_count=record_count)

    monkeypatch.setattr(service, "_variant_post_records_with_exclusions", spy)
    monkeypatch.setattr(
        service,
        "_deduplicate_bulk_basic_udi_posts",
        lambda **kwargs: (kwargs["records"][:1], kwargs["excluded_records"], 1),
    )

    service.preview_bulk_post(
        product_family="Echelon",
        product_variant="Echelon VAC",
        record_count=1,
    )

    assert requested_counts == [None]


def test_download_bulk_post_scans_full_variant_population_before_message_cap(monkeypatch) -> None:
    service = XmlGenerationService()
    original = service._variant_post_records_with_exclusions
    requested_counts: list[int | None] = []

    def spy(*, product_family: str, product_variant: str, record_count: int | None):
        requested_counts.append(record_count)
        return original(product_family=product_family, product_variant=product_variant, record_count=record_count)

    monkeypatch.setattr(service, "_variant_post_records_with_exclusions", spy)
    monkeypatch.setattr(
        service,
        "_deduplicate_bulk_basic_udi_posts",
        lambda **kwargs: (kwargs["records"][:1], kwargs["excluded_records"], 1),
    )

    service.download_bulk_post(
        product_family="Echelon",
        product_variant="Echelon VAC",
        record_count=1,
    )

    assert requested_counts == [None, None]


def test_preview_bulk_udidi_post_scans_full_variant_population_before_message_cap(monkeypatch) -> None:
    service = XmlGenerationService()
    original = service._variant_post_records_with_exclusions
    requested_counts: list[int | None] = []

    def spy(*, product_family: str, product_variant: str, record_count: int | None):
        requested_counts.append(record_count)
        return original(product_family=product_family, product_variant=product_variant, record_count=record_count)

    monkeypatch.setattr(service, "_variant_post_records_with_exclusions", spy)

    service.preview_bulk_udidi_post(
        product_family="Elite",
        product_variant="EliteVT",
        record_count=1,
    )

    assert requested_counts == [None]


def test_download_bulk_udidi_post_scans_full_variant_population_before_message_cap(monkeypatch) -> None:
    service = XmlGenerationService()
    original = service._variant_post_records_with_exclusions
    requested_counts: list[int | None] = []

    def spy(*, product_family: str, product_variant: str, record_count: int | None):
        requested_counts.append(record_count)
        return original(product_family=product_family, product_variant=product_variant, record_count=record_count)

    monkeypatch.setattr(service, "_variant_post_records_with_exclusions", spy)

    service.download_bulk_udidi_post(
        product_family="Elite",
        product_variant="EliteVT",
        record_count=1,
    )

    assert requested_counts == [None, None]


def test_post_record_selector_requires_exact_catalogue_number_for_variant_post_lineage() -> None:
    class StubValidationService:
        def __init__(self, records: list[CanonicalValidationRecord]) -> None:
            self._bundle = cast(CanonicalValidationBundle, SimpleNamespace(records=records))

        def build_validation_bundle(self) -> CanonicalValidationBundle:
            return self._bundle

    validation_bundle = XmlGenerationService().validation_service.build_validation_bundle()
    variant_post_records: list[CanonicalValidationRecord] = [
        record
        for record in validation_bundle.records
        if record.product_family == "Echelon"
        and record.product_variant == "Echelon VAC"
        and record.xml_readiness.status == "complete"
        and (record.submission_operation or "").upper() == "POST"
    ]
    assert variant_post_records

    baseline_record: CanonicalValidationRecord = cast(CanonicalValidationRecord, variant_post_records[0])
    alternate_record: CanonicalValidationRecord = cast(
        CanonicalValidationRecord,
        baseline_record.model_copy(update={"catalogue_number": "EVAC22L1S-ALT"}),
    )
    assert baseline_record.catalogue_number is not None
    expected_catalogue_number = baseline_record.catalogue_number
    selector = ValidationRecordSelector(
        cast(CanonicalValidationService, StubValidationService([alternate_record, baseline_record]))
    )

    selected: CanonicalValidationRecord = selector.find_post_record(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number=expected_catalogue_number,
    )

    assert selected.catalogue_number == expected_catalogue_number


def test_bulk_patch_preview_scopes_to_selected_basic_udi_parent_and_child_devices() -> None:
    service = XmlGenerationService()
    posted_groups = service.testing_state_store.posted_parent_groups(
        product_family="Elite",
        product_variant="EliteVT",
    )
    assert posted_groups
    basic_udi_di = posted_groups[0]["basic_udi_di"]
    selected_children = cast(list[str], posted_groups[0]["sample_catalogue_numbers"][:2])
    assert len(selected_children) == 2

    preview = service.preview_bulk_patch(
        product_family="Elite",
        product_variant="EliteVT",
        basic_udi_di=basic_udi_di,
        record_count=len(selected_children),
        scenario_id="equivalent_first_patch",
        scenario_inputs={},
        selected_catalogue_numbers=selected_children,
    )

    assert preview.selected_basic_udi_di == basic_udi_di
    assert preview.eligible_child_records >= len(selected_children)
    assert preview.requested_record_count == len(selected_children)
    assert preview.included_record_count == len(selected_children)
    assert {record.catalogue_number for record in preview.included_records} == set(selected_children)


def test_bulk_patch_routes_require_basic_udi_parent_scope() -> None:
    try:
        preview_xml_bulk_patch(
            {
                "product_family": "Echelon",
                "product_variant": "Echelon VAC",
                "scenario_id": "equivalent_first_patch",
                "record_count": 1,
            }
        )
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 400
        assert "basic_udi_di" in str(getattr(exc, "detail", exc))
    else:
        raise AssertionError("Expected bulk PATCH preview route to require basic_udi_di.")

    try:
        download_xml_bulk_patch(
            {
                "product_family": "Echelon",
                "product_variant": "Echelon VAC",
                "scenario_id": "equivalent_first_patch",
                "record_count": 1,
            }
        )
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 400
        assert "basic_udi_di" in str(getattr(exc, "detail", exc))
    else:
        raise AssertionError("Expected bulk PATCH download route to require basic_udi_di.")


def test_bulk_patch_preview_excludes_posted_children_that_are_not_xml_ready() -> None:
    service = XmlGenerationService()
    posted_entries = service.testing_state_store.posted_entries(
        product_family="Elite",
        product_variant="EliteVT",
        basic_udi_di="5050649ELITEVTV4",
    )
    selected_catalogue_numbers = [
        str(entry.get("catalogue_number") or "").strip()
        for entry in posted_entries
        if str(entry.get("catalogue_number") or "").strip()
    ]
    xml_ready_catalogues = {
        record.catalogue_number
        for record in service._variant_xml_ready_records(
            product_family="Elite",
            product_variant="EliteVT",
        )
        if record.catalogue_number
    }
    expected_included_catalogues = set(selected_catalogue_numbers).intersection(xml_ready_catalogues)
    expected_missing_catalogues = set(selected_catalogue_numbers).difference(xml_ready_catalogues)

    preview = service.preview_bulk_patch(
        product_family="Elite",
        product_variant="EliteVT",
        basic_udi_di="5050649ELITEVTV4",
        record_count=len(selected_catalogue_numbers),
        scenario_id="equivalent_first_patch",
        scenario_inputs={},
        selected_catalogue_numbers=selected_catalogue_numbers,
    )

    assert preview.selected_basic_udi_di == "5050649ELITEVTV4"
    assert preview.eligible_child_records == len(selected_catalogue_numbers)
    assert preview.included_record_count == len(expected_included_catalogues)
    assert {record.catalogue_number for record in preview.included_records} == expected_included_catalogues
    assert {
        record.catalogue_number
        for record in preview.excluded_records
        if record.reason_code == "not_xml_ready"
    } == expected_missing_catalogues


def test_bulk_basic_udi_post_excludes_parent_when_basic_udi_is_already_registered() -> None:
    service = XmlGenerationService()

    try:
        service.preview_bulk_post(
            product_family="Elite",
            product_variant="EliteVT",
            record_count=1,
        )
    except ValueError as exc:
        assert (
            str(exc)
            == "Parent Basic UDI-DI already exists for Elite / EliteVT. Use Bulk UDI-DI POST to add child devices."
        )
    else:
        raise AssertionError("Expected Bulk Basic UDI-DI POST preview to stop when the parent DEVICE.POST already exists.")


def test_bulk_udidi_post_includes_all_xml_ready_children_when_parent_is_already_registered() -> None:
    service = XmlGenerationService()

    preview = service.preview_bulk_udidi_post(
        product_family="Elite",
        product_variant="EliteVT",
        record_count=5,
    )

    assert preview.eligible_child_records >= 5
    assert preview.included_record_count == 5
    assert len({record.catalogue_number for record in preview.included_records if record.catalogue_number}) == 5
    assert all(record.reason_code != "parent_seed_row" for record in preview.excluded_records)
    assert all(record.reason_code != "parent_not_registered" for record in preview.excluded_records)


def test_bulk_udidi_post_blocks_when_parent_device_post_has_not_been_recorded(monkeypatch) -> None:
    service = XmlGenerationService()

    monkeypatch.setattr(
        service.testing_state_store,
        "has_successful_basic_udi_post",
        lambda **_: False,
    )

    try:
        service.preview_bulk_udidi_post(
            product_family="Elite",
            product_variant="EliteVT",
            record_count=5,
        )
    except ValueError as exc:
        assert str(exc) == "No eligible child UDI-DI POST records are currently available for Elite / EliteVT."
    else:
        raise AssertionError("Expected Bulk UDI-DI POST preview to stop when the parent DEVICE.POST has not been recorded.")


def test_bulk_udidi_post_excludes_children_already_registered_in_tracked_state(monkeypatch) -> None:
    service = XmlGenerationService()

    monkeypatch.setattr(
        service.testing_state_store,
        "has_successful_basic_udi_post",
        lambda **_: True,
    )

    already_registered = {
        "05050649110030",
        "05050649110047",
        "05050649110054",
        "05050649110061",
        "05050649110023",
    }
    monkeypatch.setattr(
        service.testing_state_store,
        "has_successful_primary_udi_post",
        lambda **kwargs: kwargs.get("primary_udi_di") in already_registered,
    )
    original = service._variant_post_records_with_exclusions

    def only_known_registered_children(**kwargs):
        candidate_records, excluded_records, eligible_count = original(**kwargs)
        filtered_candidates = [record for record in candidate_records if record.primary_udi_di in already_registered]
        return filtered_candidates, excluded_records, min(eligible_count, len(filtered_candidates))

    monkeypatch.setattr(service, "_variant_post_records_with_exclusions", only_known_registered_children)

    try:
        service.preview_bulk_udidi_post(
            product_family="Elite",
            product_variant="EliteVT",
            record_count=5,
        )
    except ValueError as exc:
        assert str(exc) == "No eligible child UDI-DI POST records are currently available for Elite / EliteVT."
    else:
        raise AssertionError("Expected Bulk UDI-DI POST preview to stop when every child UDI-DI is already registered.")


def test_bulk_udidi_post_marks_registered_children_as_excluded(monkeypatch) -> None:
    service = XmlGenerationService()

    monkeypatch.setattr(
        service.testing_state_store,
        "has_successful_basic_udi_post",
        lambda **_: True,
    )
    monkeypatch.setattr(
        service.testing_state_store,
        "has_successful_primary_udi_post",
        lambda **kwargs: kwargs.get("primary_udi_di") == "05050649110030",
    )

    preview = service.preview_bulk_udidi_post(
        product_family="Elite",
        product_variant="EliteVT",
        record_count=5,
    )

    assert preview.eligible_child_records >= 4
    assert all(record.primary_udi_di != "05050649110030" for record in preview.included_records)
    assert any(
        record.reason_code == "child_already_registered" and record.primary_udi_di == "05050649110030"
        for record in preview.excluded_records
    )
