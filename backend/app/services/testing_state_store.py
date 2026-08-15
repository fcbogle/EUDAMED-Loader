from __future__ import annotations

from dataclasses import dataclass
import json
import sqlite3
from typing import Any, cast

import yaml

from app.config import get_settings
from app.xml_models import CriticalWarningXmlItem, PatchStateSnapshot, StorageConditionXmlItem


@dataclass(frozen=True)
class PatchStateResolution:
    source: str
    state: PatchStateSnapshot
    scenario_id: str | None = None


class TestingStateStore:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._ensure_database()

    @property
    def yaml_path(self):
        return self.settings.schema_dir.parents[1] / "data" / "testing" / "playground-tested-subjects.yaml"

    @property
    def db_path(self):
        return self.settings.testing_state_db_path

    def latest_successful_patch_state(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> PatchStateResolution | None:
        row = self._subject_row(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        if row is None or not row["latest_successful_state_json"]:
            return None
        latest_state = json.loads(str(row["latest_successful_state_json"]))
        if not isinstance(latest_state, dict):
            return None
        version = str(latest_state.get("version") or "").strip()
        if not version:
            return None
        return PatchStateResolution(
            source="yaml_latest_successful_patch",
            state=PatchStateSnapshot(
                version=version,
                trade_name=self._optional_string(latest_state.get("trade_name")),
                base_quantity=self._optional_int(latest_state.get("base_quantity")),
                sterile=self._optional_bool(latest_state.get("sterile")),
                contains_latex=self._optional_bool(latest_state.get("contains_latex")),
                status_code=self._optional_string(latest_state.get("status_code")),
                storage_conditions=self._storage_conditions(latest_state.get("storage_conditions")),
                critical_warnings=self._critical_warnings(latest_state.get("critical_warnings")),
            ),
            scenario_id=self._latest_successful_patch_scenario_id(int(row["id"])),
        )

    def posted_entries(
        self,
        *,
        product_family: str,
        product_variant: str,
        basic_udi_di: str,
    ) -> list[dict[str, object]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT catalogue_number, primary_udi_di, basic_udi_di, latest_successful_version, baseline_patch_success
                FROM testing_subjects
                WHERE normalized_product_family = ?
                  AND normalized_product_variant = ?
                  AND normalized_basic_udi_di = ?
                  AND post_success = 1
                  AND EXISTS (
                      SELECT 1
                      FROM testing_events event
                      WHERE event.subject_id = testing_subjects.id
                        AND event.status = 'SUCCESS'
                        AND event.message_type IN ('UDI_DI.POST', 'UDI_DI.PATCH')
                  )
                ORDER BY id
                """,
                (
                    self._normalize_identity(product_family),
                    self._normalize_identity(product_variant),
                    self._normalize_identity(basic_udi_di),
                ),
            ).fetchall()
        return [
            {
                "catalogue_number": self._optional_string(row["catalogue_number"]),
                "primary_udi_di": self._optional_string(row["primary_udi_di"]),
                "basic_udi_di": self._optional_string(row["basic_udi_di"]),
                "latest_version": self._optional_string(row["latest_successful_version"]),
                "baseline_patch_success": bool(row["baseline_patch_success"]),
            }
            for row in rows
        ]

    def posted_parent_groups(
        self,
        *,
        product_family: str,
        product_variant: str,
    ) -> list[dict[str, object]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT basic_udi_di, COUNT(*) AS posted_child_count
                FROM testing_subjects
                WHERE normalized_product_family = ?
                  AND normalized_product_variant = ?
                  AND post_success = 1
                  AND basic_udi_di IS NOT NULL
                  AND EXISTS (
                      SELECT 1
                      FROM testing_events event
                      WHERE event.subject_id = testing_subjects.id
                        AND event.status = 'SUCCESS'
                        AND event.message_type IN ('UDI_DI.POST', 'UDI_DI.PATCH')
                  )
                GROUP BY basic_udi_di
                ORDER BY MIN(id)
                """,
                (
                    self._normalize_identity(product_family),
                    self._normalize_identity(product_variant),
                ),
            ).fetchall()
            groups: list[dict[str, object]] = []
            for row in rows:
                basic_udi_di = self._optional_string(row["basic_udi_di"])
                if not basic_udi_di:
                    continue
                sample_rows = connection.execute(
                    """
                    SELECT catalogue_number
                    FROM testing_subjects
                    WHERE normalized_product_family = ?
                      AND normalized_product_variant = ?
                      AND normalized_basic_udi_di = ?
                      AND post_success = 1
                      AND EXISTS (
                          SELECT 1
                          FROM testing_events event
                          WHERE event.subject_id = testing_subjects.id
                            AND event.status = 'SUCCESS'
                            AND event.message_type IN ('UDI_DI.POST', 'UDI_DI.PATCH')
                      )
                    ORDER BY id
                    LIMIT 10
                    """,
                    (
                        self._normalize_identity(product_family),
                        self._normalize_identity(product_variant),
                        self._normalize_identity(basic_udi_di),
                    ),
                ).fetchall()
                groups.append(
                    {
                        "basic_udi_di": basic_udi_di,
                        "posted_child_count": int(row["posted_child_count"]),
                        "sample_catalogue_numbers": [
                            self._optional_string(sample_row["catalogue_number"])
                            for sample_row in sample_rows
                            if self._optional_string(sample_row["catalogue_number"])
                        ],
                    }
                )
        return groups

    def has_successful_basic_udi_post(
        self,
        *,
        product_family: str,
        product_variant: str,
        basic_udi_di: str,
    ) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT 1
                FROM testing_subjects
                WHERE normalized_product_family = ?
                  AND normalized_product_variant = ?
                  AND normalized_basic_udi_di = ?
                  AND EXISTS (
                      SELECT 1
                      FROM testing_events event
                      WHERE event.subject_id = testing_subjects.id
                        AND event.status = 'SUCCESS'
                        AND event.message_type = 'DEVICE.POST'
                  )
                LIMIT 1
                """,
                (
                    self._normalize_identity(product_family),
                    self._normalize_identity(product_variant),
                    self._normalize_identity(basic_udi_di),
                ),
            ).fetchone()
        return row is not None

    def has_successful_primary_udi_post(
        self,
        *,
        product_family: str,
        product_variant: str,
        primary_udi_di: str,
    ) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT 1
                FROM testing_subjects
                WHERE normalized_product_family = ?
                  AND normalized_product_variant = ?
                  AND normalized_primary_udi_di = ?
                  AND EXISTS (
                      SELECT 1
                      FROM testing_events event
                      WHERE event.subject_id = testing_subjects.id
                        AND event.status = 'SUCCESS'
                        AND event.message_type IN ('DEVICE.POST', 'UDI_DI.POST', 'UDI_DI.PATCH')
                  )
                LIMIT 1
                """,
                (
                    self._normalize_identity(product_family),
                    self._normalize_identity(product_variant),
                    self._normalize_identity(primary_udi_di),
                ),
            ).fetchone()
        return row is not None

    def mark_reviewed_post(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> None:
        with self._connect() as connection:
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
                ON CONFLICT(normalized_product_family, normalized_product_variant, normalized_catalogue_number)
                DO UPDATE SET reviewed_at = CURRENT_TIMESTAMP
                """,
                (
                    self._normalize_identity(product_family),
                    self._normalize_identity(product_variant),
                    self._normalize_identity(catalogue_number),
                    self._optional_string(product_family),
                    self._optional_string(product_variant),
                    self._optional_string(catalogue_number),
                ),
            )

    def has_reviewed_post(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT 1
                FROM reviewed_post_baselines
                WHERE normalized_product_family = ?
                  AND normalized_product_variant = ?
                  AND normalized_catalogue_number = ?
                LIMIT 1
                """,
                (
                    self._normalize_identity(product_family),
                    self._normalize_identity(product_variant),
                    self._normalize_identity(catalogue_number),
                ),
            ).fetchone()
        return row is not None

    @classmethod
    def clear_reviewed_posts(cls) -> None:
        settings = get_settings()
        db_path = settings.testing_state_db_path
        if not db_path.exists():
            return
        connection = sqlite3.connect(db_path)
        try:
            connection.execute("DELETE FROM reviewed_post_baselines")
            connection.commit()
        finally:
            connection.close()

    def _ensure_database(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS testing_subjects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject_key TEXT NOT NULL UNIQUE,
                    normalized_product_family TEXT NOT NULL,
                    normalized_product_variant TEXT NOT NULL,
                    normalized_catalogue_number TEXT NOT NULL,
                    normalized_primary_udi_di TEXT,
                    normalized_basic_udi_di TEXT,
                    product_family TEXT,
                    product_variant TEXT,
                    catalogue_number TEXT,
                    primary_udi_di TEXT,
                    basic_udi_di TEXT,
                    source_workbook TEXT,
                    source_sheet TEXT,
                    source_row_index INTEGER,
                    post_success INTEGER NOT NULL DEFAULT 0,
                    baseline_patch_success INTEGER NOT NULL DEFAULT 0,
                    exclude_from_post_wave INTEGER NOT NULL DEFAULT 0,
                    exclude_from_baseline_patch_wave INTEGER NOT NULL DEFAULT 0,
                    latest_successful_version TEXT,
                    latest_successful_state_json TEXT
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS testing_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject_id INTEGER NOT NULL,
                    event_index INTEGER NOT NULL,
                    message_type TEXT,
                    status TEXT,
                    version TEXT,
                    scenario_id TEXT,
                    scenario_label TEXT,
                    tested_at TEXT,
                    transaction_id TEXT,
                    submission_id TEXT,
                    payload_created_at TEXT,
                    correlation_id TEXT,
                    message_id TEXT,
                    changed_fields_json TEXT,
                    retained_fields_json TEXT,
                    unchanged_fields_json TEXT,
                    raw_event_json TEXT NOT NULL,
                    FOREIGN KEY(subject_id) REFERENCES testing_subjects(id) ON DELETE CASCADE,
                    UNIQUE(subject_id, event_index)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS reviewed_post_baselines (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    normalized_product_family TEXT NOT NULL,
                    normalized_product_variant TEXT NOT NULL,
                    normalized_catalogue_number TEXT NOT NULL,
                    product_family TEXT,
                    product_variant TEXT,
                    catalogue_number TEXT,
                    reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(normalized_product_family, normalized_product_variant, normalized_catalogue_number)
                )
                """
            )
            subject_count = int(connection.execute("SELECT COUNT(*) FROM testing_subjects").fetchone()[0])
            if not subject_count:
                self._import_yaml_into_database(connection)

    def _import_yaml_into_database(self, connection: sqlite3.Connection) -> None:
        if not self.yaml_path.exists():
            return
        data = yaml.safe_load(self.yaml_path.read_text()) or {}
        subjects = data.get("tested_subjects") or []
        for subject in subjects:
            if not isinstance(subject, dict):
                continue
            source_reference = cast(dict[str, Any] | None, subject.get("source_reference"))
            playground_status = cast(dict[str, Any] | None, subject.get("playground_status"))
            latest_state = cast(dict[str, Any] | None, subject.get("latest_successful_state"))
            subject_cursor: sqlite3.Cursor = connection.execute(
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
                    source_workbook,
                    source_sheet,
                    source_row_index,
                    post_success,
                    baseline_patch_success,
                    exclude_from_post_wave,
                    exclude_from_baseline_patch_wave,
                    latest_successful_version,
                    latest_successful_state_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    self._optional_string(subject.get("subject_id"))
                    or "|".join(
                        filter(
                            None,
                            [
                                self._normalize_identity(subject.get("product_family")),
                                self._normalize_identity(subject.get("product_variant")),
                                self._normalize_identity(subject.get("catalogue_number")),
                            ],
                        )
                    ),
                    self._normalize_identity(subject.get("product_family")),
                    self._normalize_identity(subject.get("product_variant")),
                    self._normalize_identity(subject.get("catalogue_number")),
                    self._normalize_identity(subject.get("primary_udi_di")) or None,
                    self._normalize_identity(subject.get("basic_udi_di")) or None,
                    self._optional_string(subject.get("product_family")),
                    self._optional_string(subject.get("product_variant")),
                    self._optional_string(subject.get("catalogue_number")),
                    self._optional_string(subject.get("primary_udi_di")),
                    self._optional_string(subject.get("basic_udi_di")),
                    self._optional_string(source_reference.get("workbook")) if source_reference else None,
                    self._optional_string(source_reference.get("sheet")) if source_reference else None,
                    self._optional_int(cast(object, source_reference.get("row_index"))) if source_reference else None,
                    int(bool(playground_status.get("post_success"))) if playground_status else 0,
                    int(bool(playground_status.get("baseline_patch_success"))) if playground_status else 0,
                    int(bool(playground_status.get("exclude_from_post_wave"))) if playground_status else 0,
                    int(bool(playground_status.get("exclude_from_baseline_patch_wave"))) if playground_status else 0,
                    self._optional_string(latest_state.get("version")) if latest_state else None,
                    json.dumps(latest_state) if latest_state else None,
                ),
            )
            subject_row_id = subject_cursor.lastrowid
            if subject_row_id is None:
                raise RuntimeError("Failed to persist imported testing subject row.")
            subject_id = int(subject_row_id)
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
                        self._optional_string(event.get("message_type")),
                        self._optional_string(event.get("status")),
                        self._optional_string(event.get("version")),
                        self._optional_string(event.get("scenario_id")),
                        self._optional_string(event.get("scenario_label")),
                        self._optional_string(event.get("tested_at")),
                        self._optional_string(event.get("transaction_id")),
                        self._optional_string(event.get("submission_id")),
                        self._optional_string(event.get("payload_created_at")),
                        self._optional_string(event.get("correlation_id")),
                        self._optional_string(event.get("message_id")),
                        json.dumps(event.get("changed_fields")) if isinstance(event.get("changed_fields"), list) else None,
                        json.dumps(event.get("retained_fields")) if isinstance(event.get("retained_fields"), list) else None,
                        json.dumps(event.get("unchanged_fields")) if isinstance(event.get("unchanged_fields"), list) else None,
                        json.dumps(event),
                    ),
                )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _latest_successful_patch_scenario_id(self, subject_id: int) -> str | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT scenario_id, version
                FROM testing_events
                WHERE subject_id = ?
                  AND message_type = 'UDI_DI.PATCH'
                  AND status = 'SUCCESS'
                ORDER BY event_index DESC
                LIMIT 1
                """,
                (subject_id,),
            ).fetchone()
        if row is None:
            return None
        scenario_id = self._optional_string(row["scenario_id"])
        if scenario_id:
            return scenario_id
        if self._optional_string(row["version"]) == "2":
            return "equivalent_first_patch"
        return None

    def _subject_row(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> sqlite3.Row | None:
        with self._connect() as connection:
            return connection.execute(
                """
                SELECT *
                FROM testing_subjects
                WHERE normalized_product_family = ?
                  AND normalized_product_variant = ?
                  AND normalized_catalogue_number = ?
                LIMIT 1
                """,
                (
                    self._normalize_identity(product_family),
                    self._normalize_identity(product_variant),
                    self._normalize_identity(catalogue_number),
                ),
            ).fetchone()

    @staticmethod
    def _optional_string(value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return str(value)
        normalized = value.strip()
        return normalized or None

    @classmethod
    def _matches_identity(cls, left: object, right: object) -> bool:
        left_normalized = cls._normalize_identity(left)
        right_normalized = cls._normalize_identity(right)
        return bool(left_normalized and right_normalized and left_normalized == right_normalized)

    @classmethod
    def _normalize_identity(cls, value: object) -> str:
        text = cls._optional_string(value)
        if not text:
            return ""
        return "".join(text.casefold().split())

    @staticmethod
    def _optional_int(value: object) -> int | None:
        if value is None:
            return None
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            try:
                return int(value)
            except (TypeError, ValueError, OverflowError):
                return None
        if isinstance(value, str):
            normalized = value.strip()
            if not normalized:
                return None
            try:
                return int(normalized)
            except (TypeError, ValueError):
                return None
        try:
            return int(str(value).strip())
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _optional_bool(value: object) -> bool | None:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized == "true":
                return True
            if normalized == "false":
                return False
        return None

    @staticmethod
    def _storage_conditions(value: object) -> list[StorageConditionXmlItem]:
        if not isinstance(value, list):
            return []
        items: list[StorageConditionXmlItem] = []
        for entry in value:
            if not isinstance(entry, dict):
                continue
            code = str(entry.get("code") or "").strip()
            if not code:
                continue
            items.append(
                StorageConditionXmlItem(
                    code=code,
                    comment=TestingStateStore._optional_string(entry.get("comment")),
                )
            )
        return items

    @staticmethod
    def _critical_warnings(value: object) -> list[CriticalWarningXmlItem]:
        if not isinstance(value, list):
            return []
        items: list[CriticalWarningXmlItem] = []
        for entry in value:
            if not isinstance(entry, dict):
                continue
            code = str(entry.get("code") or "").strip()
            if not code:
                continue
            items.append(
                CriticalWarningXmlItem(
                    code=code,
                    comment=TestingStateStore._optional_string(entry.get("comment")),
                )
            )
        return items
