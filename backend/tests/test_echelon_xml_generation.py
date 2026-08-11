from __future__ import annotations

from io import BytesIO
from types import SimpleNamespace
from zipfile import ZipFile

from app.config import get_settings

from app.routers.xml_generation import (
    download_generated_patch_scenario,
    download_xml_market_info_put,
    download_xml_batch,
    download_xml_record,
    preview_generated_patch_scenario,
    preview_xml_market_info_put,
    preview_xml_batch,
    preview_xml_record,
)
from app.services.xml_generation import XmlGenerationService
from app.services.xml_selection import ValidationRecordSelector


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


def test_single_record_preview_can_override_manufacturer_srn_for_playground(monkeypatch) -> None:
    monkeypatch.setenv("EUDAMED_MANUFACTURER_SRN_OVERRIDE", "UK-MF-000033261")
    get_settings.cache_clear()
    try:
        preview = XmlGenerationService().preview_post_patch_pair(
            product_family="Elan",
            product_variant="Elan IC",
            catalogue_number="ELANIC22L1S",
        )
    finally:
        monkeypatch.delenv("EUDAMED_MANUFACTURER_SRN_OVERRIDE", raising=False)
        get_settings.cache_clear()

    assert "<basicudi:MFActorCode>UK-MF-000033261</basicudi:MFActorCode>" in preview.post_xml
    assert "<s:nodeActorCode>UK-MF-000033261</s:nodeActorCode>" in preview.post_xml


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
    assert preview.context.baseline_patch_version == "4"
    assert preview.context.proposed_patch_version == "5"
    assert preview.context.base_state_source == "yaml_latest_successful_patch"
    assert preview.context.base_state_label == "Latest successful PATCH version 4"
    assert preview.registered_device_anchor.catalogue_number == preview.catalogue_number
    assert preview.baseline_patch_validation.valid is True
    assert preview.derived_patch_validation.valid is True
    assert "<e:version>4</e:version>" in preview.baseline_patch_xml
    assert "<e:version>5</e:version>" in preview.derived_patch_xml
    assert "Store in a dry location" in preview.baseline_patch_xml
    assert "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS UPDATED" in preview.derived_patch_xml
    assert any(delta.field_key == "trade_name" for delta in preview.field_deltas)


def test_generated_trade_name_patch_scenario_preserves_registered_device_identity() -> None:
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
    assert "<commondi:DICode>05050649062025</commondi:DICode>" in preview.baseline_patch_xml
    assert "<commondi:DICode>05050649062025</commondi:DICode>" in preview.derived_patch_xml
    assert "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS" in preview.baseline_patch_xml
    assert "ECH VAC 22L CAT1-EXT. FOOT PROSTHESIS UPDATED" in preview.derived_patch_xml
    assert all(delta.field_key in {"patch_version", "trade_name"} for delta in preview.field_deltas)


def test_generated_trade_name_patch_scenario_preserves_latest_successful_trade_name_as_base() -> None:
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

    assert preview.context.baseline_patch_version == "4"
    assert preview.context.base_state_source == "yaml_latest_successful_patch"
    assert "<e:version>4</e:version>" in preview.baseline_patch_xml
    assert "ELANIC 22L CAT1 -EXT.FOOT PROSTHESIS UPDATED" in preview.baseline_patch_xml
    assert "ELANIC 22L CAT1 -EXT.FOOT PROSTHESIS UPDATED" in preview.derived_patch_xml


def test_generated_warning_patch_scenario_replaces_warning_set() -> None:
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

    assert "<e:version>4</e:version>" in preview.baseline_patch_xml
    assert "<e:version>5</e:version>" in preview.derived_patch_xml
    assert "Store in a dry location" in preview.baseline_patch_xml
    assert "Minus 10" in preview.derived_patch_xml
    assert "Plus 45" in preview.derived_patch_xml
    assert preview.derived_patch_validation.valid is True


def test_generated_patch_scenario_route_returns_comparison_payload() -> None:
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
    assert payload["context"]["baseline_patch_version"] == "4"
    assert payload["context"]["proposed_patch_version"] == "5"
    assert payload["derived_patch_validation"]["valid"] is True


def test_generated_patch_scenario_download_route_returns_zip_package() -> None:
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
        assert "echelon-echelon-vac-patch-trade-name-edit-EVAC22L1S.xml" in members
        assert "manifest.json" in members
        assert b"<e:version>5</e:version>" in archive.read("echelon-echelon-vac-patch-trade-name-edit-EVAC22L1S.xml")


def test_post_record_selector_requires_exact_catalogue_number_for_variant_post_lineage() -> None:
    validation_bundle = XmlGenerationService().validation_service.build_validation_bundle()
    variant_post_records = [
        record
        for record in validation_bundle.records
        if record.product_family == "Echelon"
        and record.product_variant == "Echelon VAC"
        and record.xml_readiness.status == "complete"
        and (record.submission_operation or "").upper() == "POST"
    ]
    assert variant_post_records

    baseline_record = variant_post_records[0]
    alternate_record = baseline_record.model_copy(update={"catalogue_number": "EVAC22L1S-ALT"})
    selector = ValidationRecordSelector(XmlGenerationService().validation_service)
    selector.validation_service.build_validation_bundle = lambda: SimpleNamespace(
        records=[alternate_record, baseline_record]
    )

    selected = selector.find_post_record(
        product_family="Echelon",
        product_variant="Echelon VAC",
        catalogue_number=baseline_record.catalogue_number,
    )

    assert selected.catalogue_number == baseline_record.catalogue_number
