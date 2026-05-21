from __future__ import annotations

from app.routers.xml_generation import download_echelon_record, preview_echelon_record
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
