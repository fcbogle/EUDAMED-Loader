from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

from app.config import get_settings
from app.models import (
    ImportedWorkbookSummary,
    WorkbookImportBatchSummary,
    WorkbookImportDuplicateGroup,
    WorkbookImportOperationCount,
    WorkbookImportRunResponse,
    WorkbookImportSnapshotSummary,
    WorkbookImportTableCount,
)
from app.services.canonical_validation import (
    FAMILY_LABELS,
    HEADER_SENTINEL,
    CanonicalValidationService,
)


@dataclass(frozen=True)
class ImportedSourceRow:
    sheet_name: str
    row_index: int
    values: dict[str, object | None]


class WorkbookImportService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.validation_service = CanonicalValidationService()
        self._ensure_schema()

    @property
    def db_path(self) -> Path:
        return self.settings.testing_state_db_path

    def run_import(
        self,
        *,
        imported_by: str | None = None,
        label: str | None = None,
        notes: str | None = None,
    ) -> WorkbookImportRunResponse:
        imported_at = datetime.now(UTC).replace(microsecond=0).isoformat()
        resolved_label = label or f"Workbook import {imported_at}"
        source_type = "source_excel"
        promoted_lookup = self._promotion_lookup()

        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO import_batch (source_type, label, imported_at, imported_by, notes)
                VALUES (?, ?, ?, ?, ?)
                """,
                (source_type, resolved_label, imported_at, imported_by, notes),
            )
            import_batch_id = int(cursor.lastrowid)
            workbook_count = 0
            source_row_count = 0
            device_subject_count = 0

            for workbook_path in sorted(self.settings.excel_dir.glob("*.xlsx")):
                workbook_count += 1
                workbook_cursor = connection.execute(
                    """
                    INSERT INTO source_workbook (import_batch_id, workbook_name, file_path, file_hash, loaded_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        import_batch_id,
                        workbook_path.name,
                        str(workbook_path),
                        self._file_hash(workbook_path),
                        imported_at,
                    ),
                )
                source_workbook_id = int(workbook_cursor.lastrowid)
                workbook_rows = self._load_source_rows(workbook_path)
                for row in workbook_rows:
                    source_row_count += 1
                    promoted = promoted_lookup.get((workbook_path.name, row.sheet_name, row.row_index), {})
                    product_family = self._optional_string(promoted.get("product_family")) or FAMILY_LABELS.get(workbook_path.name)
                    product_variant = self._optional_string(promoted.get("product_variant")) or row.sheet_name
                    catalogue_number = self._optional_string(promoted.get("catalogue_number"))
                    primary_udi_di = self._optional_string(promoted.get("primary_udi_di"))
                    submission_operation = self._optional_string(promoted.get("submission_operation"))
                    canonical_status = self._optional_string(promoted.get("canonical_status")) or "not_yet_mapped"
                    basic_udi_di = self._optional_string(promoted.get("basic_udi_di"))
                    raw_payload_json = json.dumps(row.values, default=str, sort_keys=True)
                    row_cursor = connection.execute(
                        """
                        INSERT INTO source_row (
                            source_workbook_id,
                            sheet_name,
                            row_index,
                            product_family,
                            product_variant,
                            catalogue_number,
                            primary_udi_di,
                            submission_operation,
                            raw_payload_json,
                            canonical_status,
                            created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            source_workbook_id,
                            row.sheet_name,
                            row.row_index,
                            product_family,
                            product_variant,
                            catalogue_number,
                            primary_udi_di,
                            submission_operation,
                            raw_payload_json,
                            canonical_status,
                            imported_at,
                        ),
                    )
                    source_row_id = int(row_cursor.lastrowid)
                    if self._upsert_device_subject(
                        connection=connection,
                        product_family=product_family,
                        product_variant=product_variant,
                        catalogue_number=catalogue_number,
                        primary_udi_di=primary_udi_di,
                        basic_udi_di=basic_udi_di,
                        current_source_row_id=source_row_id,
                        updated_at=imported_at,
                    ):
                        device_subject_count += 1

        return WorkbookImportRunResponse(
            import_batch_id=import_batch_id,
            source_type=source_type,
            label=resolved_label,
            imported_at=imported_at,
            workbook_count=workbook_count,
            source_row_count=source_row_count,
            device_subject_count=device_subject_count,
        )

    def latest_import_batch(self) -> WorkbookImportBatchSummary | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT
                    batch.id,
                    batch.source_type,
                    batch.label,
                    batch.imported_at,
                    batch.imported_by,
                    batch.notes,
                    COUNT(DISTINCT workbook.id) AS workbook_count,
                    COUNT(DISTINCT source_row.id) AS source_row_count,
                    COUNT(DISTINCT subject.id) AS device_subject_count
                FROM import_batch batch
                LEFT JOIN source_workbook workbook ON workbook.import_batch_id = batch.id
                LEFT JOIN source_row ON source_row.source_workbook_id = workbook.id
                LEFT JOIN device_subject subject ON subject.current_source_row_id = source_row.id
                GROUP BY batch.id
                ORDER BY batch.id DESC
                LIMIT 1
                """
            ).fetchone()
        if row is None:
            return None
        return self._batch_summary_from_row(row)

    def imported_workbooks(self, *, import_batch_id: int) -> list[ImportedWorkbookSummary]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    workbook.id,
                    workbook.import_batch_id,
                    workbook.workbook_name,
                    workbook.file_path,
                    workbook.file_hash,
                    workbook.loaded_at,
                    COUNT(source_row.id) AS row_count
                FROM source_workbook workbook
                LEFT JOIN source_row ON source_row.source_workbook_id = workbook.id
                WHERE workbook.import_batch_id = ?
                GROUP BY workbook.id
                ORDER BY workbook.id
                """,
                (import_batch_id,),
            ).fetchall()
        return [
            ImportedWorkbookSummary(
                source_workbook_id=int(row["id"]),
                import_batch_id=int(row["import_batch_id"]),
                workbook_name=str(row["workbook_name"]),
                file_path=str(row["file_path"]),
                file_hash=str(row["file_hash"]),
                loaded_at=str(row["loaded_at"]),
                row_count=int(row["row_count"]),
            )
            for row in rows
        ]

    def latest_import_snapshot_summary(self) -> WorkbookImportSnapshotSummary | None:
        latest_batch = self.latest_import_batch()
        if latest_batch is None:
            return None

        imported_workbooks = self.imported_workbooks(import_batch_id=latest_batch.import_batch_id)
        with self._connect() as connection:
            table_counts = [
                WorkbookImportTableCount(
                    table_name=table_name,
                    row_count=int(connection.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]),
                    summary_label=summary_label,
                )
                for table_name, summary_label in (
                    ("import_batch", "Import batches"),
                    ("source_workbook", "Workbook snapshots"),
                    ("source_row", "Imported workbook rows"),
                    ("device_subject", "Stable device subjects"),
                    ("testing_subjects", "Tracked testing subjects"),
                    ("testing_events", "Tracked testing events"),
                    ("reviewed_post_baselines", "Reviewed POST baselines"),
                )
            ]
            operation_rows = connection.execute(
                """
                SELECT COALESCE(sr.submission_operation, 'UNCLASSIFIED') AS submission_operation, COUNT(*) AS device_subject_count
                FROM device_subject ds
                LEFT JOIN source_row sr ON sr.id = ds.current_source_row_id
                GROUP BY COALESCE(sr.submission_operation, 'UNCLASSIFIED')
                ORDER BY submission_operation
                """
            ).fetchall()
            duplicate_subject_rows = connection.execute(
                """
                SELECT
                    ds.subject_key,
                    COUNT(sr.id) AS source_row_count,
                    MIN(ds.product_family) AS product_family,
                    MIN(ds.product_variant) AS product_variant,
                    MIN(ds.catalogue_number) AS catalogue_number,
                    MIN(ds.primary_udi_di) AS primary_udi_di,
                    GROUP_CONCAT(DISTINCT sw.workbook_name) AS workbook_names,
                    GROUP_CONCAT(DISTINCT sr.sheet_name) AS sheet_names,
                    GROUP_CONCAT(sr.row_index) AS row_indexes
                FROM device_subject ds
                JOIN source_row current_row ON current_row.id = ds.current_source_row_id
                JOIN source_workbook current_workbook ON current_workbook.id = current_row.source_workbook_id
                JOIN source_row sr
                  ON COALESCE(sr.catalogue_number, '') = COALESCE(ds.catalogue_number, '')
                 AND COALESCE(sr.primary_udi_di, '') = COALESCE(ds.primary_udi_di, '')
                 AND COALESCE(sr.product_family, '') = COALESCE(ds.product_family, '')
                 AND COALESCE(sr.product_variant, '') = COALESCE(ds.product_variant, '')
                JOIN source_workbook sw ON sw.id = sr.source_workbook_id
                WHERE current_workbook.import_batch_id = ?
                GROUP BY ds.subject_key
                HAVING COUNT(sr.id) > 1
                ORDER BY source_row_count DESC, ds.subject_key
                LIMIT 8
                """,
                (latest_batch.import_batch_id,),
            ).fetchall()
            duplicate_subject_count = int(
                connection.execute(
                    """
                    SELECT COUNT(*)
                    FROM (
                        SELECT ds.subject_key
                        FROM device_subject ds
                        JOIN source_row current_row ON current_row.id = ds.current_source_row_id
                        JOIN source_workbook current_workbook ON current_workbook.id = current_row.source_workbook_id
                        JOIN source_row sr
                          ON COALESCE(sr.catalogue_number, '') = COALESCE(ds.catalogue_number, '')
                         AND COALESCE(sr.primary_udi_di, '') = COALESCE(ds.primary_udi_di, '')
                         AND COALESCE(sr.product_family, '') = COALESCE(ds.product_family, '')
                         AND COALESCE(sr.product_variant, '') = COALESCE(ds.product_variant, '')
                        WHERE current_workbook.import_batch_id = ?
                        GROUP BY ds.subject_key
                        HAVING COUNT(sr.id) > 1
                    )
                    """,
                    (latest_batch.import_batch_id,),
                ).fetchone()[0]
            )

        operation_counts = [
            WorkbookImportOperationCount(
                submission_operation=str(row["submission_operation"]),
                device_subject_count=int(row["device_subject_count"]),
            )
            for row in operation_rows
        ]
        duplicate_groups = [
            WorkbookImportDuplicateGroup(
                subject_key=str(row["subject_key"]),
                source_row_count=int(row["source_row_count"]),
                product_family=self._optional_string(row["product_family"]),
                product_variant=self._optional_string(row["product_variant"]),
                catalogue_number=self._optional_string(row["catalogue_number"]),
                primary_udi_di=self._optional_string(row["primary_udi_di"]),
                workbook_names=self._split_csv_values(row["workbook_names"]),
                sheet_names=self._split_csv_values(row["sheet_names"]),
                row_indexes=self._split_csv_ints(row["row_indexes"]),
            )
            for row in duplicate_subject_rows
        ]

        return WorkbookImportSnapshotSummary(
            import_batch=latest_batch,
            imported_workbooks=imported_workbooks,
            table_counts=table_counts,
            operation_counts=operation_counts,
            duplicate_source_row_delta=max(latest_batch.source_row_count - latest_batch.device_subject_count, 0),
            duplicate_subject_count=duplicate_subject_count,
            top_duplicate_groups=duplicate_groups,
        )

    def _ensure_schema(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS import_batch (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_type TEXT NOT NULL,
                    label TEXT NOT NULL,
                    imported_at TEXT NOT NULL,
                    imported_by TEXT,
                    notes TEXT
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS source_workbook (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    import_batch_id INTEGER NOT NULL,
                    workbook_name TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_hash TEXT NOT NULL,
                    loaded_at TEXT NOT NULL,
                    FOREIGN KEY(import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS source_row (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_workbook_id INTEGER NOT NULL,
                    sheet_name TEXT NOT NULL,
                    row_index INTEGER NOT NULL,
                    product_family TEXT,
                    product_variant TEXT,
                    catalogue_number TEXT,
                    primary_udi_di TEXT,
                    submission_operation TEXT,
                    raw_payload_json TEXT NOT NULL,
                    canonical_status TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(source_workbook_id) REFERENCES source_workbook(id) ON DELETE CASCADE
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS device_subject (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject_key TEXT NOT NULL UNIQUE,
                    product_family TEXT,
                    product_variant TEXT,
                    catalogue_number TEXT,
                    primary_udi_di TEXT,
                    basic_udi_di TEXT,
                    current_source_row_id INTEGER,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(current_source_row_id) REFERENCES source_row(id) ON DELETE SET NULL
                )
                """
            )

    def _promotion_lookup(self) -> dict[tuple[str, str, int], dict[str, str | None]]:
        bundle = self.validation_service.build_validation_bundle()
        lookup: dict[tuple[str, str, int], dict[str, str | None]] = {}
        for record in bundle.records:
            basic_udi_di = next(
                (
                    field.value
                    for field in record.fields
                    if field.canonical_path in {"basic_device.basic_udi_di", "device_record.basic_udi_identifier"}
                    and field.value
                ),
                None,
            )
            canonical_status = "xml_ready" if record.xml_readiness.status == "complete" else "xml_blocked"
            lookup[(record.source_workbook, record.source_sheet, record.source_row_index)] = {
                "product_family": record.product_family,
                "product_variant": record.product_variant,
                "catalogue_number": record.catalogue_number,
                "primary_udi_di": record.primary_udi_di,
                "submission_operation": record.submission_operation,
                "basic_udi_di": basic_udi_di,
                "canonical_status": canonical_status,
            }
        return lookup

    def _load_source_rows(self, workbook_path: Path) -> list[ImportedSourceRow]:
        workbook = load_workbook(workbook_path, read_only=True, data_only=True)
        rows: list[ImportedSourceRow] = []
        for sheet_name in workbook.sheetnames:
            worksheet = workbook[sheet_name]
            header_row_index: int | None = None
            headers: list[str] | None = None
            for row_index, row in enumerate(worksheet.iter_rows(values_only=True), start=1):
                values = list(row)
                if headers is None and any(
                    isinstance(value, str) and HEADER_SENTINEL in value for value in values if value
                ):
                    headers = [str(value).strip() if value is not None else "" for value in values]
                    header_row_index = row_index
                    continue
                if headers is None or header_row_index is None or row_index <= header_row_index:
                    continue
                if not any(value not in (None, "") for value in values):
                    continue
                mapped_values: dict[str, object | None] = {
                    headers[index]: values[index] if index < len(values) else None
                    for index in range(len(headers))
                    if headers[index]
                }
                rows.append(ImportedSourceRow(sheet_name=sheet_name, row_index=row_index, values=mapped_values))
        return rows

    def _upsert_device_subject(
        self,
        *,
        connection: sqlite3.Connection,
        product_family: str | None,
        product_variant: str | None,
        catalogue_number: str | None,
        primary_udi_di: str | None,
        basic_udi_di: str | None,
        current_source_row_id: int,
        updated_at: str,
    ) -> bool:
        subject_key = self._subject_key(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
            primary_udi_di=primary_udi_di,
        )
        if subject_key is None:
            return False
        existing = connection.execute(
            "SELECT 1 FROM device_subject WHERE subject_key = ? LIMIT 1",
            (subject_key,),
        ).fetchone()
        connection.execute(
            """
            INSERT INTO device_subject (
                subject_key,
                product_family,
                product_variant,
                catalogue_number,
                primary_udi_di,
                basic_udi_di,
                current_source_row_id,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(subject_key)
            DO UPDATE SET
                product_family = excluded.product_family,
                product_variant = excluded.product_variant,
                catalogue_number = excluded.catalogue_number,
                primary_udi_di = excluded.primary_udi_di,
                basic_udi_di = excluded.basic_udi_di,
                current_source_row_id = excluded.current_source_row_id,
                updated_at = excluded.updated_at
            """,
            (
                subject_key,
                product_family,
                product_variant,
                catalogue_number,
                primary_udi_di,
                basic_udi_di,
                current_source_row_id,
                updated_at,
                updated_at,
            ),
        )
        return existing is None

    @staticmethod
    def _file_hash(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

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

    @classmethod
    def _subject_key(
        cls,
        *,
        product_family: str | None,
        product_variant: str | None,
        catalogue_number: str | None,
        primary_udi_di: str | None,
    ) -> str | None:
        family = cls._normalize_identity(product_family)
        variant = cls._normalize_identity(product_variant)
        catalogue = cls._normalize_identity(catalogue_number)
        primary = cls._normalize_identity(primary_udi_di)
        if not family or not variant or (not catalogue and not primary):
            return None
        return "|".join(part for part in (family, variant, catalogue or primary) if part)

    @staticmethod
    def _batch_summary_from_row(row: sqlite3.Row) -> WorkbookImportBatchSummary:
        return WorkbookImportBatchSummary(
            import_batch_id=int(row["id"]),
            source_type=str(row["source_type"]),
            label=str(row["label"]),
            imported_at=str(row["imported_at"]),
            imported_by=WorkbookImportService._optional_string(row["imported_by"]),
            notes=WorkbookImportService._optional_string(row["notes"]),
            workbook_count=int(row["workbook_count"]),
            source_row_count=int(row["source_row_count"]),
            device_subject_count=int(row["device_subject_count"]),
        )

    @staticmethod
    def _split_csv_values(value: object) -> list[str]:
        if value is None:
            return []
        return [item for item in (str(value).split(",") if value else []) if item]

    @staticmethod
    def _split_csv_ints(value: object) -> list[int]:
        if value is None:
            return []
        items: list[int] = []
        for part in str(value).split(","):
            part = part.strip()
            if not part:
                continue
            try:
                items.append(int(part))
            except ValueError:
                continue
        return items

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection
