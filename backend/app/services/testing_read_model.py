from __future__ import annotations

import json
import sqlite3

from app.config import get_settings
from app.models import (
    TestingEventSummary,
    TestingSubjectHistory,
    TestingSubjectReadModelSummary,
    TestingWorkspaceSummary,
)


class TestingReadModelService:
    __test__ = False

    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def db_path(self):
        return self.settings.testing_state_db_path

    def workspace_summary(
        self,
        *,
        product_family: str | None = None,
        product_variant: str | None = None,
    ) -> TestingWorkspaceSummary:
        clauses: list[str] = []
        params: list[object] = []
        if product_family:
            clauses.append("ts.normalized_product_family = ?")
            params.append(self._normalize_identity(product_family))
        if product_variant:
            clauses.append("ts.normalized_product_variant = ?")
            params.append(self._normalize_identity(product_variant))
        where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        with self._connect() as connection:
            subject_row = connection.execute(
                f"""
                SELECT
                    COUNT(DISTINCT ts.id) AS subject_count,
                    COUNT(DISTINCT CASE WHEN ts.device_subject_id IS NOT NULL THEN ts.id END) AS linked_device_subject_count,
                    COUNT(DISTINCT CASE WHEN ts.baseline_patch_success = 1 THEN ts.id END) AS baseline_patch_success_count,
                    MAX(event.tested_at) AS latest_tested_at
                FROM testing_subjects ts
                LEFT JOIN testing_events event ON event.subject_id = ts.id
                {where_clause}
                """,
                params,
            ).fetchone()
            reviewed_post_count = int(
                connection.execute(
                    f"""
                    SELECT COUNT(*)
                    FROM reviewed_post_baselines rb
                    {"WHERE rb.normalized_product_family = ?" + (" AND rb.normalized_product_variant = ?" if product_variant else "") if product_family else ("WHERE rb.normalized_product_variant = ?" if product_variant else "")}
                    """,
                    self._baseline_filter_params(product_family=product_family, product_variant=product_variant),
                ).fetchone()[0]
            )
            successful_device_post_count = self._event_count(
                connection,
                message_type="DEVICE.POST",
                product_family=product_family,
                product_variant=product_variant,
            )
            successful_child_post_count = self._event_count(
                connection,
                message_type="UDI_DI.POST",
                product_family=product_family,
                product_variant=product_variant,
            )
            successful_patch_count = self._event_count(
                connection,
                message_type="UDI_DI.PATCH",
                product_family=product_family,
                product_variant=product_variant,
            )
            parent_group_row = connection.execute(
                f"""
                SELECT COUNT(*)
                FROM (
                    SELECT ts.normalized_basic_udi_di
                    FROM testing_subjects ts
                    WHERE ts.post_success = 1
                      AND COALESCE(ts.normalized_basic_udi_di, '') <> ''
                      {"AND ts.normalized_product_family = ?" if product_family else ""}
                      {"AND ts.normalized_product_variant = ?" if product_variant else ""}
                    GROUP BY ts.normalized_basic_udi_di
                )
                """,
                self._subject_filter_params(product_family=product_family, product_variant=product_variant),
            ).fetchone()

        return TestingWorkspaceSummary(
            product_family=product_family,
            product_variant=product_variant,
            subject_count=int(subject_row["subject_count"]) if subject_row is not None else 0,
            linked_device_subject_count=int(subject_row["linked_device_subject_count"]) if subject_row is not None else 0,
            reviewed_post_count=reviewed_post_count,
            successful_device_post_count=successful_device_post_count,
            successful_child_post_count=successful_child_post_count,
            successful_patch_count=successful_patch_count,
            baseline_patch_success_count=int(subject_row["baseline_patch_success_count"]) if subject_row is not None else 0,
            posted_parent_group_count=int(parent_group_row[0]) if parent_group_row is not None else 0,
            latest_tested_at=self._optional_string(subject_row["latest_tested_at"]) if subject_row is not None else None,
        )

    def list_subject_summaries(
        self,
        *,
        product_family: str | None = None,
        product_variant: str | None = None,
        limit: int = 200,
    ) -> list[TestingSubjectReadModelSummary]:
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT
                    ts.id,
                    ts.device_subject_id,
                    ts.product_family,
                    ts.product_variant,
                    ts.catalogue_number,
                    ts.primary_udi_di,
                    ts.basic_udi_di,
                    ts.post_success,
                    ts.baseline_patch_success,
                    MAX(CASE WHEN event.status = 'SUCCESS' AND event.message_type = 'DEVICE.POST' THEN 1 ELSE 0 END) AS has_successful_device_post,
                    MAX(CASE WHEN event.status = 'SUCCESS' AND event.message_type IN ('UDI_DI.POST', 'UDI_DI.PATCH') THEN 1 ELSE 0 END) AS has_successful_child_post_or_patch,
                    ts.latest_successful_version,
                    MAX(event.tested_at) AS latest_tested_at,
                    COUNT(event.id) AS event_count,
                    MAX(rb.reviewed_at) AS reviewed_post_at
                FROM testing_subjects ts
                LEFT JOIN testing_events event ON event.subject_id = ts.id
                LEFT JOIN reviewed_post_baselines rb
                  ON rb.normalized_product_family = ts.normalized_product_family
                 AND rb.normalized_product_variant = ts.normalized_product_variant
                 AND rb.normalized_catalogue_number = ts.normalized_catalogue_number
                {self._subject_where_clause(product_family=product_family, product_variant=product_variant)}
                GROUP BY ts.id
                ORDER BY COALESCE(MAX(event.tested_at), '') DESC, ts.id DESC
                LIMIT ?
                """,
                (*self._subject_filter_params(product_family=product_family, product_variant=product_variant), limit),
            ).fetchall()
        return [self._subject_summary_from_row(row) for row in rows]

    def subject_history(self, subject_id: int) -> TestingSubjectHistory | None:
        with self._connect() as connection:
            subject_row = connection.execute(
                """
                SELECT
                    ts.id,
                    ts.device_subject_id,
                    ts.product_family,
                    ts.product_variant,
                    ts.catalogue_number,
                    ts.primary_udi_di,
                    ts.basic_udi_di,
                    ts.post_success,
                    ts.baseline_patch_success,
                    MAX(CASE WHEN event.status = 'SUCCESS' AND event.message_type = 'DEVICE.POST' THEN 1 ELSE 0 END) AS has_successful_device_post,
                    MAX(CASE WHEN event.status = 'SUCCESS' AND event.message_type IN ('UDI_DI.POST', 'UDI_DI.PATCH') THEN 1 ELSE 0 END) AS has_successful_child_post_or_patch,
                    ts.latest_successful_version,
                    MAX(event.tested_at) AS latest_tested_at,
                    COUNT(event.id) AS event_count,
                    MAX(rb.reviewed_at) AS reviewed_post_at
                FROM testing_subjects ts
                LEFT JOIN testing_events event ON event.subject_id = ts.id
                LEFT JOIN reviewed_post_baselines rb
                  ON rb.normalized_product_family = ts.normalized_product_family
                 AND rb.normalized_product_variant = ts.normalized_product_variant
                 AND rb.normalized_catalogue_number = ts.normalized_catalogue_number
                WHERE ts.id = ?
                GROUP BY ts.id
                """,
                (subject_id,),
            ).fetchone()
            if subject_row is None:
                return None
            event_rows = connection.execute(
                """
                SELECT
                    id,
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
                    unchanged_fields_json
                FROM testing_events
                WHERE subject_id = ?
                ORDER BY event_index
                """,
                (subject_id,),
            ).fetchall()
        return TestingSubjectHistory(
            subject=self._subject_summary_from_row(subject_row),
            events=[self._event_summary_from_row(row) for row in event_rows],
        )

    def _event_count(
        self,
        connection: sqlite3.Connection,
        *,
        message_type: str,
        product_family: str | None,
        product_variant: str | None,
    ) -> int:
        row = connection.execute(
            f"""
            SELECT COUNT(*)
            FROM testing_events event
            JOIN testing_subjects ts ON ts.id = event.subject_id
            WHERE event.status = 'SUCCESS'
              AND event.message_type = ?
              {"AND ts.normalized_product_family = ?" if product_family else ""}
              {"AND ts.normalized_product_variant = ?" if product_variant else ""}
            """,
            (
                message_type,
                *self._subject_filter_params(product_family=product_family, product_variant=product_variant),
            ),
        ).fetchone()
        return int(row[0]) if row is not None else 0

    @staticmethod
    def _optional_string(value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return str(value)
        normalized = value.strip()
        return normalized or None

    @classmethod
    def _normalize_identity(cls, value: object) -> str:
        text = cls._optional_string(value)
        if not text:
            return ""
        return "".join(text.casefold().split())

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    @classmethod
    def _subject_where_clause(
        cls,
        *,
        product_family: str | None,
        product_variant: str | None,
    ) -> str:
        clauses: list[str] = []
        if product_family:
            clauses.append("ts.normalized_product_family = ?")
        if product_variant:
            clauses.append("ts.normalized_product_variant = ?")
        return f"WHERE {' AND '.join(clauses)}" if clauses else ""

    @classmethod
    def _subject_filter_params(
        cls,
        *,
        product_family: str | None,
        product_variant: str | None,
    ) -> tuple[str, ...]:
        params: list[str] = []
        if product_family:
            params.append(cls._normalize_identity(product_family))
        if product_variant:
            params.append(cls._normalize_identity(product_variant))
        return tuple(params)

    @classmethod
    def _baseline_filter_params(
        cls,
        *,
        product_family: str | None,
        product_variant: str | None,
    ) -> tuple[str, ...]:
        return cls._subject_filter_params(product_family=product_family, product_variant=product_variant)

    @classmethod
    def _subject_summary_from_row(cls, row: sqlite3.Row) -> TestingSubjectReadModelSummary:
        return TestingSubjectReadModelSummary(
            id=int(row["id"]),
            device_subject_id=int(row["device_subject_id"]) if row["device_subject_id"] is not None else None,
            product_family=cls._optional_string(row["product_family"]),
            product_variant=cls._optional_string(row["product_variant"]),
            catalogue_number=cls._optional_string(row["catalogue_number"]),
            primary_udi_di=cls._optional_string(row["primary_udi_di"]),
            basic_udi_di=cls._optional_string(row["basic_udi_di"]),
            post_success=bool(row["post_success"]),
            baseline_patch_success=bool(row["baseline_patch_success"]),
            has_successful_device_post=bool(row["has_successful_device_post"]),
            has_successful_child_post_or_patch=bool(row["has_successful_child_post_or_patch"]),
            latest_successful_version=cls._optional_string(row["latest_successful_version"]),
            latest_tested_at=cls._optional_string(row["latest_tested_at"]),
            reviewed_post_at=cls._optional_string(row["reviewed_post_at"]),
            event_count=int(row["event_count"]),
        )

    @classmethod
    def _event_summary_from_row(cls, row: sqlite3.Row) -> TestingEventSummary:
        return TestingEventSummary(
            id=int(row["id"]),
            event_index=int(row["event_index"]),
            message_type=cls._optional_string(row["message_type"]),
            status=cls._optional_string(row["status"]),
            version=cls._optional_string(row["version"]),
            scenario_id=cls._optional_string(row["scenario_id"]),
            scenario_label=cls._optional_string(row["scenario_label"]),
            tested_at=cls._optional_string(row["tested_at"]),
            transaction_id=cls._optional_string(row["transaction_id"]),
            submission_id=cls._optional_string(row["submission_id"]),
            correlation_id=cls._optional_string(row["correlation_id"]),
            message_id=cls._optional_string(row["message_id"]),
            changed_fields=cls._json_list(row["changed_fields_json"]),
            retained_fields=cls._json_list(row["retained_fields_json"]),
            unchanged_fields=cls._json_list(row["unchanged_fields_json"]),
        )

    @staticmethod
    def _json_list(value: object) -> list[object]:
        if value is None:
            return []
        try:
            payload = json.loads(str(value))
        except (TypeError, ValueError, json.JSONDecodeError):
            return []
        return payload if isinstance(payload, list) else []
