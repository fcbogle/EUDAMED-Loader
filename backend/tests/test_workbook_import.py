from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.config import get_settings
from app.models import WorkbookImportRunRequest
from app.routers.profiling import (
    imported_workbooks,
    latest_workbook_import,
    latest_workbook_import_diff,
    latest_workbook_import_summary,
    run_workbook_import,
    workbook_import_health_summary,
    workbook_import_schema_summary,
)
from app.services.workbook_import import WorkbookImportService


@pytest.fixture
def isolated_workbook_import_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    db_path = tmp_path / "workbook-import.sqlite3"
    monkeypatch.setenv("EUDAMED_TESTING_STATE_DB_PATH", str(db_path))
    get_settings.cache_clear()
    yield db_path
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
