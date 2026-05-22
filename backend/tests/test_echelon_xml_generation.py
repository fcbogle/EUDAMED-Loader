from __future__ import annotations

from io import BytesIO
from zipfile import ZipFile

from app.routers.xml_generation import (
    download_echelon_batch,
    download_echelon_record,
    preview_echelon_batch,
    preview_echelon_record,
)
from app.services.echelon_xml_generation import EchelonXmlGenerationService


def test_single_record_preview_generates_schema_valid_xml() -> None:
    preview = EchelonXmlGenerationService().preview_single_record("EC22L1S")

    assert preview.file_name == "echelon-EC22L1S.xml"
    assert preview.catalogue_number == "EC22L1S"
    assert preview.validation.valid is True
    assert "<m:Push" in preview.xml
    assert 'xsi:type="device:MDRDeviceType"' in preview.xml
    assert "<device:MDRBasicUDI>" in preview.xml
    assert "<device:MDRUDIDIData>" in preview.xml
    assert "<udidi:storageHandlingConditions>" in preview.xml
    assert "<commondi:storageHandlingConditionValue>SHC006</commondi:storageHandlingConditionValue>" in preview.xml
    assert "<commondi:storageHandlingConditionValue>SHC007</commondi:storageHandlingConditionValue>" in preview.xml
    assert "<udidi:criticalWarnings>" in preview.xml
    assert "<commondi:warningValue>CW010</commondi:warningValue>" in preview.xml


def test_preview_route_returns_single_record_payload() -> None:
    payload = preview_echelon_record({"catalogue_number": "EC22L1S"})

    assert payload["catalogue_number"] == "EC22L1S"
    assert payload["validation"]["valid"] is True
    assert payload["file_name"] == "echelon-EC22L1S.xml"


def test_download_route_returns_xml_file() -> None:
    response = download_echelon_record({"catalogue_number": "EC22L1S"})

    assert response.media_type == "application/xml"
    assert 'filename="echelon-EC22L1S.xml"' in response.headers["Content-Disposition"]
    assert b"<m:Push" in response.body


def test_batch_preview_generates_chunked_schema_valid_xml() -> None:
    preview = EchelonXmlGenerationService().preview_batch()

    assert preview.package_file_name == "echelon-batch-package.zip"
    assert preview.total_ready_records == 2946
    assert preview.max_records_per_file == 300
    assert preview.chunk_count == 10
    assert preview.selected_chunk_sequence == 1
    assert preview.selected_chunk_record_count == 300
    assert preview.selected_chunk_validation.valid is True
    assert len(preview.chunks) == 10
    assert preview.chunks[0].record_count == 300
    assert preview.chunks[-1].record_count == 246
    assert "<m:Push" in preview.selected_chunk_xml


def test_batch_preview_route_returns_batch_payload() -> None:
    payload = preview_echelon_batch({"chunk_sequence": 2})

    assert payload["mode"] == "batch"
    assert payload["chunk_count"] == 10
    assert payload["selected_chunk_sequence"] == 2
    assert payload["selected_chunk_record_count"] == 300
    assert payload["selected_chunk_validation"]["valid"] is True


def test_batch_download_route_returns_zip_package() -> None:
    response = download_echelon_batch()

    assert response.media_type == "application/zip"
    assert 'filename="echelon-batch-package.zip"' in response.headers["Content-Disposition"]

    with ZipFile(BytesIO(response.body)) as archive:
        names = archive.namelist()
        assert "manifest.json" in names
        assert "echelon-batch-01-of-10.xml" in names
        assert "echelon-batch-10-of-10.xml" in names
