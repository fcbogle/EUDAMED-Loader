from __future__ import annotations

import os
import sys
from pathlib import Path
import json
import sqlite3

BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest
import yaml

from app.config import get_settings
from app.services.testing_state_store import TestingStateStore


@pytest.fixture(autouse=True)
def clear_reviewed_post_state() -> None:
    TestingStateStore.clear_reviewed_posts()
    yield
    TestingStateStore.clear_reviewed_posts()


@pytest.fixture(scope="session", autouse=True)
def reset_testing_state_database(tmp_path_factory: pytest.TempPathFactory) -> None:
    session_tmp = tmp_path_factory.mktemp("session-testing-state")
    os.environ["EUDAMED_TESTING_STATE_DB_PATH"] = str(session_tmp / "testing-state.sqlite3")
    os.environ["EUDAMED_TESTING_STATE_BACKUP_DIR"] = str(session_tmp / "backups")
    get_settings.cache_clear()
    settings = get_settings()
    if settings.testing_state_db_path.exists():
        settings.testing_state_db_path.unlink()
    TestingStateStore()
    _seed_testing_state_database_from_yaml(
        db_path=settings.testing_state_db_path,
        yaml_path=BACKEND_ROOT.parent / "data" / "testing" / "playground-tested-subjects.yaml",
    )
    yield
    get_settings.cache_clear()


def _seed_testing_state_database_from_yaml(*, db_path: Path, yaml_path: Path) -> None:
    if not yaml_path.exists():
        return
    payload = yaml.safe_load(yaml_path.read_text()) or {}
    subjects = payload.get("tested_subjects") or []
    if not isinstance(subjects, list):
        return

    connection = sqlite3.connect(db_path)
    try:
        for subject in subjects:
            if not isinstance(subject, dict):
                continue
            source_reference = subject.get("source_reference") if isinstance(subject.get("source_reference"), dict) else None
            playground_status = subject.get("playground_status") if isinstance(subject.get("playground_status"), dict) else None
            latest_state = subject.get("latest_successful_state") if isinstance(subject.get("latest_successful_state"), dict) else None
            subject_cursor = connection.execute(
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
                    source_workbook,
                    source_sheet,
                    source_row_index,
                    post_success,
                    baseline_patch_success,
                    exclude_from_post_wave,
                    exclude_from_baseline_patch_wave,
                    latest_successful_version,
                    latest_successful_state_json
                ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    _optional_string(subject.get("subject_id"))
                    or "|".join(
                        filter(
                            None,
                            [
                                _normalize_identity(subject.get("product_family")),
                                _normalize_identity(subject.get("product_variant")),
                                _normalize_identity(subject.get("catalogue_number")),
                            ],
                        )
                    ),
                    _normalize_identity(subject.get("product_family")),
                    _normalize_identity(subject.get("product_variant")),
                    _normalize_identity(subject.get("catalogue_number")),
                    _normalize_identity(subject.get("primary_udi_di")) or None,
                    _normalize_identity(subject.get("basic_udi_di")) or None,
                    _optional_string(subject.get("product_family")),
                    _optional_string(subject.get("product_variant")),
                    _optional_string(subject.get("catalogue_number")),
                    _optional_string(subject.get("primary_udi_di")),
                    _optional_string(subject.get("basic_udi_di")),
                    _optional_string(source_reference.get("workbook")) if source_reference else None,
                    _optional_string(source_reference.get("sheet")) if source_reference else None,
                    _optional_int(source_reference.get("row_index")) if source_reference else None,
                    int(bool(playground_status.get("post_success"))) if playground_status else 0,
                    int(bool(playground_status.get("baseline_patch_success"))) if playground_status else 0,
                    int(bool(playground_status.get("exclude_from_post_wave"))) if playground_status else 0,
                    int(bool(playground_status.get("exclude_from_baseline_patch_wave"))) if playground_status else 0,
                    _optional_string(latest_state.get("version")) if latest_state else None,
                    json.dumps(latest_state) if latest_state else None,
                ),
            )
            subject_id = int(subject_cursor.lastrowid)
            test_events = subject.get("test_events")
            if not isinstance(test_events, list):
                continue
            for event_index, event in enumerate(test_events):
                if not isinstance(event, dict):
                    continue
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
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        subject_id,
                        event_index,
                        _optional_string(event.get("message_type")),
                        _optional_string(event.get("status")),
                        _optional_string(event.get("version")),
                        _optional_string(event.get("scenario_id")),
                        _optional_string(event.get("scenario_label")),
                        _optional_string(event.get("tested_at")),
                        _optional_string(event.get("transaction_id")),
                        _optional_string(event.get("submission_id")),
                        _optional_string(event.get("payload_created_at")),
                        _optional_string(event.get("correlation_id")),
                        _optional_string(event.get("message_id")),
                        json.dumps(event.get("changed_fields")) if isinstance(event.get("changed_fields"), list) else None,
                        json.dumps(event.get("retained_fields")) if isinstance(event.get("retained_fields"), list) else None,
                        json.dumps(event.get("unchanged_fields")) if isinstance(event.get("unchanged_fields"), list) else None,
                        json.dumps(event),
                    ),
                )
        connection.commit()
    finally:
        connection.close()


def _optional_string(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return str(value)
    normalized = value.strip()
    return normalized or None


def _normalize_identity(value: object) -> str:
    text = _optional_string(value)
    if not text:
        return ""
    return "".join(text.casefold().split())


def _optional_int(value: object) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None
