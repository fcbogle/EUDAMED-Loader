from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.config import get_settings
from app.models import WorkbookImportRunRequest
from app.routers.profiling import (
    get_device_identity_issue,
    get_device_subject,
    get_source_row,
    list_device_identity_issues,
    list_device_subjects,
    list_source_rows,
    imported_workbooks,
    latest_workbook_import,
    latest_workbook_import_diff,
    latest_workbook_import_summary,
    run_workbook_import,
    workbook_import_health_summary,
    workbook_import_schema_summary,
)
from app.services.workbook_import import ImportedSourceRow, WorkbookImportService


@pytest.fixture
def isolated_workbook_import_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    db_path = tmp_path / "workbook-import.sqlite3"
    backup_dir = tmp_path / "backups"
    monkeypatch.setenv("EUDAMED_TESTING_STATE_DB_PATH", str(db_path))
    monkeypatch.setenv("EUDAMED_TESTING_STATE_BACKUP_DIR", str(backup_dir))
    get_settings.cache_clear()
    yield db_path
    get_settings.cache_clear()


@pytest.fixture
def isolated_workbook_import_env(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[Path, Path]]:
    db_path = tmp_path / "workbook-import.sqlite3"
    backup_dir = tmp_path / "backups"
    excel_dir = tmp_path / "excel"
    excel_dir.mkdir()
    (excel_dir / "synthetic.xlsx").write_bytes(b"synthetic workbook placeholder")
    monkeypatch.setenv("EUDAMED_TESTING_STATE_DB_PATH", str(db_path))
    monkeypatch.setenv("EUDAMED_TESTING_STATE_BACKUP_DIR", str(backup_dir))
    monkeypatch.setenv("EUDAMED_EXCEL_DIR", str(excel_dir))
    get_settings.cache_clear()
    yield db_path, excel_dir
    get_settings.cache_clear()


def test_workbook_import_service_persists_import_batch_and_subjects(isolated_workbook_import_db: Path) -> None:
    service = WorkbookImportService()

    result = service.run_import(imported_by="pytest", label="Phase 2 Import", notes="service test")

    workbook_paths = sorted(service.settings.excel_dir.glob("*.xlsx"))
    assert result.import_batch_id >= 1
    assert result.source_type == "source_excel"
    assert result.label == "Phase 2 Import"
    assert result.workbook_count == len(workbook_paths)
    assert result.source_row_count > 0
    assert result.device_subject_count > 0

    latest = service.latest_import_batch()
    assert latest is not None
    assert latest.import_batch_id == result.import_batch_id
    assert latest.workbook_count == result.workbook_count
    assert latest.source_row_count == result.source_row_count

    imported = service.imported_workbooks(import_batch_id=result.import_batch_id)
    assert len(imported) == result.workbook_count
    assert sum(item.row_count for item in imported) == result.source_row_count

    connection = sqlite3.connect(isolated_workbook_import_db)
    try:
        subject_row = connection.execute(
            """
            SELECT product_family, product_variant, catalogue_number, primary_udi_di
            FROM device_subject
            WHERE catalogue_number = 'ELANIC22L1S'
            LIMIT 1
            """
        ).fetchone()
    finally:
        connection.close()

    assert subject_row is not None
    assert subject_row[0] == "Elan"
    assert subject_row[1] == "Elan IC"
    assert subject_row[2] == "ELANIC22L1S"
    assert subject_row[3] == "05050649096501"


def test_workbook_import_routes_return_latest_batch_and_imported_workbooks(isolated_workbook_import_db: Path) -> None:
    payload = WorkbookImportRunRequest(imported_by="pytest", label="Route Import", notes="route test")

    result = run_workbook_import(payload)
    latest = latest_workbook_import()
    workbooks = imported_workbooks(int(result["import_batch_id"]))

    assert latest["import_batch_id"] == result["import_batch_id"]
    assert latest["label"] == "Route Import"
    assert latest["workbook_count"] == result["workbook_count"]
    assert len(workbooks) == result["workbook_count"]
    assert sum(int(item["row_count"]) for item in workbooks) == int(result["source_row_count"])


def test_workbook_import_creates_sqlite_backup(isolated_workbook_import_db: Path) -> None:
    service = WorkbookImportService()

    result = service.run_import(imported_by="pytest", label="Backup Import", notes="backup test")

    backup_dir = service.settings.testing_state_backup_dir
    backups = sorted(backup_dir.glob("testing-state-batch-*.sqlite3"))

    assert result.import_batch_id >= 1
    assert backup_dir.exists()
    assert len(backups) == 1
    assert f"batch-{result.import_batch_id}-" in backups[0].name


def test_workbook_import_monitoring_routes_return_schema_health_and_diff(isolated_workbook_import_db: Path) -> None:
    run_workbook_import(WorkbookImportRunRequest(imported_by="pytest", label="Import One"))
    run_workbook_import(WorkbookImportRunRequest(imported_by="pytest", label="Import Two"))

    schema_summary = workbook_import_schema_summary()
    health_summary = workbook_import_health_summary()
    latest_summary = latest_workbook_import_summary()
    diff_summary = latest_workbook_import_diff()

    table_names = {table["table_name"] for table in schema_summary["tables"]}
    assert "import_batch" in table_names
    assert "source_workbook" in table_names
    assert "source_row" in table_names
    assert "device_subject" in table_names

    source_row_schema = next(table for table in schema_summary["tables"] if table["table_name"] == "source_row")
    assert any(column["name"] == "catalogue_number" for column in source_row_schema["columns"])
    assert any(foreign_key["target_table"] == "source_workbook" for foreign_key in source_row_schema["foreign_keys"])

    health_tables = {table["table_name"]: table for table in health_summary["table_summaries"]}
    assert health_tables["import_batch"]["row_count"] == 2
    assert health_tables["source_workbook"]["orphan_count"] == 0
    assert health_tables["device_subject"]["orphan_count"] == 0
    assert any(issue["code"] == "missing_table" for issue in health_summary["issues"])

    assert latest_summary["import_batch"]["import_batch_id"] == 2
    assert diff_summary["current_import_batch_id"] == 2
    assert diff_summary["previous_import_batch_id"] == 1
    assert diff_summary["source_row_delta"] == 0
    assert diff_summary["device_subject_delta"] == 0
    assert all(item["change_type"] == "unchanged" for item in diff_summary["changed_workbooks"])


def test_workbook_import_matches_existing_subject_by_primary_and_records_drift(
    isolated_workbook_import_env: tuple[Path, Path],
) -> None:
    db_path, _ = isolated_workbook_import_env
    service = WorkbookImportService()
    rows = [ImportedSourceRow(sheet_name="Variant A", row_index=2, values={"dummy": "value"})]
    promotions = iter(
        [
            {
                ("synthetic.xlsx", "Variant A", 2): {
                    "product_family": "Family A",
                    "product_variant": "Variant A",
                    "catalogue_number": "CAT-001",
                    "primary_udi_di": "111111",
                    "submission_operation": "POST",
                    "basic_udi_di": "BASIC-1",
                    "canonical_status": "xml_ready",
                }
            },
            {
                ("synthetic.xlsx", "Variant A", 2): {
                    "product_family": "Family A",
                    "product_variant": "Variant A Updated",
                    "catalogue_number": "CAT-001-REV2",
                    "primary_udi_di": "111111",
                    "submission_operation": "POST",
                    "basic_udi_di": "BASIC-1",
                    "canonical_status": "xml_ready",
                }
            },
        ]
    )
    service._load_source_rows = lambda workbook_path: rows  # type: ignore[method-assign]
    service._promotion_lookup = lambda: next(promotions)  # type: ignore[method-assign]

    first_result = service.run_import(imported_by="pytest", label="Import One")
    second_result = service.run_import(imported_by="pytest", label="Import Two")

    assert first_result.device_subject_count == 1
    assert second_result.device_subject_count == 0

    connection = sqlite3.connect(db_path)
    try:
        subject_count = connection.execute("SELECT COUNT(*) FROM device_subject").fetchone()[0]
        subject_row = connection.execute(
            """
            SELECT product_family, product_variant, catalogue_number, primary_udi_di, subject_key
            FROM device_subject
            """
        ).fetchone()
        issue_rows = connection.execute(
            """
            SELECT issue_code
            FROM device_identity_issue
            ORDER BY id
            """
        ).fetchall()
    finally:
        connection.close()

    assert subject_count == 1
    assert subject_row == ("Family A", "Variant A Updated", "CAT-001-REV2", "111111", "primary:111111")
    assert [row[0] for row in issue_rows] == ["identity_label_drift"]


def test_workbook_import_records_conflict_when_fallback_tuple_matches_different_primary(
    isolated_workbook_import_env: tuple[Path, Path],
) -> None:
    db_path, _ = isolated_workbook_import_env
    service = WorkbookImportService()
    rows = [ImportedSourceRow(sheet_name="Variant A", row_index=2, values={"dummy": "value"})]
    promotions = iter(
        [
            {
                ("synthetic.xlsx", "Variant A", 2): {
                    "product_family": "Family A",
                    "product_variant": "Variant A",
                    "catalogue_number": "CAT-001",
                    "primary_udi_di": "111111",
                    "submission_operation": "POST",
                    "basic_udi_di": "BASIC-1",
                    "canonical_status": "xml_ready",
                }
            },
            {
                ("synthetic.xlsx", "Variant A", 2): {
                    "product_family": "Family A",
                    "product_variant": "Variant A",
                    "catalogue_number": "CAT-001",
                    "primary_udi_di": "222222",
                    "submission_operation": "POST",
                    "basic_udi_di": "BASIC-1",
                    "canonical_status": "xml_ready",
                }
            },
        ]
    )
    service._load_source_rows = lambda workbook_path: rows  # type: ignore[method-assign]
    service._promotion_lookup = lambda: next(promotions)  # type: ignore[method-assign]

    service.run_import(imported_by="pytest", label="Import One")
    second_result = service.run_import(imported_by="pytest", label="Import Two")

    assert second_result.device_subject_count == 0

    connection = sqlite3.connect(db_path)
    try:
        subject_rows = connection.execute(
            """
            SELECT product_family, product_variant, catalogue_number, primary_udi_di, subject_key
            FROM device_subject
            ORDER BY id
            """
        ).fetchall()
        issue_rows = connection.execute(
            """
            SELECT issue_code
            FROM device_identity_issue
            ORDER BY id
            """
        ).fetchall()
    finally:
        connection.close()

    assert subject_rows == [("Family A", "Variant A", "CAT-001", "111111", "primary:111111")]
    assert [row[0] for row in issue_rows] == ["identifier_conflict"]


def test_workbook_import_records_issue_when_identity_is_insufficient(
    isolated_workbook_import_env: tuple[Path, Path],
) -> None:
    db_path, _ = isolated_workbook_import_env
    service = WorkbookImportService()
    rows = [ImportedSourceRow(sheet_name="Variant A", row_index=2, values={"dummy": "value"})]
    service._load_source_rows = lambda workbook_path: rows  # type: ignore[method-assign]
    service._promotion_lookup = lambda: {  # type: ignore[method-assign]
        ("synthetic.xlsx", "Variant A", 2): {
            "product_family": "Family A",
            "product_variant": "Variant A",
            "catalogue_number": None,
            "primary_udi_di": None,
            "submission_operation": "POST",
            "basic_udi_di": None,
            "canonical_status": "xml_ready",
        }
    }

    result = service.run_import(imported_by="pytest", label="Import One")

    assert result.device_subject_count == 0

    connection = sqlite3.connect(db_path)
    try:
        subject_count = connection.execute("SELECT COUNT(*) FROM device_subject").fetchone()[0]
        issue_rows = connection.execute(
            """
            SELECT issue_code
            FROM device_identity_issue
            ORDER BY id
            """
        ).fetchall()
    finally:
        connection.close()

    assert subject_count == 0
    assert [row[0] for row in issue_rows] == ["insufficient_identity_data"]


def test_workbook_import_summary_counts_only_clean_duplicate_rows_as_overlap(
    isolated_workbook_import_env: tuple[Path, Path],
) -> None:
    _, _excel_dir = isolated_workbook_import_env
    service = WorkbookImportService()
    rows = [
        ImportedSourceRow(sheet_name="Variant A", row_index=2, values={"dummy": "first"}),
        ImportedSourceRow(sheet_name="Variant A", row_index=3, values={"dummy": "second"}),
    ]
    service._load_source_rows = lambda workbook_path: rows  # type: ignore[method-assign]
    service._promotion_lookup = lambda: {  # type: ignore[method-assign]
        ("synthetic.xlsx", "Variant A", 2): {
            "product_family": "Family A",
            "product_variant": "Variant A",
            "catalogue_number": "CAT-001",
            "primary_udi_di": "111111",
            "submission_operation": "POST",
            "basic_udi_di": "BASIC-1",
            "canonical_status": "xml_ready",
        },
        ("synthetic.xlsx", "Variant A", 3): {
            "product_family": "Family A",
            "product_variant": "Variant A",
            "catalogue_number": None,
            "primary_udi_di": None,
            "submission_operation": "POST",
            "basic_udi_di": None,
            "canonical_status": "xml_ready",
        },
    }

    service.run_import(imported_by="pytest", label="Import One")
    summary = service.latest_import_snapshot_summary()

    assert summary is not None
    assert summary.import_batch.source_row_count == 2
    assert summary.import_batch.device_subject_count == 1
    assert summary.duplicate_source_row_delta == 0


def test_workbook_import_read_model_endpoints_return_subject_rows_and_identity_issues(
    isolated_workbook_import_env: tuple[Path, Path],
) -> None:
    _, _excel_dir = isolated_workbook_import_env
    service = WorkbookImportService()
    rows = [ImportedSourceRow(sheet_name="Variant A", row_index=2, values={"dummy": "value"})]
    promotions = iter(
        [
            {
                ("synthetic.xlsx", "Variant A", 2): {
                    "product_family": "Family A",
                    "product_variant": "Variant A",
                    "catalogue_number": "CAT-001",
                    "primary_udi_di": "111111",
                    "submission_operation": "POST",
                    "basic_udi_di": "BASIC-1",
                    "canonical_status": "xml_ready",
                }
            },
            {
                ("synthetic.xlsx", "Variant A", 2): {
                    "product_family": "Family A",
                    "product_variant": "Variant A",
                    "catalogue_number": "CAT-001",
                    "primary_udi_di": "222222",
                    "submission_operation": "PATCH",
                    "basic_udi_di": "BASIC-1",
                    "canonical_status": "xml_ready",
                }
            },
        ]
    )
    service._load_source_rows = lambda workbook_path: rows  # type: ignore[method-assign]
    service._promotion_lookup = lambda: next(promotions)  # type: ignore[method-assign]

    first_result = service.run_import(imported_by="pytest", label="Import One")
    second_result = service.run_import(imported_by="pytest", label="Import Two")

    assert first_result.device_subject_count == 1
    assert second_result.device_subject_count == 0

    subject_list = service.list_device_subjects(product_family="Family A")
    assert len(subject_list) == 1
    subject = service.get_device_subject(subject_list[0].id)
    assert subject is not None
    assert subject.primary_udi_di == "111111"
    assert subject.current_import_batch_id == 1

    source_rows = service.list_source_rows(product_family="Family A", limit=10)
    assert len(source_rows) == 2
    source_row = service.get_source_row(source_rows[0].id)
    assert source_row is not None
    assert source_row.workbook_name == "synthetic.xlsx"
    assert source_row.raw_payload_json == '{"dummy": "value"}'

    issues = service.list_device_identity_issues(issue_code="identifier_conflict")
    assert len(issues) == 1
    issue = service.get_device_identity_issue(issues[0].id)
    assert issue is not None
    assert issue.details_json["incoming_primary_udi_di"] == "222222"
    assert issue.import_batch_id == 2

    subject_list_response = list_device_subjects(
        product_family="Family A",
        product_variant=None,
        catalogue_number=None,
        import_batch_id=None,
        limit=10,
    )
    assert len(subject_list_response) == 1
    subject_detail_response = get_device_subject(subject_list_response[0]["id"])
    assert subject_detail_response["primary_udi_di"] == "111111"

    source_rows_response = list_source_rows(
        product_family="Family A",
        product_variant=None,
        catalogue_number=None,
        submission_operation=None,
        import_batch_id=None,
        limit=10,
    )
    assert len(source_rows_response) == 2
    source_row_detail_response = get_source_row(source_rows_response[0]["id"])
    assert source_row_detail_response["workbook_name"] == "synthetic.xlsx"

    issues_response = list_device_identity_issues(
        issue_code="identifier_conflict",
        product_family=None,
        product_variant=None,
        catalogue_number=None,
        import_batch_id=None,
        limit=10,
    )
    assert len(issues_response) == 1
    issue_detail_response = get_device_identity_issue(issues_response[0]["id"])
    assert issue_detail_response["details_json"]["incoming_primary_udi_di"] == "222222"


def test_workbook_import_skips_excluded_footspares_workbook(
    isolated_workbook_import_env: tuple[Path, Path],
) -> None:
    db_path, excel_dir = isolated_workbook_import_env
    excluded_name = "Template for Accessories_Footspares EUDAMED.xlsx"
    (excel_dir / "synthetic.xlsx").unlink()
    (excel_dir / excluded_name).write_bytes(b"excluded workbook placeholder")

    service = WorkbookImportService()
    rows = [ImportedSourceRow(sheet_name="Footspares", row_index=2, values={"dummy": "value"})]
    service._load_source_rows = lambda workbook_path: rows  # type: ignore[method-assign]
    service._promotion_lookup = lambda: {  # type: ignore[method-assign]
        (excluded_name, "Footspares", 2): {
            "product_family": None,
            "product_variant": "Footspares",
            "catalogue_number": None,
            "primary_udi_di": None,
            "submission_operation": None,
            "basic_udi_di": None,
            "canonical_status": "xml_blocked",
        }
    }

    result = service.run_import(imported_by="pytest", label="Excluded workbook import")

    assert result.workbook_count == 0
    assert result.source_row_count == 0
    assert result.device_subject_count == 0

    connection = sqlite3.connect(db_path)
    try:
        source_workbook_count = connection.execute("SELECT COUNT(*) FROM source_workbook").fetchone()[0]
        source_row_count = connection.execute("SELECT COUNT(*) FROM source_row").fetchone()[0]
        identity_issue_count = connection.execute("SELECT COUNT(*) FROM device_identity_issue").fetchone()[0]
    finally:
        connection.close()

    assert source_workbook_count == 0
    assert source_row_count == 0
    assert identity_issue_count == 0
