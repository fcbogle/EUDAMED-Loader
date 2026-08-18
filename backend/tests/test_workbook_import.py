from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.config import get_settings
from app.models import WorkbookImportRunRequest
from app.routers.canonical import canonical_validation_sqlite
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
from app.services.testing_state_store import TestingStateStore as PlaygroundStateStore
from app.services.canonical_validation import CanonicalValidationService
from app.services.workbook_import import ImportedSourceRow, WorkbookImportService
from app.services.xml_generation import XmlGenerationService
from app.services.xml_selection import ValidationRecordSelector
from app.validation_models import CanonicalValidationBundle, CanonicalValidationFieldValue, CanonicalValidationRecord, CompletenessSnapshot


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

def _apply_synthetic_import_stubs(
    monkeypatch: pytest.MonkeyPatch,
    *,
    rows: list[ImportedSourceRow] | None = None,
    promotions: dict[tuple[str, str, int], dict[str, str | None]] | None = None,
) -> None:
    synthetic_rows = rows or [ImportedSourceRow(sheet_name="Variant A", row_index=2, values={"dummy": "value"})]
    synthetic_promotions = promotions or {
        ("synthetic.xlsx", "Variant A", 2): {
            "product_family": "Family A",
            "product_variant": "Variant A",
            "catalogue_number": "CAT-001",
            "primary_udi_di": "111111",
            "submission_operation": "POST",
            "basic_udi_di": "BASIC-1",
            "canonical_status": "xml_ready",
        }
    }
    monkeypatch.setattr(WorkbookImportService, "_load_source_rows", lambda self, workbook_path: synthetic_rows)
    monkeypatch.setattr(WorkbookImportService, "_promotion_lookup", lambda self: synthetic_promotions)
    first_promotion = next(iter(synthetic_promotions.values()))
    product_family = first_promotion["product_family"] or "Family A"
    product_variant = first_promotion["product_variant"] or "Variant A"
    catalogue_number = first_promotion["catalogue_number"] or "CAT-001"
    primary_udi_di = first_promotion["primary_udi_di"] or "111111"
    submission_operation = first_promotion["submission_operation"] or "POST"
    workbook_name, sheet_name, row_index = next(iter(synthetic_promotions.keys()))
    fields = [
        CanonicalValidationFieldValue(
            canonical_path="basic_device.basic_udi_di",
            business_label="Basic UDI-DI",
            required=True,
            xml_required=True,
            value=first_promotion["basic_udi_di"] or "BASIC-1",
            source="derived",
            source_detail="basic_udi_di",
        ),
        CanonicalValidationFieldValue(
            canonical_path="device_record.primary_udi_di",
            business_label="Primary UDI-DI",
            required=True,
            xml_required=True,
            value=primary_udi_di,
            source="workbook",
            source_detail="primary_udi_di",
        ),
    ]
    completeness = CompletenessSnapshot(
        mapped_required_fields=2,
        total_required_fields=2,
        missing_required_fields=0,
        status="complete",
    )
    record = CanonicalValidationRecord(
        source_workbook=workbook_name,
        product_family=product_family,
        product_variant=product_variant,
        source_sheet=sheet_name,
        source_row_index=row_index,
        trade_name="Synthetic Trade Name",
        primary_udi_di=primary_udi_di,
        catalogue_number=catalogue_number,
        issuing_entity="GS1",
        submission_operation=submission_operation,
        reference_match_status="matched",
        completeness=completeness,
        xml_readiness=completeness,
        blockers=[],
        xml_blockers=[],
        fields=fields,
    )
    bundle = CanonicalValidationBundle(
        family_scope="Synthetic scope",
        scope_note="Synthetic scope",
        validation_note="Synthetic validation",
        total_source_records=len(synthetic_rows),
        validation_subset_records=1,
        excluded_records=0,
        matched_reference_records=1,
        tracked_required_fields=2,
        tracked_xml_required_fields=2,
        ready_records=1,
        blocked_records=0,
        xml_ready_records=1,
        xml_blocked_records=0,
        sample_records=[record],
        records=[record],
    )
    monkeypatch.setattr(WorkbookImportService, "_validation_bundle", lambda self: bundle)


def _synthetic_validation_bundle_from_promotions(
    promotions: dict[tuple[str, str, int], dict[str, str | None]],
    *,
    row_count: int = 1,
) -> CanonicalValidationBundle:
    first_promotion = next(iter(promotions.values()))
    product_family = first_promotion["product_family"] or "Family A"
    product_variant = first_promotion["product_variant"] or "Variant A"
    catalogue_number = first_promotion["catalogue_number"] or "CAT-001"
    primary_udi_di = first_promotion["primary_udi_di"] or "111111"
    submission_operation = first_promotion["submission_operation"] or "POST"
    workbook_name, sheet_name, row_index = next(iter(promotions.keys()))
    basic_udi_di = first_promotion["basic_udi_di"] or "BASIC-1"
    fields = [
        CanonicalValidationFieldValue(
            canonical_path="basic_device.basic_udi_di",
            business_label="Basic UDI-DI",
            required=True,
            xml_required=True,
            value=basic_udi_di,
            source="derived",
            source_detail="basic_udi_di",
        ),
        CanonicalValidationFieldValue(
            canonical_path="device_record.primary_udi_di",
            business_label="Primary UDI-DI",
            required=True,
            xml_required=True,
            value=primary_udi_di,
            source="workbook",
            source_detail="primary_udi_di",
        ),
    ]
    completeness = CompletenessSnapshot(
        mapped_required_fields=sum(1 for field in fields if field.value is not None),
        total_required_fields=len(fields),
        missing_required_fields=sum(1 for field in fields if field.value is None),
        status="complete" if all(field.value is not None for field in fields) else "incomplete",
    )
    record = CanonicalValidationRecord(
        source_workbook=workbook_name,
        product_family=product_family,
        product_variant=product_variant,
        source_sheet=sheet_name,
        source_row_index=row_index,
        trade_name="Synthetic Trade Name",
        primary_udi_di=primary_udi_di,
        catalogue_number=catalogue_number,
        issuing_entity="GS1",
        submission_operation=submission_operation,
        reference_match_status="matched",
        completeness=completeness,
        xml_readiness=completeness,
        blockers=[],
        xml_blockers=[],
        fields=fields,
    )
    return CanonicalValidationBundle(
        family_scope="Synthetic scope",
        scope_note="Synthetic scope",
        validation_note="Synthetic validation",
        total_source_records=row_count,
        validation_subset_records=1,
        excluded_records=0,
        matched_reference_records=1,
        tracked_required_fields=len(fields),
        tracked_xml_required_fields=len(fields),
        ready_records=int(completeness.status == "complete"),
        blocked_records=int(completeness.status != "complete"),
        xml_ready_records=int(completeness.status == "complete"),
        xml_blocked_records=int(completeness.status != "complete"),
        sample_records=[record],
        records=[record],
    )


def test_workbook_import_service_persists_import_batch_and_subjects(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
    service = WorkbookImportService()

    result = service.run_import(imported_by="pytest", label="Phase 2 Import", notes="service test")

    assert result.import_batch_id >= 1
    assert result.source_type == "source_excel"
    assert result.label == "Phase 2 Import"
    assert result.workbook_count == 1
    assert result.source_row_count == 1
    assert result.device_subject_count == 1

    latest = service.latest_import_batch()
    assert latest is not None
    assert latest.import_batch_id == result.import_batch_id
    assert latest.workbook_count == result.workbook_count
    assert latest.source_row_count == result.source_row_count

    imported = service.imported_workbooks(import_batch_id=result.import_batch_id)
    assert len(imported) == result.workbook_count
    assert sum(item.row_count for item in imported) == result.source_row_count

    connection = sqlite3.connect(db_path)
    try:
        subject_row = connection.execute(
            """
            SELECT product_family, product_variant, catalogue_number, primary_udi_di
            FROM device_subject
            WHERE catalogue_number = 'CAT-001'
            LIMIT 1
            """
        ).fetchone()
        canonical_row = connection.execute(
            """
            SELECT completeness_status, xml_readiness_status, xml_ready
            FROM canonical_device_record
            LIMIT 1
            """
        ).fetchone()
        field_count = connection.execute("SELECT COUNT(*) FROM canonical_field_value").fetchone()[0]
    finally:
        connection.close()

    assert subject_row is not None
    assert subject_row[0] == "Family A"
    assert subject_row[1] == "Variant A"
    assert subject_row[2] == "CAT-001"
    assert subject_row[3] == "111111"
    assert canonical_row == ("complete", "complete", 1)
    assert field_count == 2


def test_workbook_import_routes_return_latest_batch_and_imported_workbooks(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
    payload = WorkbookImportRunRequest(imported_by="pytest", label="Route Import", notes="route test")

    result = run_workbook_import(payload)
    latest = latest_workbook_import()
    workbooks = imported_workbooks(int(result["import_batch_id"]))

    assert latest["import_batch_id"] == result["import_batch_id"]
    assert latest["label"] == "Route Import"
    assert latest["workbook_count"] == result["workbook_count"]
    assert len(workbooks) == result["workbook_count"]
    assert sum(int(item["row_count"]) for item in workbooks) == int(result["source_row_count"])


def test_workbook_import_creates_sqlite_backup(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
    service = WorkbookImportService()

    result = service.run_import(imported_by="pytest", label="Backup Import", notes="backup test")

    backup_dir = service.settings.testing_state_backup_dir
    backups = sorted(backup_dir.glob("testing-state-batch-*.sqlite3"))

    assert result.import_batch_id >= 1
    assert backup_dir.exists()
    assert len(backups) == 1
    assert f"batch-{result.import_batch_id}-" in backups[0].name


def test_workbook_import_monitoring_routes_return_schema_health_and_diff(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
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
    assert all(issue["level"] in {"warning", "info"} for issue in health_summary["issues"])

    assert latest_summary["import_batch"]["import_batch_id"] == 2
    assert diff_summary["current_import_batch_id"] == 2
    assert diff_summary["previous_import_batch_id"] == 1
    assert diff_summary["source_row_delta"] == 0
    assert diff_summary["device_subject_delta"] == 0
    assert all(item["change_type"] == "unchanged" for item in diff_summary["changed_workbooks"])


def test_workbook_import_creates_canonical_tables_and_backfills_device_subject_links(
    isolated_workbook_import_env: tuple[Path, Path],
) -> None:
    db_path, _excel_dir = isolated_workbook_import_env
    service = WorkbookImportService()
    rows = [ImportedSourceRow(sheet_name="Variant A", row_index=2, values={"dummy": "value"})]
    service._load_source_rows = lambda workbook_path: rows  # type: ignore[method-assign]
    promotions = {
        ("synthetic.xlsx", "Variant A", 2): {
            "product_family": "Family A",
            "product_variant": "Variant A",
            "catalogue_number": "CAT-001",
            "primary_udi_di": "111111",
            "submission_operation": "POST",
            "basic_udi_di": "BASIC-1",
            "canonical_status": "xml_ready",
        }
    }
    service._promotion_lookup = lambda: promotions  # type: ignore[method-assign]
    service._validation_bundle = lambda: _synthetic_validation_bundle_from_promotions(promotions)  # type: ignore[method-assign]

    service.run_import(imported_by="pytest", label="Import One")

    connection = sqlite3.connect(db_path)
    try:
        subject_id = int(
            connection.execute(
                """
                SELECT id
                FROM device_subject
                WHERE product_family = 'Family A'
                  AND product_variant = 'Variant A'
                  AND catalogue_number = 'CAT-001'
                LIMIT 1
                """
            ).fetchone()[0]
        )
        connection.execute(
            """
            INSERT INTO testing_subjects (
                subject_key,
                normalized_product_family,
                normalized_product_variant,
                normalized_catalogue_number,
                normalized_primary_udi_di,
                normalized_basic_udi_di,
                product_family,
                product_variant,
                catalogue_number,
                primary_udi_di,
                basic_udi_di
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "family-a|variant-a|cat-001",
                "familya",
                "varianta",
                "cat-001",
                "111111",
                "basic-1",
                "Family A",
                "Variant A",
                "CAT-001",
                "111111",
                "BASIC-1",
            ),
        )
        connection.execute(
            """
            INSERT INTO reviewed_post_baselines (
                normalized_product_family,
                normalized_product_variant,
                normalized_catalogue_number,
                product_family,
                product_variant,
                catalogue_number
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("familya", "varianta", "cat-001", "Family A", "Variant A", "CAT-001"),
        )
        connection.commit()
    finally:
        connection.close()

    PlaygroundStateStore().refresh_device_subject_links()

    connection = sqlite3.connect(db_path)
    try:
        table_names = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('canonical_device_record', 'canonical_field_value')"
            ).fetchall()
        }
        testing_subject_link = connection.execute(
            "SELECT device_subject_id FROM testing_subjects WHERE subject_key = 'family-a|variant-a|cat-001'"
        ).fetchone()
        baseline_link = connection.execute(
            """
            SELECT device_subject_id
            FROM reviewed_post_baselines
            WHERE normalized_product_family = 'familya'
              AND normalized_product_variant = 'varianta'
              AND normalized_catalogue_number = 'cat-001'
            """
        ).fetchone()
    finally:
        connection.close()

    assert table_names == {"canonical_device_record", "canonical_field_value"}
    assert testing_subject_link == (subject_id,)
    assert baseline_link == (subject_id,)


def test_sqlite_canonical_validation_bundle_matches_persisted_projection(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
    service = WorkbookImportService()

    service.run_import(imported_by="pytest", label="Import One")

    sqlite_bundle = service.canonical_validation_bundle_from_sqlite()
    sqlite_route_bundle = canonical_validation_sqlite()

    assert sqlite_bundle is not None
    assert sqlite_bundle.total_source_records == 1
    assert sqlite_bundle.validation_subset_records == 1
    assert sqlite_bundle.ready_records == 1
    assert sqlite_bundle.xml_ready_records == 1
    assert len(sqlite_bundle.records) == 1
    assert sqlite_bundle.records[0].product_family == "Family A"
    assert sqlite_bundle.records[0].product_variant == "Variant A"
    assert sqlite_bundle.records[0].catalogue_number == "CAT-001"
    assert len(sqlite_bundle.family_summaries) == 1
    assert sqlite_bundle.family_summaries[0].product_family == "Family A"
    assert len(sqlite_route_bundle["records"]) == 1
    assert sqlite_route_bundle["records"][0]["catalogue_number"] == "CAT-001"
    assert sqlite_route_bundle["persistence_source"] == "sqlite_projection"
    assert sqlite_route_bundle["projection_status"] == "ready"
    assert sqlite_route_bundle["source_import_batch_id"] == 1


def test_validation_record_selector_uses_sqlite_projection_when_import_exists(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
    service = WorkbookImportService()
    service.run_import(imported_by="pytest", label="Import One")

    class FailingValidationService:
        def build_validation_bundle(self) -> CanonicalValidationBundle:
            raise AssertionError("Selector should not fall back to workbook-derived validation when SQLite projection exists.")

    selector = ValidationRecordSelector(FailingValidationService())  # type: ignore[arg-type]

    selected = selector.find_post_record(
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-001",
    )

    assert selected.catalogue_number == "CAT-001"
    assert selected.primary_udi_di == "111111"


def test_xml_generation_scope_uses_sqlite_projection_when_import_exists(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
    service = WorkbookImportService()
    service.run_import(imported_by="pytest", label="Import One")

    generation_service = XmlGenerationService()
    monkeypatch.setattr(
        generation_service.validation_service,
        "build_validation_bundle",
        lambda: (_ for _ in ()).throw(
            AssertionError("Generation scope should not fall back to workbook-derived validation when SQLite projection exists.")
        ),
    )

    scope = generation_service.generation_scope()

    assert scope.family_scope == "Synthetic scope"
    assert scope.total_xml_ready_records == 1
    assert len(scope.families) == 1
    assert scope.families[0].product_family == "Family A"


def test_xml_generation_variant_post_candidates_use_sqlite_projection_when_import_exists(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
    service = WorkbookImportService()
    service.run_import(imported_by="pytest", label="Import One")

    generation_service = XmlGenerationService()
    monkeypatch.setattr(
        generation_service.validation_service,
        "build_validation_bundle",
        lambda: (_ for _ in ()).throw(
            AssertionError("Variant POST candidate selection should not fall back to workbook-derived validation when SQLite projection exists.")
        ),
    )

    records, excluded, eligible_count = generation_service._variant_post_records_with_exclusions(
        product_family="Family A",
        product_variant="Variant A",
        record_count=None,
    )

    assert len(records) == 1
    assert not excluded
    assert eligible_count == 1
    assert records[0].catalogue_number == "CAT-001"


def test_sqlite_canonical_validation_route_rebuilds_stale_snapshot(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
    service = WorkbookImportService()

    import_result = service.run_import(imported_by="pytest", label="Import One")

    connection = sqlite3.connect(db_path)
    try:
        connection.execute(
            """
            UPDATE canonical_projection_snapshot
            SET total_source_records = 5,
                excluded_records = 4
            WHERE source_import_batch_id = ?
            """,
            (import_result.import_batch_id,),
        )
        connection.commit()
    finally:
        connection.close()

    sqlite_route_bundle = canonical_validation_sqlite()

    assert sqlite_route_bundle["total_source_records"] == 1
    assert sqlite_route_bundle["validation_subset_records"] == 1
    assert sqlite_route_bundle["excluded_records"] == 0
    assert len(sqlite_route_bundle["records"]) == 1
    assert sqlite_route_bundle["projection_status"] == "rebuilt"


def test_sqlite_canonical_validation_route_raises_when_projection_cannot_be_rebuilt(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
    service = WorkbookImportService()
    import_result = service.run_import(imported_by="pytest", label="Import One")

    connection = sqlite3.connect(db_path)
    try:
        connection.execute(
            "DELETE FROM canonical_projection_snapshot WHERE source_import_batch_id = ?",
            (import_result.import_batch_id,),
        )
        connection.execute(
            "DELETE FROM canonical_device_record WHERE source_import_batch_id = ?",
            (import_result.import_batch_id,),
        )
        connection.commit()
    finally:
        connection.close()

    monkeypatch.setattr(WorkbookImportService, "rebuild_canonical_projection", lambda self, import_batch_id=None: 0)
    monkeypatch.setattr(
        CanonicalValidationService,
        "build_validation_bundle",
        lambda self: (_ for _ in ()).throw(AssertionError("Workbook fallback should not run")),
    )

    with pytest.raises(HTTPException) as exc_info:
        canonical_validation_sqlite()

    assert exc_info.value.status_code == 503
    assert "missing in SQLite" in str(exc_info.value.detail)


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
    current_promotions: dict[tuple[str, str, int], dict[str, str | None]] = {}

    def next_promotions() -> dict[tuple[str, str, int], dict[str, str | None]]:
        current_promotions.clear()
        current_promotions.update(next(promotions))
        return dict(current_promotions)

    service._promotion_lookup = next_promotions  # type: ignore[method-assign]
    service._validation_bundle = (  # type: ignore[method-assign]
        lambda: _synthetic_validation_bundle_from_promotions(current_promotions or next_promotions())
    )

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
    current_promotions: dict[tuple[str, str, int], dict[str, str | None]] = {}

    def next_promotions() -> dict[tuple[str, str, int], dict[str, str | None]]:
        current_promotions.clear()
        current_promotions.update(next(promotions))
        return dict(current_promotions)

    service._promotion_lookup = next_promotions  # type: ignore[method-assign]
    service._validation_bundle = (  # type: ignore[method-assign]
        lambda: _synthetic_validation_bundle_from_promotions(current_promotions or next_promotions())
    )

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
    promotions = {
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
    service._promotion_lookup = lambda: promotions  # type: ignore[method-assign]
    service._validation_bundle = lambda: _synthetic_validation_bundle_from_promotions(promotions)  # type: ignore[method-assign]

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
    promotions = {
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
    service._promotion_lookup = lambda: promotions  # type: ignore[method-assign]
    service._validation_bundle = lambda: _synthetic_validation_bundle_from_promotions(promotions, row_count=2)  # type: ignore[method-assign]

    service.run_import(imported_by="pytest", label="Import One")
    summary = service.latest_import_snapshot_summary()

    assert summary is not None
    assert summary.import_batch.source_row_count == 2
    assert summary.import_batch.device_subject_count == 1
    assert summary.canonical_projection_status == "ready"
    assert summary.canonical_projection_import_batch_id == summary.import_batch.import_batch_id
    assert summary.duplicate_source_row_delta == 0
    assert summary.merged_source_row_count == 0
    assert summary.unresolved_identity_row_count == 1


def test_workbook_import_summary_exposes_explicit_duplicate_metrics(
    isolated_workbook_import_env: tuple[Path, Path],
) -> None:
    _, _excel_dir = isolated_workbook_import_env
    service = WorkbookImportService()
    rows = [
        ImportedSourceRow(sheet_name="Variant A", row_index=2, values={"dummy": "first"}),
        ImportedSourceRow(sheet_name="Variant A", row_index=3, values={"dummy": "second"}),
    ]
    service._load_source_rows = lambda workbook_path: rows  # type: ignore[method-assign]
    promotions = {
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
            "catalogue_number": "CAT-001",
            "primary_udi_di": "111111",
            "submission_operation": "POST",
            "basic_udi_di": "BASIC-1",
            "canonical_status": "xml_ready",
        },
    }
    service._promotion_lookup = lambda: promotions  # type: ignore[method-assign]
    service._validation_bundle = lambda: _synthetic_validation_bundle_from_promotions(promotions, row_count=2)  # type: ignore[method-assign]

    service.run_import(imported_by="pytest", label="Import One")
    summary = service.latest_import_snapshot_summary()

    assert summary is not None
    assert summary.import_batch.source_row_count == 2
    assert summary.import_batch.device_subject_count == 1
    assert summary.canonical_projection_status == "ready"
    assert summary.merged_source_row_count == 1
    assert summary.duplicate_source_row_delta == 1
    assert summary.workbook_duplicate_group_count == 1
    assert summary.workbook_duplicate_row_count == 2
    assert summary.unresolved_identity_row_count == 0


def test_workbook_import_summary_marks_stale_canonical_projection(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
    service = WorkbookImportService()
    import_result = service.run_import(imported_by="pytest", label="Import One")

    connection = sqlite3.connect(db_path)
    try:
        connection.execute(
            """
            UPDATE canonical_projection_snapshot
            SET total_source_records = 999
            WHERE source_import_batch_id = ?
            """,
            (import_result.import_batch_id,),
        )
        connection.commit()
    finally:
        connection.close()

    summary = service.latest_import_snapshot_summary()

    assert summary is not None
    assert summary.canonical_projection_status == "stale"
    assert summary.canonical_projection_import_batch_id == import_result.import_batch_id


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
    current_promotions: dict[tuple[str, str, int], dict[str, str | None]] = {}

    def next_promotions() -> dict[tuple[str, str, int], dict[str, str | None]]:
        current_promotions.clear()
        current_promotions.update(next(promotions))
        return dict(current_promotions)

    service._promotion_lookup = next_promotions  # type: ignore[method-assign]
    service._validation_bundle = (  # type: ignore[method-assign]
        lambda: _synthetic_validation_bundle_from_promotions(current_promotions or next_promotions())
    )

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
    promotions = {
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
    service._promotion_lookup = lambda: promotions  # type: ignore[method-assign]
    service._validation_bundle = lambda: _synthetic_validation_bundle_from_promotions(promotions)  # type: ignore[method-assign]

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
