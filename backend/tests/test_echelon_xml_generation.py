from __future__ import annotations

from io import BytesIO
from zipfile import ZipFile

from app.routers.xml_generation import (
    download_xml_market_info_put,
    download_xml_batch,
    download_xml_record,
    preview_xml_market_info_put,
    preview_xml_batch,
    preview_xml_record,
)
from app.services.xml_generation import XmlGenerationService


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
