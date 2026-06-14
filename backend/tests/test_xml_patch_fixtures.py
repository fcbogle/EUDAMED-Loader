from __future__ import annotations

import json
from pathlib import Path


FIXTURE_ROOT = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "xml_patch_scenarios"
    / "equivalent_baseline"
    / "echelon-echelon-vac-EVAC22L1S"
)
SCENARIO_ROOT = Path(__file__).resolve().parent / "fixtures" / "xml_patch_scenarios"


def test_equivalent_baseline_fixture_contains_proven_post_patch_pair() -> None:
    manifest = json.loads((FIXTURE_ROOT / "manifest.json").read_text(encoding="utf-8"))
    post_xml = (FIXTURE_ROOT / manifest["post_file_name"]).read_text(encoding="utf-8")
    patch_xml = (FIXTURE_ROOT / manifest["patch_file_name"]).read_text(encoding="utf-8")

    assert manifest["mode"] == "post_patch_pair"
    assert manifest["product_family"] == "Echelon"
    assert manifest["product_variant"] == "Echelon VAC"
    assert manifest["catalogue_number"] == "EVAC22L1S"
    assert manifest["post_valid"] is True
    assert manifest["patch_valid"] is True

    assert "<s:serviceOperation>POST</s:serviceOperation>" in post_xml
    assert "<s:serviceID>DEVICE</s:serviceID>" in post_xml
    assert "<s:serviceOperation>PATCH</s:serviceOperation>" in patch_xml
    assert "<s:serviceID>UDI_DI</s:serviceID>" in patch_xml
    assert "<e:version>2</e:version>" in patch_xml
    assert "<commondi:DICode>05050649062025</commondi:DICode>" in post_xml
    assert "<commondi:DICode>05050649062025</commondi:DICode>" in patch_xml


def test_generated_patch_scenarios_share_the_same_registered_device_anchor() -> None:
    manifest = json.loads((FIXTURE_ROOT / "manifest.json").read_text(encoding="utf-8"))
    scenario_ids = ["trade_name_edit", "warning_add", "storage_condition_edit", "secondary_identifier_add"]

    for scenario_id in scenario_ids:
        scenario = json.loads(
            (SCENARIO_ROOT / scenario_id / "echelon-echelon-vac-EVAC22L1S" / "scenario.json").read_text(encoding="utf-8")
        )
        assert scenario["baseline_fixture"] == "equivalent_baseline/echelon-echelon-vac-EVAC22L1S"
        assert scenario["product_family"] == manifest["product_family"]
        assert scenario["product_variant"] == manifest["product_variant"]
        assert scenario["catalogue_number"] == manifest["catalogue_number"]
