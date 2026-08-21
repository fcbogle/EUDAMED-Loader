from __future__ import annotations

from dataclasses import dataclass
import json
import sqlite3
from typing import Any, cast

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
    def db_path(self):
        return self.settings.testing_state_db_path

    def refresh_device_subject_links(self) -> None:
        with self._connect() as connection:
            self._backfill_device_subject_links(connection)

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
            source="sqlite_latest_successful_patch",
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
        family_clause, family_params = self._family_match_clause(product_family, table_name="testing_subjects")
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT catalogue_number, primary_udi_di, basic_udi_di, latest_successful_version, baseline_patch_success
                FROM testing_subjects
                WHERE {family_clause}
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
                    *family_params,
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
        family_clause, family_params = self._family_match_clause(product_family, table_name="testing_subjects")
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT basic_udi_di, COUNT(*) AS posted_child_count
                FROM testing_subjects
                WHERE {family_clause}
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
                    *family_params,
                    self._normalize_identity(product_variant),
                ),
            ).fetchall()
            groups: list[dict[str, object]] = []
            for row in rows:
                basic_udi_di = self._optional_string(row["basic_udi_di"])
                if not basic_udi_di:
                    continue
                sample_rows = connection.execute(
                    f"""
                    SELECT catalogue_number
                    FROM testing_subjects
                    WHERE {family_clause}
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
                        *family_params,
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
        family_clause, family_params = self._family_match_clause(product_family, table_name="testing_subjects")
        with self._connect() as connection:
            row = connection.execute(
                f"""
                SELECT 1
                FROM testing_subjects
                WHERE {family_clause}
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
                    *family_params,
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
        family_clause, family_params = self._family_match_clause(product_family, table_name="testing_subjects")
        with self._connect() as connection:
            row = connection.execute(
                f"""
                SELECT 1
                FROM testing_subjects
                WHERE {family_clause}
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
                    *family_params,
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
            device_subject_id = self._resolve_device_subject_id(
                connection,
                product_family=product_family,
                product_variant=product_variant,
                catalogue_number=catalogue_number,
                primary_udi_di=None,
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
                    catalogue_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(normalized_product_family, normalized_product_variant, normalized_catalogue_number)
                DO UPDATE SET
                    reviewed_at = CURRENT_TIMESTAMP,
                    device_subject_id = COALESCE(excluded.device_subject_id, reviewed_post_baselines.device_subject_id)
                """,
                (
                    device_subject_id,
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
        family_clause, family_params = self._family_match_clause(product_family, table_name="reviewed_post_baselines")
        with self._connect() as connection:
            row = connection.execute(
                f"""
                SELECT 1
                FROM reviewed_post_baselines
                WHERE {family_clause}
                  AND normalized_product_variant = ?
                  AND normalized_catalogue_number = ?
                LIMIT 1
                """,
                (
                    *family_params,
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
                    device_subject_id INTEGER,
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
                    latest_successful_state_json TEXT,
                    FOREIGN KEY(device_subject_id) REFERENCES device_subject(id) ON DELETE SET NULL
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
                    device_subject_id INTEGER,
                    normalized_product_family TEXT NOT NULL,
                    normalized_product_variant TEXT NOT NULL,
                    normalized_catalogue_number TEXT NOT NULL,
                    product_family TEXT,
                    product_variant TEXT,
                    catalogue_number TEXT,
                    reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(device_subject_id) REFERENCES device_subject(id) ON DELETE SET NULL,
                    UNIQUE(normalized_product_family, normalized_product_variant, normalized_catalogue_number)
                )
                """
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="device_subject_id",
                column_definition="INTEGER REFERENCES device_subject(id) ON DELETE SET NULL",
            )
            self._ensure_column(
                connection,
                table_name="reviewed_post_baselines",
                column_name="device_subject_id",
                column_definition="INTEGER REFERENCES device_subject(id) ON DELETE SET NULL",
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_testing_subjects_device_subject_id ON testing_subjects(device_subject_id)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_reviewed_post_baselines_device_subject_id ON reviewed_post_baselines(device_subject_id)"
            )
            self._backfill_device_subject_links(connection)

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
        family_clause, family_params = self._family_match_clause(product_family, table_name="testing_subjects")
        with self._connect() as connection:
            return connection.execute(
                f"""
                SELECT *
                FROM testing_subjects
                WHERE {family_clause}
                  AND normalized_product_variant = ?
                  AND normalized_catalogue_number = ?
                LIMIT 1
                """,
                (
                    *family_params,
                    self._normalize_identity(product_variant),
                    self._normalize_identity(catalogue_number),
                ),
            ).fetchone()

    @staticmethod
    def _table_columns(connection: sqlite3.Connection, table_name: str) -> set[str]:
        rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
        return {str(row[1]) for row in rows}

    @classmethod
    def _ensure_column(
        cls,
        connection: sqlite3.Connection,
        *,
        table_name: str,
        column_name: str,
        column_definition: str,
    ) -> None:
        if column_name in cls._table_columns(connection, table_name):
            return
        connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")

    @staticmethod
    def _table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
        row = connection.execute(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = ?
            LIMIT 1
            """,
            (table_name,),
        ).fetchone()
        return row is not None

    def _backfill_device_subject_links(self, connection: sqlite3.Connection) -> None:
        if not self._table_exists(connection, "device_subject"):
            return

        testing_rows = connection.execute(
            """
            SELECT id, product_family, product_variant, catalogue_number, primary_udi_di
            FROM testing_subjects
            WHERE device_subject_id IS NULL
            """
        ).fetchall()
        for row in testing_rows:
            device_subject_id = self._resolve_device_subject_id(
                connection,
                product_family=self._optional_string(row["product_family"]),
                product_variant=self._optional_string(row["product_variant"]),
                catalogue_number=self._optional_string(row["catalogue_number"]),
                primary_udi_di=self._optional_string(row["primary_udi_di"]),
            )
            if device_subject_id is None:
                continue
            connection.execute(
                "UPDATE testing_subjects SET device_subject_id = ? WHERE id = ?",
                (device_subject_id, int(row["id"])),
            )

        baseline_rows = connection.execute(
            """
            SELECT id, product_family, product_variant, catalogue_number
            FROM reviewed_post_baselines
            WHERE device_subject_id IS NULL
            """
        ).fetchall()
        for row in baseline_rows:
            device_subject_id = self._resolve_device_subject_id(
                connection,
                product_family=self._optional_string(row["product_family"]),
                product_variant=self._optional_string(row["product_variant"]),
                catalogue_number=self._optional_string(row["catalogue_number"]),
                primary_udi_di=None,
            )
            if device_subject_id is None:
                continue
            connection.execute(
                "UPDATE reviewed_post_baselines SET device_subject_id = ? WHERE id = ?",
                (device_subject_id, int(row["id"])),
            )

    def _resolve_device_subject_id(
        self,
        connection: sqlite3.Connection,
        *,
        product_family: str | None,
        product_variant: str | None,
        catalogue_number: str | None,
        primary_udi_di: str | None,
    ) -> int | None:
        normalized_family_candidates = self._normalized_family_candidates(product_family)
        normalized_variant = self._normalize_identity(product_variant)
        normalized_catalogue = self._normalize_identity(catalogue_number)
        normalized_primary = self._normalize_identity(primary_udi_di)
        if not (normalized_family_candidates and normalized_variant and normalized_catalogue):
            return None
        if not self._table_exists(connection, "device_subject"):
            return None

        rows = connection.execute(
            """
            SELECT id, product_family, product_variant, catalogue_number, primary_udi_di
            FROM device_subject
            """
        ).fetchall()

        exact_primary_matches: list[int] = []
        fallback_matches: list[int] = []
        for row in rows:
            if self._normalize_identity(row["product_family"]) not in normalized_family_candidates:
                continue
            if self._normalize_identity(row["product_variant"]) != normalized_variant:
                continue
            if self._normalize_identity(row["catalogue_number"]) != normalized_catalogue:
                continue
            fallback_matches.append(int(row["id"]))
            if normalized_primary and self._normalize_identity(row["primary_udi_di"]) == normalized_primary:
                exact_primary_matches.append(int(row["id"]))

        if len(exact_primary_matches) == 1:
            return exact_primary_matches[0]
        if normalized_primary:
            return None
        if len(fallback_matches) == 1:
            return fallback_matches[0]
        return None

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
    def _normalized_family_candidates(cls, product_family: object) -> tuple[str, ...]:
        normalized_full = cls._normalize_identity(product_family)
        if not normalized_full:
            return ()
        candidates = {normalized_full}
        family_text = cls._optional_string(product_family)
        if family_text and "/" in family_text:
            candidates.update(
                cls._normalize_identity(part)
                for part in family_text.split("/")
                if cls._normalize_identity(part)
            )
        return tuple(sorted(candidates))

    @classmethod
    def _family_match_clause(cls, product_family: object, *, table_name: str) -> tuple[str, tuple[str, ...]]:
        family_candidates = cls._normalized_family_candidates(product_family)
        if not family_candidates:
            return f"{table_name}.normalized_product_family = ''", ()
        if len(family_candidates) == 1:
            return f"{table_name}.normalized_product_family = ?", family_candidates
        placeholders = ", ".join("?" for _ in family_candidates)
        return f"{table_name}.normalized_product_family IN ({placeholders})", family_candidates

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
