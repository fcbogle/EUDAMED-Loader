from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.config import get_settings
from app.models import WorkbookImportRunRequest
from app.routers.canonical import canonical_validation
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
from app.routers.xml_generation import (
    assess_bulk_market_info,
    assess_bulk_patch,
    assess_bulk_post,
    assess_single_market_info,
    assess_single_patch,
    assess_single_post,
    testing_subject_history as xml_testing_subject_history,
    testing_subject_summaries as xml_testing_subject_summaries,
    testing_workspace_summary as xml_testing_workspace_summary,
    xml_generation_scope,
)
from app.services.testing_state_store import TestingStateStore as PlaygroundStateStore
from app.services.testing_success_xml import TestingSuccessXmlService
from app.services.canonical_validation import CanonicalValidationService
from app.services.testing_read_model import TestingReadModelService
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


def _insert_testing_subject(
    db_path: Path,
    *,
    product_family: str,
    product_variant: str,
    catalogue_number: str,
    primary_udi_di: str,
    basic_udi_di: str,
    post_success: int = 0,
    baseline_patch_success: int = 0,
    latest_successful_version: str | None = None,
    latest_successful_market_info_version: str | None = None,
    latest_successful_state_json: str | None = None,
    latest_successful_market_info_state_json: str | None = None,
) -> int:
    normalized_product_family = "".join(product_family.casefold().split())
    normalized_product_variant = "".join(product_variant.casefold().split())
    normalized_catalogue_number = "".join(catalogue_number.casefold().split())
    normalized_primary_udi_di = "".join(primary_udi_di.casefold().split())
    normalized_basic_udi_di = "".join(basic_udi_di.casefold().split())
    connection = sqlite3.connect(db_path)
    try:
        cursor = connection.execute(
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
                basic_udi_di,
                post_success,
                baseline_patch_success,
                latest_successful_version,
                latest_successful_market_info_version,
                latest_successful_state_json,
                latest_successful_market_info_state_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"{normalized_product_family}|{normalized_product_variant}|{normalized_catalogue_number}",
                normalized_product_family,
                normalized_product_variant,
                normalized_catalogue_number,
                normalized_primary_udi_di,
                normalized_basic_udi_di,
                product_family,
                product_variant,
                catalogue_number,
                primary_udi_di,
                basic_udi_di,
                post_success,
                baseline_patch_success,
                latest_successful_version,
                latest_successful_market_info_version,
                latest_successful_state_json,
                latest_successful_market_info_state_json,
            ),
        )
        connection.commit()
        return int(cursor.lastrowid)
    finally:
        connection.close()


def _insert_testing_event(
    db_path: Path,
    *,
    subject_id: int,
    event_index: int,
    message_type: str,
    status: str,
    version: str,
    scenario_id: str | None = None,
) -> None:
    connection = sqlite3.connect(db_path)
    try:
        connection.execute(
            """
            INSERT INTO testing_events (
                subject_id,
                event_index,
                message_type,
                status,
                version,
                scenario_id,
                raw_event_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                subject_id,
                event_index,
                message_type,
                status,
                version,
                scenario_id,
                json.dumps({"message_type": message_type, "status": status, "version": version}),
            ),
        )
        connection.commit()
    finally:
        connection.close()


def _insert_reviewed_post_baseline(
    db_path: Path,
    *,
    product_family: str,
    product_variant: str,
    catalogue_number: str,
) -> None:
    connection = sqlite3.connect(db_path)
    try:
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
            (
                "".join(product_family.casefold().split()),
                "".join(product_variant.casefold().split()),
                "".join(catalogue_number.casefold().split()),
                product_family,
                product_variant,
                catalogue_number,
            ),
        )
        connection.commit()
    finally:
        connection.close()


def test_success_xml_upload_records_bulk_udidi_post_acknowledgements(
    isolated_workbook_import_db: Path,
) -> None:
    PlaygroundStateStore()
    first_subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L3S",
        primary_udi_di="05050649058226",
        basic_udi_di="5050649ESPRITVZ",
    )
    second_subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L3SD",
        primary_udi_di="05050649058233",
        basic_udi_di="5050649ESPRITVZ",
    )

    xml_payload = """<?xml version='1.0' encoding='utf-8'?>
<m:PullAck xmlns:m="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Message/v1" xmlns:s="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Service/v1">
  <m:correlationID>bulk-success-correlation</m:correlationID>
  <m:creationDateTime>2026-08-23T15:30:00+00:00</m:creationDateTime>
  <m:messageID>bulk-success-message</m:messageID>
  <m:sender>
    <m:node>
      <s:nodeActorCode>EUDAMED</s:nodeActorCode>
    </m:node>
    <m:service>
      <s:serviceID>UDI_DI</s:serviceID>
      <s:serviceOperation>POST</s:serviceOperation>
    </m:service>
  </m:sender>
  <m:responseEntity>
    <m:responseCode>SUCCESS</m:responseCode>
    <m:entityCode>05050649058226</m:entityCode>
    <m:entityVersion>1</m:entityVersion>
  </m:responseEntity>
  <m:responseEntity>
    <m:responseCode>SUCCESS</m:responseCode>
    <m:entityCode>05050649058233</m:entityCode>
    <m:entityVersion>1</m:entityVersion>
  </m:responseEntity>
</m:PullAck>
"""

    result = TestingSuccessXmlService().record_success_xml(
        xml_bytes=xml_payload.encode("utf-8"),
        source_file_name="bulk-udidi-success.xml",
    )

    assert result.message_type == "UDI_DI.POST"
    assert result.operation_label == "Device UDI-DI POST"
    assert result.entity_count == 2
    assert result.recorded_event_count == 2
    assert result.duplicate_event_count == 0
    assert result.created_subject_count == 0
    assert result.duplicate_event is False
    assert result.successful_entity_count == 2
    assert result.error_entity_count == 0
    assert "2 successful" in result.summary_message

    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
      rows = connection.execute(
          """
          SELECT id, catalogue_number, post_success, latest_successful_version
          FROM testing_subjects
          WHERE id IN (?, ?)
          ORDER BY id
          """,
          (first_subject_id, second_subject_id),
      ).fetchall()
      assert [dict(row) for row in rows] == [
          {
              "id": first_subject_id,
              "catalogue_number": "ESP22L3S",
              "post_success": 1,
              "latest_successful_version": "1",
          },
          {
              "id": second_subject_id,
              "catalogue_number": "ESP22L3SD",
              "post_success": 1,
              "latest_successful_version": "1",
          },
      ]
      event_rows = connection.execute(
          """
          SELECT subject_id, event_index, message_type, status, version
          FROM testing_events
          WHERE subject_id IN (?, ?)
          ORDER BY subject_id, event_index
          """,
          (first_subject_id, second_subject_id),
      ).fetchall()
      assert [dict(row) for row in event_rows] == [
          {
              "subject_id": first_subject_id,
              "event_index": 0,
              "message_type": "UDI_DI.POST",
              "status": "SUCCESS",
              "version": "1",
          },
          {
              "subject_id": second_subject_id,
              "event_index": 0,
              "message_type": "UDI_DI.POST",
              "status": "SUCCESS",
              "version": "1",
          },
      ]
    finally:
      connection.close()


def test_success_xml_upload_records_mixed_bulk_patch_outcomes_per_device(
    isolated_workbook_import_db: Path,
) -> None:
    PlaygroundStateStore()
    accepted_subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Linx",
        product_variant="Linx",
        catalogue_number="LINX22L1SD",
        primary_udi_di="05050649085529",
        basic_udi_di="5050649LINX2G",
        post_success=1,
        latest_successful_version="2",
    )
    error_subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Linx",
        product_variant="Linx",
        catalogue_number="LINX22L1S",
        primary_udi_di="05050649085512",
        basic_udi_di="5050649LINX2G",
        post_success=1,
        latest_successful_version="3",
    )
    xml_payload = """<?xml version='1.0' encoding='utf-8'?>
<m:Acknowledgement xmlns:m="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Message/v1" xmlns:s="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Service/v1">
  <m:correlationID>mixed-patch-correlation</m:correlationID>
  <m:creationDateTime>2026-09-01T08:09:14.638+02:00</m:creationDateTime>
  <m:messageID>mixed-patch-ack-message</m:messageID>
  <m:sender><m:service><s:serviceID>UDI_DI</s:serviceID><s:serviceOperation>PATCH</s:serviceOperation></m:service></m:sender>
  <m:responseEntity><m:entityCode>05050649085529</m:entityCode><m:responseCode>SUCCESS</m:responseCode></m:responseEntity>
  <m:responseEntity>
    <m:entityCode>05050649085512</m:entityCode><m:responseCode>PROCESSED_WITH_ERRORS</m:responseCode>
    <m:report><m:elementReport><m:operationErrorCode>marketInfoLink</m:operationErrorCode><m:operationErrorDetail>Please utilise Update of Market Information service to update Market Information</m:operationErrorDetail></m:elementReport></m:report>
  </m:responseEntity>
</m:Acknowledgement>
"""

    result = TestingSuccessXmlService().record_success_xml(
        xml_bytes=xml_payload.encode("utf-8"),
        source_file_name="mixed-bulk-patch.xml",
    )

    assert result.successful_entity_count == 1
    assert result.error_entity_count == 1
    assert result.error_entity_codes == ["05050649085512"]
    assert result.error_details == ["Please utilise Update of Market Information service to update Market Information"]
    assert PlaygroundStateStore().has_pending_market_info_update_error(
        product_family="Linx",
        product_variant="Linx",
        catalogue_number="LINX22L1S",
    ) is True

    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            """
            SELECT subject_id, event_kind, status, raw_event_json
            FROM testing_events
            WHERE subject_id IN (?, ?)
            ORDER BY subject_id, event_index
            """,
            (accepted_subject_id, error_subject_id),
        ).fetchall()
        assert [(row["subject_id"], row["event_kind"], row["status"]) for row in rows] == [
            (accepted_subject_id, "success_ack", "SUCCESS"),
            (error_subject_id, "error_ack", "ERROR"),
        ]
        assert "Update of Market Information service" in str(rows[1]["raw_event_json"])
        state_rows = connection.execute(
            """
            SELECT id, latest_successful_message_type, latest_successful_version
            FROM testing_subjects
            WHERE id IN (?, ?)
            ORDER BY id
            """,
            (accepted_subject_id, error_subject_id),
        ).fetchall()
        assert [tuple(row) for row in state_rows] == [
            (accepted_subject_id, "UDI_DI.PATCH", "2"),
            (error_subject_id, None, "3"),
        ]
    finally:
        connection.close()


def test_market_info_error_records_eudamed_version_floor(
    isolated_workbook_import_db: Path,
) -> None:
    PlaygroundStateStore()
    subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Linx",
        product_variant="Linx",
        catalogue_number="LINX22L1S",
        primary_udi_di="05050649085512",
        basic_udi_di="5050649LINX2G",
        post_success=1,
        latest_successful_market_info_version="1",
        latest_successful_market_info_state_json=json.dumps(
            {
                "version": "1",
                "market_countries": [{"country": "DE", "original_placed_on_market": True}],
            }
        ),
    )
    xml_payload = """<?xml version='1.0' encoding='utf-8'?>
<m:Acknowledgement xmlns:m="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Message/v1" xmlns:s="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Service/v1">
  <m:correlationID>market-info-version-floor</m:correlationID>
  <m:creationDateTime>2026-09-01T10:00:00+00:00</m:creationDateTime>
  <m:messageID>market-info-version-floor-message</m:messageID>
  <m:sender><m:service><s:serviceID>MARKET_INFO</s:serviceID><s:serviceOperation>PUT</s:serviceOperation></m:service></m:sender>
  <m:responseEntity>
    <m:entityCode>05050649085512</m:entityCode><m:responseCode>PROCESSED_WITH_ERRORS</m:responseCode>
    <m:report><m:elementReport><m:operationErrorDetail>versionNumber: EUDAMED's current version is 2.</m:operationErrorDetail></m:elementReport></m:report>
  </m:responseEntity>
</m:Acknowledgement>
"""

    result = TestingSuccessXmlService().record_success_xml(
        xml_bytes=xml_payload.encode("utf-8"),
        source_file_name="market-info-version-floor.xml",
    )

    assert result.error_entity_count == 1
    assert result.summary_message == "Recorded error Market Info PUT acknowledgement for LINX22L1S."
    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
        row = connection.execute(
            """
            SELECT latest_successful_market_info_version, latest_observed_market_info_version,
                   latest_successful_market_info_state_json
            FROM testing_subjects
            WHERE id = ?
            """,
            (subject_id,),
        ).fetchone()
        assert row is not None
        assert row["latest_successful_market_info_version"] == "1"
        assert row["latest_observed_market_info_version"] == "2"
        assert json.loads(str(row["latest_successful_market_info_state_json"])) == {
            "version": "1",
            "market_countries": [{"country": "DE", "original_placed_on_market": True}],
        }
    finally:
        connection.close()


def test_successful_market_info_acknowledgement_clears_later_patch_market_info_block(
    isolated_workbook_import_db: Path,
) -> None:
    PlaygroundStateStore()
    subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Linx",
        product_variant="Linx",
        catalogue_number="LINX22L1S",
        primary_udi_di="05050649085512",
        basic_udi_di="5050649LINX2G",
        post_success=1,
    )
    connection = sqlite3.connect(isolated_workbook_import_db)
    try:
        connection.execute(
            """
            INSERT INTO testing_events (subject_id, event_index, message_type, event_kind, status, raw_event_json)
            VALUES (?, 0, 'UDI_DI.PATCH', 'error_ack', 'ERROR', ?)
            """,
            (subject_id, json.dumps({"error": "Update of Market Information service"})),
        )
        connection.execute(
            """
            INSERT INTO testing_events (subject_id, event_index, message_type, event_kind, status, raw_event_json)
            VALUES (?, 1, 'MARKET_INFO.PUT', 'success_ack', 'SUCCESS', '{}')
            """,
            (subject_id,),
        )
        connection.commit()
    finally:
        connection.close()

    assert PlaygroundStateStore().has_pending_market_info_update_error(
        product_family="Linx",
        product_variant="Linx",
        catalogue_number="LINX22L1S",
    ) is False


def test_success_xml_upload_records_market_info_put_without_advancing_patch_version(
    isolated_workbook_import_db: Path,
) -> None:
    store = PlaygroundStateStore()
    subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L1S",
        primary_udi_di="05050649058189",
        basic_udi_di="5050649ESPRITVZ",
        post_success=1,
        latest_successful_version="3",
    )
    store.record_generated_market_info_context(
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L1S",
        primary_udi_di="05050649058189",
        basic_udi_di="5050649ESPRITVZ",
        market_info_version="2",
        baseline_market_countries=[
            {"country": "AT", "original_placed_on_market": False},
            {"country": "DE", "original_placed_on_market": True},
        ],
        market_countries=[
            {"country": "DE", "original_placed_on_market": True},
        ],
    )

    xml_payload = """<?xml version='1.0' encoding='utf-8'?>
<m:PullAck xmlns:m="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Message/v1" xmlns:s="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Service/v1">
  <m:correlationID>market-info-success-correlation</m:correlationID>
  <m:creationDateTime>2026-08-28T10:45:00+00:00</m:creationDateTime>
  <m:messageID>market-info-success-message</m:messageID>
  <m:sender>
    <m:node>
      <s:nodeActorCode>EUDAMED</s:nodeActorCode>
    </m:node>
    <m:service>
      <s:serviceID>MARKET_INFO</s:serviceID>
      <s:serviceOperation>PUT</s:serviceOperation>
    </m:service>
  </m:sender>
  <m:responseEntity>
    <m:responseCode>SUCCESS</m:responseCode>
    <m:entityCode>05050649058189</m:entityCode>
    <m:entityVersion>2</m:entityVersion>
  </m:responseEntity>
</m:PullAck>
"""

    result = TestingSuccessXmlService().record_success_xml(
        xml_bytes=xml_payload.encode("utf-8"),
        source_file_name="market-info-success.xml",
    )

    assert result.message_type == "MARKET_INFO.PUT"
    assert result.operation_label == "Market Info PUT"
    assert result.entity_count == 1
    assert result.recorded_event_count == 1
    assert result.duplicate_event_count == 0
    assert result.created_subject_count == 0
    assert result.duplicate_event is False

    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
        row = connection.execute(
            """
            SELECT
                id,
                catalogue_number,
                post_success,
                latest_successful_version,
                latest_successful_market_info_version,
                latest_successful_market_info_state_json
            FROM testing_subjects
            WHERE id = ?
            """,
            (subject_id,),
        ).fetchone()
        assert row is not None
        assert row["id"] == subject_id
        assert row["catalogue_number"] == "ESP22L1S"
        assert row["post_success"] == 1
        assert row["latest_successful_version"] == "3"
        assert row["latest_successful_market_info_version"] == "2"
        assert json.loads(str(row["latest_successful_market_info_state_json"])) == {
            "version": "2",
            "market_countries": [
                {"country": "DE", "original_placed_on_market": True},
            ],
        }
        event_row = connection.execute(
            """
            SELECT subject_id, event_index, message_type, status, version, raw_event_json
            FROM testing_events
            WHERE subject_id = ?
              AND status = 'SUCCESS'
            ORDER BY event_index
            DESC
            LIMIT 1
            """,
            (subject_id,),
        ).fetchone()
        assert event_row is not None
        assert event_row["subject_id"] == subject_id
        assert event_row["message_type"] == "MARKET_INFO.PUT"
        assert event_row["status"] == "SUCCESS"
        assert event_row["version"] == "2"
        event_payload = json.loads(str(event_row["raw_event_json"]))
        assert event_payload["market_info_delta"] == {
            "added_countries": [],
            "removed_countries": ["AT"],
            "original_market_before": "DE",
            "original_market_after": "DE",
        }
    finally:
        connection.close()


def test_duplicate_market_info_success_upload_repairs_tracked_state_from_generated_context(
    isolated_workbook_import_db: Path,
) -> None:
    store = PlaygroundStateStore()
    subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L1S",
        primary_udi_di="05050649058189",
        basic_udi_di="5050649ESPRITVZ",
        post_success=1,
        latest_successful_version="3",
        latest_successful_market_info_version="1",
    )
    store.record_generated_market_info_context(
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L1S",
        primary_udi_di="05050649058189",
        basic_udi_di="5050649ESPRITVZ",
        market_info_version="2",
        baseline_market_countries=[
            {"country": "AT", "original_placed_on_market": False},
            {"country": "DE", "original_placed_on_market": True},
        ],
        market_countries=[
            {"country": "DE", "original_placed_on_market": True},
        ],
    )

    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute(
            """
            INSERT INTO testing_events (
                subject_id,
                event_index,
                message_type,
                status,
                version,
                scenario_id,
                scenario_label,
                tested_at,
                transaction_id,
                submission_id,
                payload_created_at,
                correlation_id,
                message_id,
                changed_fields_json,
                retained_fields_json,
                unchanged_fields_json,
                raw_event_json
            ) VALUES (?, ?, 'MARKET_INFO.PUT', 'SUCCESS', NULL, NULL, NULL, ?, NULL, NULL, ?, ?, ?, NULL, NULL, NULL, ?)
            """,
            (
                subject_id,
                1,
                "2026-08-28T13:13:55.793+02:00",
                "2026-08-28T13:13:55.793+02:00",
                "cd4e1072-2016-4622-9261-1e8afecca573",
                "fa5bcd9b-dc9f-4bde-aca2-7d505cf22b4a",
                json.dumps(
                    {
                        "source_file_name": "APP-DTX-000111352.xml",
                        "message_type": "MARKET_INFO.PUT",
                        "operation_label": "Market Info PUT",
                        "entity_code": "05050649058189",
                        "entity_version": None,
                        "response_code": "SUCCESS",
                        "correlation_id": "cd4e1072-2016-4622-9261-1e8afecca573",
                        "message_id": "fa5bcd9b-dc9f-4bde-aca2-7d505cf22b4a",
                        "tested_at": "2026-08-28T13:13:55.793+02:00",
                        "xml": "<acknowledgement />",
                    }
                ),
            ),
        )
        connection.commit()
    finally:
        connection.close()

    xml_payload = """<?xml version='1.0' encoding='utf-8'?>
<m:PullAck xmlns:m="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Message/v1" xmlns:s="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Service/v1">
  <m:correlationID>cd4e1072-2016-4622-9261-1e8afecca573</m:correlationID>
  <m:creationDateTime>2026-08-28T13:13:55.793+02:00</m:creationDateTime>
  <m:messageID>fa5bcd9b-dc9f-4bde-aca2-7d505cf22b4a</m:messageID>
  <m:sender>
    <m:node>
      <s:nodeActorCode>EUDAMED</s:nodeActorCode>
    </m:node>
    <m:service>
      <s:serviceID>MARKET_INFO</s:serviceID>
      <s:serviceOperation>PUT</s:serviceOperation>
    </m:service>
  </m:sender>
  <m:responseEntity>
    <m:responseCode>SUCCESS</m:responseCode>
    <m:entityCode>05050649058189</m:entityCode>
  </m:responseEntity>
</m:PullAck>
"""

    result = TestingSuccessXmlService().record_success_xml(
        xml_bytes=xml_payload.encode("utf-8"),
        source_file_name="APP-DTX-000111352.xml",
    )

    assert result.message_type == "MARKET_INFO.PUT"
    assert result.recorded_event_count == 0
    assert result.duplicate_event_count == 1
    assert result.duplicate_event is True

    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
        row = connection.execute(
            """
            SELECT latest_successful_market_info_version, latest_successful_market_info_state_json
            FROM testing_subjects
            WHERE id = ?
            """,
            (subject_id,),
        ).fetchone()
        assert row is not None
        assert row["latest_successful_market_info_version"] == "2"
        assert json.loads(str(row["latest_successful_market_info_state_json"])) == {
            "version": "2",
            "market_countries": [
                {"country": "DE", "original_placed_on_market": True},
            ],
        }
    finally:
        connection.close()


def test_market_info_success_delta_uses_latest_accepted_subject_state_when_generated_baseline_is_stale(
    isolated_workbook_import_db: Path,
) -> None:
    store = PlaygroundStateStore()
    subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L1S",
        primary_udi_di="05050649058189",
        basic_udi_di="5050649ESPRITVZ",
        post_success=1,
        latest_successful_version="3",
        latest_successful_market_info_version="2",
    )
    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute(
            """
            UPDATE testing_subjects
            SET latest_successful_market_info_state_json = ?
            WHERE id = ?
            """,
            (
                json.dumps(
                    {
                        "version": "2",
                        "market_countries": [
                            {"country": "DE", "original_placed_on_market": True},
                        ],
                    }
                ),
                subject_id,
            ),
        )
        connection.commit()
    finally:
        connection.close()

    store.record_generated_market_info_context(
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L1S",
        primary_udi_di="05050649058189",
        basic_udi_di="5050649ESPRITVZ",
        market_info_version="3",
        baseline_market_countries=[
            {"country": "AT", "original_placed_on_market": False},
            {"country": "DE", "original_placed_on_market": True},
        ],
        market_countries=[
            {"country": "DE", "original_placed_on_market": True},
            {"country": "AT", "original_placed_on_market": False},
        ],
    )

    xml_payload = """<?xml version='1.0' encoding='utf-8'?>
<m:PullAck xmlns:m="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Message/v1" xmlns:s="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Service/v1">
  <m:correlationID>market-info-success-correlation-2</m:correlationID>
  <m:creationDateTime>2026-08-28T18:01:07.900+02:00</m:creationDateTime>
  <m:messageID>market-info-success-message-2</m:messageID>
  <m:sender>
    <m:node>
      <s:nodeActorCode>EUDAMED</s:nodeActorCode>
    </m:node>
    <m:service>
      <s:serviceID>MARKET_INFO</s:serviceID>
      <s:serviceOperation>PUT</s:serviceOperation>
    </m:service>
  </m:sender>
  <m:responseEntity>
    <m:responseCode>SUCCESS</m:responseCode>
    <m:entityCode>05050649058189</m:entityCode>
  </m:responseEntity>
</m:PullAck>
"""

    result = TestingSuccessXmlService().record_success_xml(
        xml_bytes=xml_payload.encode("utf-8"),
        source_file_name="market-info-success-2.xml",
    )

    assert result.message_type == "MARKET_INFO.PUT"
    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
        event_row = connection.execute(
            """
            SELECT version, raw_event_json
            FROM testing_events
            WHERE subject_id = ?
              AND status = 'SUCCESS'
            ORDER BY event_index DESC
            LIMIT 1
            """,
            (subject_id,),
        ).fetchone()
        assert event_row is not None
        assert event_row["version"] == "3"
        event_payload = json.loads(str(event_row["raw_event_json"]))
        assert event_payload["market_info_delta"] == {
            "added_countries": ["AT"],
            "removed_countries": [],
            "original_market_before": "DE",
            "original_market_after": "DE",
        }
    finally:
        connection.close()


def test_patch_success_matches_exact_generated_preview_and_generated_rows_are_append_only(
    isolated_workbook_import_db: Path,
) -> None:
    store = PlaygroundStateStore()
    subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L1S",
        primary_udi_di="05050649058189",
        basic_udi_di="5050649ESPRITVZ",
        post_success=1,
        latest_successful_version="1",
        latest_successful_state_json=json.dumps({"version": "1", "trade_name": "Baseline"}),
    )
    store.record_generated_patch_context(
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L1S",
        primary_udi_di="05050649058189",
        basic_udi_di="5050649ESPRITVZ",
        patch_version="2",
        scenario_id="trade_name_edit",
        scenario_label="Trade Name Edit",
        base_message_type="POST",
        base_version="1",
        accepted_state_source="accepted_post",
        changed_fields=[{"field": "trade_name", "before": "Baseline", "after": "Version 2"}],
        state_before={"version": "1", "trade_name": "Baseline"},
        latest_successful_state={"version": "2", "trade_name": "Version 2"},
        correlation_id="patch-correlation-v2",
        message_id="patch-message-v2",
    )
    store.record_generated_patch_context(
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L1S",
        primary_udi_di="05050649058189",
        basic_udi_di="5050649ESPRITVZ",
        patch_version="3",
        scenario_id="trade_name_edit",
        scenario_label="Trade Name Edit",
        base_message_type="PATCH",
        base_version="2",
        accepted_state_source="sqlite_latest_successful_patch",
        changed_fields=[{"field": "trade_name", "before": "Version 2", "after": "Version 3"}],
        state_before={"version": "2", "trade_name": "Version 2"},
        latest_successful_state={"version": "3", "trade_name": "Version 3"},
        correlation_id="patch-correlation-v3",
        message_id="patch-message-v3",
    )

    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
        generated_rows = connection.execute(
            """
            SELECT event_index, version, correlation_id, message_id
            FROM testing_events
            WHERE subject_id = ?
              AND message_type = 'UDI_DI.PATCH'
              AND status = 'GENERATED'
            ORDER BY event_index
            """,
            (subject_id,),
        ).fetchall()
        assert [(row["version"], row["correlation_id"], row["message_id"]) for row in generated_rows] == [
            ("2", "patch-correlation-v2", "patch-message-v2"),
            ("3", "patch-correlation-v3", "patch-message-v3"),
        ]
    finally:
        connection.close()
    xml_payload = """<?xml version='1.0' encoding='utf-8'?>
<m:PullAck xmlns:m="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Message/v1" xmlns:s="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Service/v1">
  <m:correlationID>patch-correlation-v2</m:correlationID>
  <m:creationDateTime>2026-08-31T11:00:00+00:00</m:creationDateTime>
  <m:messageID>patch-ack-message-v2</m:messageID>
  <m:sender>
    <m:node>
      <s:nodeActorCode>EUDAMED</s:nodeActorCode>
    </m:node>
    <m:service>
      <s:serviceID>UDI_DI</s:serviceID>
      <s:serviceOperation>PATCH</s:serviceOperation>
    </m:service>
  </m:sender>
  <m:responseEntity>
    <m:responseCode>SUCCESS</m:responseCode>
    <m:entityCode>05050649058189</m:entityCode>
  </m:responseEntity>
</m:PullAck>
"""

    TestingSuccessXmlService().record_success_xml(
        xml_bytes=xml_payload.encode("utf-8"),
        source_file_name="APP-DTX-PATCH-V2.xml",
    )

    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
        subject_row = connection.execute(
            """
            SELECT latest_successful_patch_version, latest_successful_patch_state_json, latest_successful_version
            FROM testing_subjects
            WHERE id = ?
            """,
            (subject_id,),
        ).fetchone()
        assert subject_row is not None
        assert subject_row["latest_successful_patch_version"] == "2"
        assert subject_row["latest_successful_version"] == "2"
        assert json.loads(str(subject_row["latest_successful_patch_state_json"])) == {
            "version": "2",
            "trade_name": "Version 2",
        }
    finally:
        connection.close()


def test_generated_package_logging_records_metadata_without_archive_content(
    isolated_workbook_import_db: Path,
) -> None:
    store = PlaygroundStateStore()
    manifest = {
        "mode": "bulk_udidi_post",
        "product_family": "Epirus",
        "product_variant": "Esprit",
        "basic_udi_di": "5050649ESPRITVZ",
    }
    store.record_generated_package(
        package_file_name="epirus-esprit-bulk-udidi-post-package.zip",
        flow="bulk_udidi_post",
        operation_scope="bulk",
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number=None,
        basic_udi_di="5050649ESPRITVZ",
        members=[("epirus-esprit-bulk-udidi-post-01-of-01.xml", b"<xml />"), ("excluded-records.json", b"[]")],
        manifest=manifest,
        package_bytes=b"zip-content",
    )

    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
        row = connection.execute(
            """
            SELECT flow, operation_scope, package_file_name, package_byte_count,
                   member_count, xml_member_count, member_file_names_json,
                   manifest_json, package_sha256
            FROM generated_packages
            """
        ).fetchone()
    finally:
        connection.close()

    assert row is not None
    assert dict(row) == {
        "flow": "bulk_udidi_post",
        "operation_scope": "bulk",
        "package_file_name": "epirus-esprit-bulk-udidi-post-package.zip",
        "package_byte_count": 11,
        "member_count": 2,
        "xml_member_count": 1,
        "member_file_names_json": json.dumps(
            ["epirus-esprit-bulk-udidi-post-01-of-01.xml", "excluded-records.json"]
        ),
        "manifest_json": json.dumps(manifest, sort_keys=True),
        "package_sha256": "daf4e16539491123bf4112eb538caad1692406c99e79aed45789f25452c22108",
    }


def test_patch_success_without_generated_context_still_advances_tracked_version(
    isolated_workbook_import_db: Path,
) -> None:
    PlaygroundStateStore()
    _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L1S",
        primary_udi_di="05050649058189",
        basic_udi_di="5050649ESPRITVZ",
        post_success=1,
        latest_successful_version="3",
        latest_successful_state_json=json.dumps({"version": "3", "trade_name": "Version 3"}),
    )

    xml_payload = """<?xml version='1.0' encoding='utf-8'?>
<m:PullAck xmlns:m="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Message/v1" xmlns:s="https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Service/v1">
  <m:correlationID>patch-correlation-v4</m:correlationID>
  <m:creationDateTime>2026-08-31T12:00:00+00:00</m:creationDateTime>
  <m:messageID>patch-message-v4</m:messageID>
  <m:sender>
    <m:node>
      <s:nodeActorCode>EUDAMED</s:nodeActorCode>
    </m:node>
    <m:service>
      <s:serviceID>UDI_DI</s:serviceID>
      <s:serviceOperation>PATCH</s:serviceOperation>
    </m:service>
  </m:sender>
  <m:responseEntity>
    <m:responseCode>SUCCESS</m:responseCode>
    <m:entityCode>05050649058189</m:entityCode>
    <m:entityVersion>4</m:entityVersion>
  </m:responseEntity>
</m:PullAck>
"""

    TestingSuccessXmlService().record_success_xml(
        xml_bytes=xml_payload.encode("utf-8"),
        source_file_name="APP-DTX-PATCH-V4.xml",
    )

    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
        subject_row = connection.execute(
            """
            SELECT latest_successful_patch_version, latest_successful_patch_state_json, latest_successful_version
            FROM testing_subjects
            WHERE normalized_primary_udi_di = '05050649058189'
            """,
        ).fetchone()
        assert subject_row is not None
        assert subject_row["latest_successful_patch_version"] == "4"
        assert subject_row["latest_successful_version"] == "4"
        assert subject_row["latest_successful_patch_state_json"] is None
    finally:
        connection.close()


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


def test_single_post_preview_records_generated_envelope_ids(
    isolated_workbook_import_db: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    PlaygroundStateStore()
    service = XmlGenerationService()
    monkeypatch.setattr(
        service.testing_state_store,
        "has_successful_basic_udi_post",
        lambda **kwargs: True,
    )

    preview = service.preview_post_registration(
        product_family="Elan",
        product_variant="Elan IC",
        catalogue_number="ELANIC22L1S",
    )

    connection = sqlite3.connect(isolated_workbook_import_db)
    connection.row_factory = sqlite3.Row
    try:
        generated_row = connection.execute(
            """
            SELECT correlation_id, message_id, raw_event_json
            FROM testing_events
            WHERE catalogue_number = 'ELANIC22L1S'
              AND message_type = 'UDI_DI.POST'
              AND status = 'GENERATED'
            ORDER BY event_index DESC
            LIMIT 1
            """
        ).fetchone()
    finally:
        connection.close()

    assert generated_row is not None
    correlation_id = str(generated_row["correlation_id"])
    message_id = str(generated_row["message_id"])
    assert correlation_id
    assert message_id
    assert f"<m:correlationID>{correlation_id}</m:correlationID>" in preview.post_xml
    assert f"<m:messageID>{message_id}</m:messageID>" in preview.post_xml

    event_payload = json.loads(str(generated_row["raw_event_json"]))
    assert event_payload["correlation_id"] == correlation_id
    assert event_payload["message_id"] == message_id


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
        connection.execute("DELETE FROM testing_events")
        connection.execute("DELETE FROM testing_subjects")
        connection.execute("DELETE FROM reviewed_post_baselines")
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
    sqlite_route_bundle = canonical_validation()

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


def test_xml_generation_scope_requires_sqlite_import_for_testing_paths(
    isolated_workbook_import_env: tuple[Path, Path],
) -> None:
    _db_path, _excel_dir = isolated_workbook_import_env

    with pytest.raises(HTTPException) as exc_info:
        xml_generation_scope()

    assert exc_info.value.status_code == 400 or exc_info.value.status_code == 404
    assert "Import workbooks before loading canonical validation" in str(exc_info.value.detail)


def test_testing_read_model_service_returns_workspace_summary_and_subject_history(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
    import_service = WorkbookImportService()
    import_service.run_import(imported_by="pytest", label="Import One")

    connection = sqlite3.connect(db_path)
    try:
        subject_id = int(
            connection.execute(
                """
                INSERT INTO testing_subjects (
                    subject_key,
                    device_subject_id,
                    normalized_product_family,
                    normalized_product_variant,
                    normalized_catalogue_number,
                    normalized_primary_udi_di,
                    normalized_basic_udi_di,
                    product_family,
                    product_variant,
                    catalogue_number,
                    primary_udi_di,
                    basic_udi_di,
                    post_success,
                    baseline_patch_success,
                    latest_successful_version,
                    latest_successful_state_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "family-a|variant-a|cat-001",
                    1,
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
                    1,
                    1,
                    "2",
                    json.dumps({"version": "2", "trade_name": "Synthetic Trade Name"}),
                ),
            ).lastrowid
        )
        connection.execute(
            """
            INSERT INTO testing_events (
                subject_id,
                event_index,
                message_type,
                status,
                version,
                scenario_id,
                scenario_label,
                tested_at,
                transaction_id,
                submission_id,
                correlation_id,
                message_id,
                changed_fields_json,
                retained_fields_json,
                unchanged_fields_json,
                raw_event_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                subject_id,
                0,
                "DEVICE.POST",
                "SUCCESS",
                "1",
                None,
                "Baseline POST",
                "2026-08-14T09:00:00Z",
                "txn-1",
                "sub-1",
                "corr-1",
                "msg-1",
                json.dumps([]),
                json.dumps([]),
                json.dumps([]),
                json.dumps({"message_type": "DEVICE.POST", "status": "SUCCESS"}),
            ),
        )
        connection.execute(
            """
            INSERT INTO testing_events (
                subject_id,
                event_index,
                message_type,
                status,
                version,
                scenario_id,
                scenario_label,
                tested_at,
                transaction_id,
                submission_id,
                correlation_id,
                message_id,
                changed_fields_json,
                retained_fields_json,
                unchanged_fields_json,
                raw_event_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                subject_id,
                1,
                "UDI_DI.PATCH",
                "SUCCESS",
                "2",
                "equivalent_first_patch",
                "Equivalent First Patch",
                "2026-08-15T09:00:00Z",
                "txn-2",
                "sub-2",
                "corr-2",
                "msg-2",
                json.dumps(["trade_name"]),
                json.dumps(["manufacturer"]),
                json.dumps(["catalogue_number"]),
                json.dumps({"message_type": "UDI_DI.PATCH", "status": "SUCCESS"}),
            ),
        )
        connection.execute(
            """
            INSERT INTO reviewed_post_baselines (
                device_subject_id,
                normalized_product_family,
                normalized_product_variant,
                normalized_catalogue_number,
                product_family,
                product_variant,
                catalogue_number,
                reviewed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (1, "familya", "varianta", "cat-001", "Family A", "Variant A", "CAT-001", "2026-08-14T08:00:00Z"),
        )
        connection.commit()
    finally:
        connection.close()

    read_model_service = TestingReadModelService()
    workspace_summary = read_model_service.workspace_summary(
        product_family="Family A",
        product_variant="Variant A",
    )
    subject_summaries = read_model_service.list_subject_summaries(
        product_family="Family A",
        product_variant="Variant A",
    )
    subject_history = read_model_service.subject_history(subject_id)

    assert workspace_summary.subject_count == 1
    assert workspace_summary.linked_device_subject_count == 1
    assert workspace_summary.reviewed_post_count == 1
    assert workspace_summary.successful_device_post_count == 1
    assert workspace_summary.successful_patch_count == 1
    assert workspace_summary.posted_parent_group_count == 1
    assert workspace_summary.latest_tested_at == "2026-08-15T09:00:00Z"

    assert len(subject_summaries) == 1
    assert subject_summaries[0].catalogue_number == "CAT-001"
    assert subject_summaries[0].reviewed_post_at == "2026-08-14T08:00:00Z"
    assert subject_summaries[0].event_count == 2

    assert subject_history is not None
    assert subject_history.subject.catalogue_number == "CAT-001"
    assert [event.message_type for event in subject_history.events] == ["DEVICE.POST", "UDI_DI.PATCH"]
    assert subject_history.events[1].changed_fields == ["trade_name"]


def test_testing_read_model_routes_return_summary_subjects_and_history(
    isolated_workbook_import_env: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db_path, _excel_dir = isolated_workbook_import_env
    _apply_synthetic_import_stubs(monkeypatch)
    import_service = WorkbookImportService()
    import_service.run_import(imported_by="pytest", label="Import One")

    connection = sqlite3.connect(db_path)
    try:
        connection.execute("DELETE FROM testing_events")
        connection.execute("DELETE FROM testing_subjects")
        connection.execute("DELETE FROM reviewed_post_baselines")
        subject_id = int(
            connection.execute(
                """
                INSERT INTO testing_subjects (
                    subject_key,
                    device_subject_id,
                    normalized_product_family,
                    normalized_product_variant,
                    normalized_catalogue_number,
                    normalized_primary_udi_di,
                    normalized_basic_udi_di,
                    product_family,
                    product_variant,
                    catalogue_number,
                    primary_udi_di,
                    basic_udi_di,
                    post_success,
                    baseline_patch_success,
                    latest_successful_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "family-a|variant-a|cat-001",
                    1,
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
                    1,
                    1,
                    "2",
                ),
            ).lastrowid
        )
        connection.execute(
            """
            INSERT INTO testing_events (
                subject_id,
                event_index,
                message_type,
                status,
                version,
                scenario_id,
                scenario_label,
                tested_at,
                raw_event_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                subject_id,
                0,
                "DEVICE.POST",
                "SUCCESS",
                "1",
                None,
                "Baseline POST",
                "2026-08-14T09:00:00Z",
                json.dumps({"message_type": "DEVICE.POST", "status": "SUCCESS"}),
            ),
        )
        connection.execute(
            """
            INSERT INTO reviewed_post_baselines (
                device_subject_id,
                normalized_product_family,
                normalized_product_variant,
                normalized_catalogue_number,
                product_family,
                product_variant,
                catalogue_number,
                reviewed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (1, "familya", "varianta", "cat-001", "Family A", "Variant A", "CAT-001", "2026-08-14T08:00:00Z"),
        )
        connection.commit()
    finally:
        connection.close()

    summary_payload = xml_testing_workspace_summary(
        {"product_family": "Family A", "product_variant": "Variant A"},
    )
    subjects_payload = xml_testing_subject_summaries(
        {"product_family": "Family A", "product_variant": "Variant A", "limit": 50},
    )
    history_payload = xml_testing_subject_history(subject_id)

    assert summary_payload["subject_count"] == 1
    assert summary_payload["reviewed_post_count"] == 1
    assert summary_payload["successful_device_post_count"] == 1
    assert len(subjects_payload) == 1
    assert subjects_payload[0]["catalogue_number"] == "CAT-001"
    assert history_payload["subject"]["catalogue_number"] == "CAT-001"
    assert history_payload["events"][0]["message_type"] == "DEVICE.POST"


def test_operation_assessment_routes_report_single_post_and_bulk_post_availability(
    isolated_workbook_import_db: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    PlaygroundStateStore()
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
            "catalogue_number": "CAT-002",
            "primary_udi_di": "222222",
            "submission_operation": "POST",
            "basic_udi_di": "BASIC-1",
            "canonical_status": "xml_ready",
        },
    }
    monkeypatch.setattr(
        XmlGenerationService,
        "_validation_bundle",
        lambda self: _synthetic_validation_bundle_from_promotions(promotions, row_count=2),
    )

    single_payload = assess_single_post({"product_family": "Family A", "product_variant": "Variant A"})
    bulk_payload = assess_bulk_post({"product_family": "Family A", "product_variant": "Variant A"})

    assert single_payload["operation_type"] == "single_post"
    assert single_payload["status"] == "available"
    assert single_payload["evidence"]["candidate_basic_udi_di"] == "BASIC-1"
    assert single_payload["evidence"]["parent_registration_known"] is False
    assert bulk_payload["operation_type"] == "bulk_post"
    assert bulk_payload["status"] == "available"
    assert bulk_payload["evidence"]["eligible_parent_group_count"] == 1
    assert bulk_payload["evidence"]["eligible_child_record_count"] == 0


def test_operation_assessment_accepts_grouped_family_labels_for_registered_post_state(
    isolated_workbook_import_db: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    PlaygroundStateStore()
    promotions = {
        ("synthetic.xlsx", "Esprit", 2): {
            "product_family": "Epirus / Esprit",
            "product_variant": "Esprit",
            "catalogue_number": "ESP22L1S",
            "primary_udi_di": "05050649058189",
            "submission_operation": "POST",
            "basic_udi_di": "5050649ESPRITVZ",
            "canonical_status": "xml_ready",
        }
    }
    monkeypatch.setattr(
        XmlGenerationService,
        "_validation_bundle",
        lambda self: _synthetic_validation_bundle_from_promotions(promotions),
    )
    monkeypatch.setattr(
        XmlGenerationService,
        "_market_info_record_with_latest_state",
        lambda self, *, record: (
            SimpleNamespace(market_countries=[("GB", True), ("IE", False)]),
            [("GB", True)],
            "2",
        ),
    )
    monkeypatch.setattr(
        XmlGenerationService,
        "_market_info_record_with_latest_state",
        lambda self, *, record: (
            SimpleNamespace(market_countries=[("GB", True), ("IE", False)]),
            [("GB", True)],
            "2",
        ),
    )
    subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Epirus",
        product_variant="Esprit",
        catalogue_number="ESP22L1S",
        primary_udi_di="05050649058189",
        basic_udi_di="5050649ESPRITVZ",
        post_success=1,
        latest_successful_version="2",
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=subject_id,
        event_index=0,
        message_type="DEVICE.POST",
        status="SUCCESS",
        version="1",
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=subject_id,
        event_index=1,
        message_type="UDI_DI.PATCH",
        status="SUCCESS",
        version="2",
    )

    payload = assess_single_post({"product_family": "Epirus / Esprit", "product_variant": "Esprit"})

    assert payload["operation_type"] == "single_post"
    assert payload["status"] == "blocked"
    assert payload["summary_message"] == (
        "The Basic UDI-DI is already registered and no further Device UDI-DI POST candidates are currently "
        "available for this family and variant."
    )
    assert payload["evidence"]["parent_registration_known"] is True
    assert payload["evidence"]["child_registration_known"] is True


def test_operation_assessment_routes_report_single_patch_availability_from_sqlite_state(
    isolated_workbook_import_db: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    PlaygroundStateStore()
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
    monkeypatch.setattr(
        XmlGenerationService,
        "_validation_bundle",
        lambda self: _synthetic_validation_bundle_from_promotions(promotions),
    )
    monkeypatch.setattr(
        XmlGenerationService,
        "_market_info_record_with_latest_state",
        lambda self, *, record: (
            SimpleNamespace(market_countries=[("GB", True), ("IE", False)]),
            [("GB", True)],
            "2",
        ),
    )
    subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-001",
        primary_udi_di="111111",
        basic_udi_di="BASIC-1",
        post_success=1,
        latest_successful_version="1",
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=subject_id,
        event_index=1,
        message_type="UDI_DI.POST",
        status="SUCCESS",
        version="1",
    )
    _insert_reviewed_post_baseline(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-001",
    )

    payload = assess_single_patch(
        {
            "product_family": "Family A",
            "product_variant": "Variant A",
            "catalogue_number": "CAT-001",
        }
    )

    assert payload["operation_type"] == "single_patch"
    assert payload["status"] == "available"
    assert payload["eligible_record_count"] == 1
    assert payload["evidence"]["reviewed_post_baseline_present"] is True
    assert payload["evidence"]["tracked_registration_known"] is True
    assert payload["evidence"]["latest_accepted_version"] == "1"


def test_operation_assessment_routes_report_single_patch_availability_without_reviewed_baseline(
    isolated_workbook_import_db: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    PlaygroundStateStore()
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
    monkeypatch.setattr(
        XmlGenerationService,
        "_validation_bundle",
        lambda self: _synthetic_validation_bundle_from_promotions(promotions),
    )
    subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-001",
        primary_udi_di="111111",
        basic_udi_di="BASIC-1",
        post_success=1,
        latest_successful_version="1",
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=subject_id,
        event_index=1,
        message_type="UDI_DI.POST",
        status="SUCCESS",
        version="1",
    )

    payload = assess_single_patch(
        {
            "product_family": "Family A",
            "product_variant": "Variant A",
            "catalogue_number": "CAT-001",
        }
    )

    assert payload["operation_type"] == "single_patch"
    assert payload["status"] == "available"
    assert payload["eligible_record_count"] == 1
    assert payload["evidence"]["reviewed_post_baseline_present"] is False
    assert payload["evidence"]["tracked_registration_known"] is True
    assert payload["evidence"]["latest_accepted_version"] == "1"


def test_operation_assessment_routes_report_single_market_info_availability_from_sqlite_state(
    isolated_workbook_import_db: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    PlaygroundStateStore()
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
    monkeypatch.setattr(
        XmlGenerationService,
        "_validation_bundle",
        lambda self: _synthetic_validation_bundle_from_promotions(promotions),
    )
    monkeypatch.setattr(
        XmlGenerationService,
        "_market_info_record_with_latest_state",
        lambda self, *, record: (
            SimpleNamespace(market_countries=[("GB", True), ("IE", False)]),
            [("GB", True)],
            "2",
        ),
    )
    subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-001",
        primary_udi_di="111111",
        basic_udi_di="BASIC-1",
        post_success=1,
        latest_successful_version="1",
        latest_successful_market_info_version="2",
        latest_successful_market_info_state_json=json.dumps(
            {
                "version": "2",
                "market_countries": [
                    {"country": "GB", "original_placed_on_market": True},
                    {"country": "IE", "original_placed_on_market": False},
                ],
            }
        ),
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=subject_id,
        event_index=0,
        message_type="UDI_DI.POST",
        status="SUCCESS",
        version="1",
    )

    payload = assess_single_market_info(
        {
            "product_family": "Family A",
            "product_variant": "Variant A",
            "catalogue_number": "CAT-001",
        }
    )

    assert payload["operation_type"] == "single_market_info"
    assert payload["status"] == "available"
    assert payload["eligible_record_count"] == 1
    assert payload["evidence"]["tracked_registration_known"] is True
    assert payload["evidence"]["current_market_info_version"] == "2"
    assert payload["evidence"]["current_market_country_count"] == 2
    assert payload["evidence"]["accepted_state_source"] == "sqlite_latest_successful_market_info"


def test_operation_assessment_routes_report_single_market_info_blocked_without_tracked_registration(
    isolated_workbook_import_db: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    PlaygroundStateStore()
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
    monkeypatch.setattr(
        XmlGenerationService,
        "_validation_bundle",
        lambda self: _synthetic_validation_bundle_from_promotions(promotions),
    )

    payload = assess_single_market_info(
        {
            "product_family": "Family A",
            "product_variant": "Variant A",
            "catalogue_number": "CAT-001",
        }
    )

    assert payload["operation_type"] == "single_market_info"
    assert payload["status"] == "blocked"
    assert payload["evidence"]["tracked_registration_known"] is False


def test_single_patch_prefers_unpatched_available_device_before_higher_patch_version(
    isolated_workbook_import_db: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    PlaygroundStateStore()
    base_bundle = _synthetic_validation_bundle_from_promotions(
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
        }
    )
    first_record = base_bundle.records[0]
    second_record = first_record.model_copy(
        update={
            "catalogue_number": "CAT-002",
            "primary_udi_di": "222222",
        }
    )
    third_record = first_record.model_copy(
        update={
            "catalogue_number": "CAT-003",
            "primary_udi_di": "333333",
        }
    )
    monkeypatch.setattr(
        XmlGenerationService,
        "_variant_post_records_with_exclusions",
        lambda self, **kwargs: ([first_record, second_record, third_record], [], 3),
    )

    first_subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-001",
        primary_udi_di="111111",
        basic_udi_di="BASIC-1",
        post_success=1,
        baseline_patch_success=1,
        latest_successful_version="3",
        latest_successful_state_json=json.dumps({"version": 3}),
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=first_subject_id,
        event_index=0,
        message_type="DEVICE.POST",
        status="SUCCESS",
        version="1",
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=first_subject_id,
        event_index=1,
        message_type="UDI_DI.PATCH",
        status="SUCCESS",
        version="3",
    )
    _insert_reviewed_post_baseline(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-001",
    )

    second_subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-002",
        primary_udi_di="222222",
        basic_udi_di="BASIC-1",
        post_success=1,
        latest_successful_version="1",
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=second_subject_id,
        event_index=0,
        message_type="UDI_DI.POST",
        status="SUCCESS",
        version="1",
    )
    _insert_reviewed_post_baseline(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-002",
    )

    third_subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-003",
        primary_udi_di="333333",
        basic_udi_di="BASIC-1",
        post_success=1,
        latest_successful_version="1",
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=third_subject_id,
        event_index=0,
        message_type="UDI_DI.POST",
        status="SUCCESS",
        version="1",
    )
    _insert_reviewed_post_baseline(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-003",
    )

    payload = assess_single_patch(
        {
            "product_family": "Family A",
            "product_variant": "Variant A",
        }
    )

    assert payload["operation_type"] == "single_patch"
    assert payload["status"] == "available"
    assert payload["identity_scope"]["catalogue_number"] == "CAT-002"
    assert payload["evidence"]["latest_accepted_version"] == "1"


def test_operation_assessment_accepts_family_alias_for_single_post(
    isolated_workbook_import_db: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    PlaygroundStateStore()
    promotions = {
        ("synthetic.xlsx", "Esprit", 2): {
            "product_family": "Epirus / Esprit",
            "product_variant": "Esprit",
            "catalogue_number": "ESP22L2S",
            "primary_udi_di": "05050649058202",
            "submission_operation": "POST",
            "basic_udi_di": "5050649ESPRITVZ",
            "canonical_status": "xml_ready",
        }
    }
    monkeypatch.setattr(
        XmlGenerationService,
        "_validation_bundle",
        lambda self: _synthetic_validation_bundle_from_promotions(promotions),
    )

    payload = assess_single_post({"product_family": "Epirus", "product_variant": "Esprit"})

    assert payload["operation_type"] == "single_post"
    assert payload["status"] == "available"
    assert payload["identity_scope"]["catalogue_number"] == "ESP22L2S"
    assert payload["evidence"]["candidate_catalogue_number"] == "ESP22L2S"


def test_operation_assessment_reports_registered_parent_without_further_child_post_candidates(
    isolated_workbook_import_db: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    PlaygroundStateStore()
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
    monkeypatch.setattr(
        XmlGenerationService,
        "_validation_bundle",
        lambda self: _synthetic_validation_bundle_from_promotions(promotions),
    )
    subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-001",
        primary_udi_di="111111",
        basic_udi_di="BASIC-1",
        post_success=1,
        latest_successful_version="1",
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=subject_id,
        event_index=0,
        message_type="DEVICE.POST",
        status="SUCCESS",
        version="1",
    )

    payload = assess_single_post({"product_family": "Family A", "product_variant": "Variant A"})

    assert payload["operation_type"] == "single_post"
    assert payload["status"] == "blocked"
    assert payload["summary_message"] == (
        "The Basic UDI-DI is already registered and no further Device UDI-DI POST candidates are currently "
        "available for this family and variant."
    )
    assert payload["evidence"]["parent_registration_known"] is True
    assert payload["evidence"]["child_registration_known"] is True


def test_operation_assessment_routes_report_bulk_patch_parent_selection_and_availability(
    isolated_workbook_import_db: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    PlaygroundStateStore()
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
    monkeypatch.setattr(
        XmlGenerationService,
        "_validation_bundle",
        lambda self: _synthetic_validation_bundle_from_promotions(promotions),
    )
    subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-001",
        primary_udi_di="111111",
        basic_udi_di="BASIC-1",
        post_success=1,
        baseline_patch_success=1,
        latest_successful_version="2",
        latest_successful_state_json=json.dumps({"version": "2", "trade_name": "Synthetic Trade Name"}),
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=subject_id,
        event_index=1,
        message_type="DEVICE.POST",
        status="SUCCESS",
        version="1",
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=subject_id,
        event_index=2,
        message_type="UDI_DI.POST",
        status="SUCCESS",
        version="1",
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=subject_id,
        event_index=3,
        message_type="UDI_DI.PATCH",
        status="SUCCESS",
        version="2",
        scenario_id="equivalent_first_patch",
    )

    parent_selection_payload = assess_bulk_patch({"product_family": "Family A", "product_variant": "Variant A"})
    selected_payload = assess_bulk_patch(
        {
            "product_family": "Family A",
            "product_variant": "Variant A",
            "basic_udi_di": "BASIC-1",
        }
    )

    assert parent_selection_payload["operation_type"] == "bulk_patch"
    assert parent_selection_payload["status"] == "attention"
    assert parent_selection_payload["evidence"]["eligible_parent_group_count"] == 1
    assert selected_payload["operation_type"] == "bulk_patch"
    assert selected_payload["status"] == "available"
    assert selected_payload["eligible_record_count"] == 1
    assert selected_payload["evidence"]["selected_basic_udi_di"] == "BASIC-1"
    assert selected_payload["evidence"]["latest_version_summary"] == ["2"]


def test_operation_assessment_routes_report_bulk_market_info_parent_selection_and_partial_availability(
    isolated_workbook_import_db: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    PlaygroundStateStore()
    base_bundle = _synthetic_validation_bundle_from_promotions(
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
        }
    )
    first_record = base_bundle.records[0]
    second_record = first_record.model_copy(
        update={
            "catalogue_number": "CAT-002",
            "primary_udi_di": "222222",
        }
    )
    monkeypatch.setattr(
        XmlGenerationService,
        "_bulk_patch_selected_records",
        lambda self, **kwargs: ([first_record, second_record], 2, []),
    )
    monkeypatch.setattr(
        XmlGenerationService,
        "_market_info_record_with_latest_state",
        lambda self, *, record: (
            SimpleNamespace(
                market_countries=[("GB", True)] if record.catalogue_number == "CAT-001" else [("DE", True)]
            ),
            [("GB", True)],
            "1" if record.catalogue_number == "CAT-001" else "2",
        ),
    )

    first_subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-001",
        primary_udi_di="111111",
        basic_udi_di="BASIC-1",
        post_success=1,
        latest_successful_version="1",
        latest_successful_market_info_version="1",
        latest_successful_market_info_state_json=json.dumps(
            {
                "version": "1",
                "market_countries": [
                    {"country": "GB", "original_placed_on_market": True},
                ],
            }
        ),
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=first_subject_id,
        event_index=0,
        message_type="UDI_DI.POST",
        status="SUCCESS",
        version="1",
    )

    second_subject_id = _insert_testing_subject(
        isolated_workbook_import_db,
        product_family="Family A",
        product_variant="Variant A",
        catalogue_number="CAT-002",
        primary_udi_di="222222",
        basic_udi_di="BASIC-1",
        post_success=1,
        latest_successful_version="1",
        latest_successful_market_info_version="2",
        latest_successful_market_info_state_json=json.dumps(
            {
                "version": "2",
                "market_countries": [
                    {"country": "DE", "original_placed_on_market": True},
                ],
            }
        ),
    )
    _insert_testing_event(
        isolated_workbook_import_db,
        subject_id=second_subject_id,
        event_index=0,
        message_type="UDI_DI.POST",
        status="SUCCESS",
        version="1",
    )

    parent_selection_payload = assess_bulk_market_info({"product_family": "Family A", "product_variant": "Variant A"})
    selected_payload = assess_bulk_market_info(
        {
            "product_family": "Family A",
            "product_variant": "Variant A",
            "basic_udi_di": "BASIC-1",
        }
    )

    assert parent_selection_payload["operation_type"] == "bulk_market_info"
    assert parent_selection_payload["status"] == "attention"
    assert parent_selection_payload["evidence"]["eligible_parent_group_count"] == 1
    assert selected_payload["operation_type"] == "bulk_market_info"
    assert selected_payload["status"] == "attention"
    assert selected_payload["eligible_record_count"] == 1
    assert selected_payload["evidence"]["selected_basic_udi_di"] == "BASIC-1"
    assert selected_payload["evidence"]["market_info_state_mismatch_count"] == 1
    assert selected_payload["evidence"]["current_market_info_version_summary"] == ["1"]


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

    sqlite_route_bundle = canonical_validation()

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
        canonical_validation()

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
