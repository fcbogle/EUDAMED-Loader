from __future__ import annotations

import hashlib
import json
import sqlite3
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import pytest

from app.config import get_settings
from app.services.testing_state_store import TestingStateStore as StateStore
from app.services.xml_generation import XmlGenerationService


@pytest.fixture
def review_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    path = tmp_path / "review.sqlite3"
    monkeypatch.setenv("EUDAMED_TESTING_STATE_DB_PATH", str(path))
    monkeypatch.setenv("EUDAMED_TESTING_STATE_BACKUP_DIR", str(tmp_path / "backups"))
    get_settings.cache_clear()
    yield path
    get_settings.cache_clear()


def receipt_rows(path):
    with sqlite3.connect(path) as connection:
        connection.row_factory = sqlite3.Row
        return [dict(row) for row in connection.execute("SELECT * FROM generated_packages ORDER BY id")]


def package_args(flow="generated_patch_scenario", country="DE", version="2", scenario="trade_name_edit"):
    return dict(
        package_file_name="synthetic.zip",
        members=[("device.xml", f'<device version="{version}"><country>{country}</country></device>'.encode())],
        manifest={"mode": flow, "product_family": "Family A", "product_variant": "Variant A",
                  "catalogue_number": "CAT-001", "scenario_id": scenario, "version": version},
        flow=flow, operation_scope="bulk" if flow.startswith("bulk") else "single",
    )


@pytest.mark.parametrize("flow", [
    "post_registration", "generated_patch_scenario", "market_info_put", "bulk_basic_udi_post",
    "bulk_udidi_post", "bulk_patch", "bulk_market_info", "batch",
])
def test_download_records_exact_archive_and_members_for_every_zip_flow(review_db, flow):
    service = XmlGenerationService()
    _, archive_bytes = service._build_and_record_package(**package_args(flow))
    receipt = receipt_rows(review_db)[0]
    assert receipt["reviewed_at"] == receipt["created_at"]
    assert receipt["review_basis"] == "zip_download"
    assert receipt["package_sha256"] == hashlib.sha256(archive_bytes).hexdigest()
    with ZipFile(BytesIO(archive_bytes)) as archive:
        assert json.loads(receipt["reviewed_members_json"]) == [
            {"file_name": name, "sha256": hashlib.sha256(archive.read(name)).hexdigest()}
            for name in archive.namelist()
        ]
    with sqlite3.connect(review_db) as connection:
        assert connection.execute("SELECT COUNT(*) FROM testing_events WHERE status = 'SUCCESS'").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM testing_subjects WHERE post_success = 1").fetchone()[0] == 0


@pytest.mark.parametrize("change", [{"country": "IE"}, {"version": "3"}, {"scenario": "base_quantity_edit"}])
def test_review_of_old_contents_does_not_apply_to_an_edited_draft(review_db, change):
    service = XmlGenerationService()
    _, old_bytes = service._build_and_record_package(**package_args())
    old_receipt = receipt_rows(review_db)[0]
    draft_args = package_args(**change)
    _, draft_bytes = service.package_builder.build_archive(
        package_file_name=draft_args["package_file_name"], members=draft_args["members"], manifest=draft_args["manifest"],
    )
    # Inspecting/building another draft records no review and leaves history intact.
    assert receipt_rows(review_db) == [old_receipt]
    assert hashlib.sha256(draft_bytes).hexdigest() != hashlib.sha256(old_bytes).hexdigest()
    _, downloaded_bytes = service._build_and_record_package(**draft_args)
    receipts = receipt_rows(review_db)
    assert len(receipts) == 2
    assert receipts[0] == old_receipt
    assert receipts[1]["package_sha256"] == hashlib.sha256(downloaded_bytes).hexdigest()
    assert receipts[1]["reviewed_members_json"] != receipts[0]["reviewed_members_json"]


def test_package_creation_alone_is_not_review(review_db):
    store = StateStore()
    args = package_args("post_registration")
    store.record_generated_package(
        **args, product_family="Family A", product_variant="Variant A", catalogue_number="CAT-001",
        basic_udi_di=None, package_bytes=b"creation metadata only",
    )
    receipt = receipt_rows(review_db)[0]
    assert receipt["reviewed_at"] is None
    assert receipt["review_basis"] is None
    assert receipt["reviewed_members_json"] is None
    assert not store.has_reviewed_post(product_family="Family A", product_variant="Variant A", catalogue_number="CAT-001")


def test_failed_zip_preparation_does_not_record_review(review_db, monkeypatch):
    service = XmlGenerationService()
    def fail(**kwargs):
        raise OSError("Synthetic ZIP failure")
    monkeypatch.setattr(service.package_builder, "build_archive", fail)
    with pytest.raises(OSError, match="Synthetic ZIP failure"):
        service._build_and_record_package(**package_args("post_registration"))
    assert receipt_rows(review_db) == []
    assert not service.testing_state_store.has_reviewed_post(product_family="Family A", product_variant="Variant A", catalogue_number="CAT-001")


def test_existing_package_rows_are_not_backfilled_as_reviewed(review_db):
    # Simulate the prior schema with a real historical package row.
    with sqlite3.connect(review_db) as connection:
        connection.execute('''CREATE TABLE generated_packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL,
            flow TEXT NOT NULL, operation_scope TEXT NOT NULL, product_family TEXT,
            product_variant TEXT, catalogue_number TEXT, basic_udi_di TEXT,
            package_file_name TEXT NOT NULL, package_byte_count INTEGER NOT NULL,
            member_count INTEGER NOT NULL, xml_member_count INTEGER NOT NULL,
            member_file_names_json TEXT NOT NULL, manifest_json TEXT NOT NULL, package_sha256 TEXT NOT NULL
        )''')
        connection.execute('''INSERT INTO generated_packages
            (created_at, flow, operation_scope, package_file_name, package_byte_count, member_count,
             xml_member_count, member_file_names_json, manifest_json, package_sha256)
             VALUES ('2026-09-01', 'post_registration', 'single', 'old.zip', 1, 1, 1, '[]', '{}', 'old-hash')''')
    StateStore()
    old = receipt_rows(review_db)[0]
    assert old["package_sha256"] == "old-hash"
    assert old["reviewed_at"] is None
    assert old["review_basis"] is None
    assert old["reviewed_members_json"] is None


def test_zip_review_does_not_change_existing_accepted_device_or_market_state(review_db):
    service = XmlGenerationService()
    with service.testing_state_store._connect() as connection:
        subject_id = service.testing_state_store._ensure_testing_subject(
            connection, product_family="Family A", product_variant="Variant A", catalogue_number="CAT-001",
            primary_udi_di="111111", basic_udi_di="BASIC-1",
        )
        patch_state = json.dumps({"version": "4", "trade_name": "Accepted name"})
        market_state = json.dumps({"version": "2", "market_countries": [{"country": "DE", "original_placed_on_market": True}]})
        connection.execute('''UPDATE testing_subjects SET post_success = 1,
            latest_successful_version = '4', latest_successful_patch_version = '4',
            latest_successful_patch_state_json = ?, latest_successful_market_info_version = '2',
            latest_successful_market_info_state_json = ? WHERE id = ?''', (patch_state, market_state, subject_id))
    service._build_and_record_package(**package_args("market_info_put", country="IE", version="3"))
    with sqlite3.connect(review_db) as connection:
        state = connection.execute('''SELECT latest_successful_version, latest_successful_patch_version,
            latest_successful_patch_state_json, latest_successful_market_info_version,
            latest_successful_market_info_state_json FROM testing_subjects WHERE id = ?''', (subject_id,)).fetchone()
    assert state == ("4", "4", patch_state, "2", market_state)
    assert receipt_rows(review_db)[0]["review_basis"] == "zip_download"
