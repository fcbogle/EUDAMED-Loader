"""Batch copies and source inspections use synthetic files, never operational data."""
from pathlib import Path
import json

import pytest

from app.services.dev_input_batches import create_dev_batch, fingerprint, inspect_dev_batch
from test_production_workbook_preparation import workbook, export


@pytest.fixture
def project(tmp_path):
    root = tmp_path / "project"
    for role in ("source_excel", "basic_udi_reference", "downloads"):
        (root / "data" / role).mkdir(parents=True)
    (root / ".env.dev").write_text("EUDAMED_ENVIRONMENT=dev\nEUDAMED_MANUFACTURER_SRN_OVERRIDE=GB-MF-000000001\n")
    workbook(root / "data/basic_udi_reference/BasicUDIs.xlsx",
             ["Issuing Entity", "Basic UDI-DI code", "Device Model"], [["GS1", "PARENT", "Model"]])
    workbook(root / "data/source_excel/Template.xlsx", ["Issuing Entity e.g. GS1", "UDI-DI code", "Basic UDI-DI"],
             [["GS1", "00000000000001", "PARENT"]])
    xml = root / "data/downloads/export.xml"
    export(xml)
    from lxml import etree
    from app.services.production_workbook_preparation import NS
    tree = etree.parse(str(xml))
    tree.getroot().set("version", "3.0.32")
    basic = tree.find("message:payload/device:Device/device:MDRBasicUDI", NS)
    etree.SubElement(basic, f"{{{NS['basic']}}}MFActorCode").text = "GB-MF-000000001"
    tree.write(str(xml), encoding="utf-8", xml_declaration=True)
    return root


def create(root):
    return create_dev_batch(project_root=root, xml_dir=root / "data/downloads", batch_id="2026-10-25-001")


def test_batch_copies_sources_and_preserves_provenance(project):
    original = {p: fingerprint(p) for p in (project / "data").rglob("*") if p.is_file()}
    batch = create(project)
    manifest = json.loads((batch / "manifest.json").read_text())
    assert manifest["environment"] == "dev"
    assert len(manifest["files"]) == 3
    assert (batch / "prepared").is_dir()
    for entry in manifest["files"]:
        assert fingerprint(batch / entry["path"]) == fingerprint(Path(entry["source_path"])) == entry["sha256"]
    assert all(fingerprint(path) == expected for path, expected in original.items())
    result = inspect_dev_batch(batch)
    assert result["inspection_complete"] is True
    assert result["identity_overlap"] == {"in_both": 1, "template_only": 0, "export_only": 0}
    assert result["database_accessed"] is False
    assert not list(project.rglob("*.sqlite3"))
    assert not list((batch / "prepared").iterdir())


def test_existing_batch_is_never_replaced(project):
    batch = create(project)
    before = fingerprint(batch / "manifest.json")
    with pytest.raises(ValueError, match="already exists"):
        create(project)
    assert fingerprint(batch / "manifest.json") == before


@pytest.mark.parametrize("change", ["alter", "extra", "remove"])
def test_inspection_rejects_changed_batch_inputs(project, change):
    batch = create(project)
    target = batch / "eudamed-xml/export.xml"
    if change == "alter":
        target.write_text("altered")
    elif change == "remove":
        target.unlink()
    else:
        (batch / "eudamed-xml/extra.xml").write_text("extra")
    with pytest.raises(ValueError):
        inspect_dev_batch(batch)


def test_production_inputs_and_redirected_dev_storage_are_rejected(project):
    prod = project / "data/prod"
    prod.mkdir()
    (prod / "export.xml").write_bytes((project / "data/downloads/export.xml").read_bytes())
    with pytest.raises(ValueError, match="Production source"):
        create_dev_batch(project_root=project, xml_dir=prod, batch_id="2026-10-25-001")
    (project / "data/dev").symlink_to(prod, target_is_directory=True)
    with pytest.raises(ValueError, match="storage"):
        create(project)
    assert not (prod / "import-batches").exists()


def test_export_actor_mismatch_is_reported_without_import(project):
    (project / ".env.dev").write_text("EUDAMED_ENVIRONMENT=dev\nEUDAMED_MANUFACTURER_SRN_OVERRIDE=GB-MF-000000002\n")
    result = inspect_dev_batch(create(project))
    assert result["inspection_complete"] is False
    assert "manufacturer" in result["errors"][0]
    assert result["workbook_created"] is False


def test_scope_filter_preserves_excluded_originals_and_reports_all_copies(project):
    import shutil
    excluded = "Excluded.xlsx"
    shutil.copy2(project / "data/source_excel/Template.xlsx", project / "data/source_excel" / excluded)
    batch = create(project)
    result = inspect_dev_batch(batch, excluded_workbook_names=(excluded,))
    assert result["templates"]["row_occurrences"] == 2
    assert result["templates"]["duplicate_identity_occurrences"] == 1
    assert result["requested_inspection_scope"]["row_occurrences"] == 1
    assert result["requested_inspection_scope"]["duplicate_identity_occurrences"] == 0
    assert (batch / "templates" / excluded).exists()


def test_misspelled_scope_filter_is_reported(project):
    result = inspect_dev_batch(create(project), excluded_workbook_names=("Missing.xlsx",))
    assert result["inspection_complete"] is False
    assert "not in this batch" in result["errors"][0]
