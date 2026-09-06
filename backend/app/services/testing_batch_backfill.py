from __future__ import annotations

from collections.abc import Iterable
from dataclasses import asdict, dataclass
import sqlite3

from app.config import get_settings
from app.services.testing_state_store import TestingStateStore


@dataclass(frozen=True)
class TestingBatchBackfillResult:
    created_recorded_batches: int = 0
    created_acknowledgement_only_batches: int = 0
    created_transaction_recorded_batches: int = 0
    created_batch_devices: int = 0
    linked_acknowledgements: int = 0
    generated_only_batches: int = 0
    acknowledged_success_batches: int = 0
    acknowledged_partial_batches: int = 0
    skipped_existing_batches: int = 0
    unlinked_generated_events: int = 0
    unlinked_acknowledgement_events: int = 0

    def as_dict(self) -> dict[str, int]:
        return asdict(self)


class TestingBatchBackfillService:
    """Rebuild package-level audit links from existing immutable testing events."""

    __test__ = False

    def __init__(self) -> None:
        self.settings = get_settings()
        # Ensure the current schema is present before inspecting historical rows.
        TestingStateStore()

    @property
    def db_path(self):
        return self.settings.testing_state_db_path

    def run(self, *, apply: bool = False) -> TestingBatchBackfillResult:
        with self._connect() as connection:
            result = self._backfill(connection, apply=apply)
            if apply:
                connection.commit()
            return result

    def _backfill(self, connection: sqlite3.Connection, *, apply: bool) -> TestingBatchBackfillResult:
        counts = {
            "created_recorded_batches": 0,
            "created_acknowledgement_only_batches": 0,
            "created_transaction_recorded_batches": 0,
            "created_batch_devices": 0,
            "linked_acknowledgements": 0,
            "generated_only_batches": 0,
            "acknowledged_success_batches": 0,
            "acknowledged_partial_batches": 0,
            "skipped_existing_batches": 0,
            "unlinked_generated_events": 0,
            "unlinked_acknowledgement_events": 0,
        }
        existing_batch_ids = {
            str(row["batch_id"])
            for row in connection.execute("SELECT batch_id FROM testing_batches").fetchall()
        }
        generated_groups = connection.execute(
            """
            SELECT
                event.correlation_id,
                event.message_type,
                MIN(event.payload_created_at) AS created_at,
                MIN(event.operation_scope) AS operation_scope,
                MIN(event.product_family) AS product_family,
                MIN(event.product_variant) AS product_variant,
                MIN(event.basic_udi_di) AS basic_udi_di
            FROM testing_events event
            WHERE event.status = 'GENERATED'
              AND COALESCE(event.correlation_id, '') <> ''
            GROUP BY event.correlation_id, event.message_type
            ORDER BY MIN(event.payload_created_at), event.correlation_id
            """
        ).fetchall()

        for group in generated_groups:
            batch_id = str(group["correlation_id"])
            if batch_id in existing_batch_ids:
                counts["skipped_existing_batches"] += 1
                continue
            members = connection.execute(
                """
                SELECT id, subject_id
                FROM testing_events
                WHERE status = 'GENERATED'
                  AND correlation_id = ?
                  AND message_type = ?
                ORDER BY id
                """,
                (batch_id, group["message_type"]),
            ).fetchall()
            acknowledgements = self._acknowledgements_by_subject(
                connection,
                correlation_id=batch_id,
                message_type=str(group["message_type"]),
            )
            status = self._batch_status(acknowledgements.values())
            if status == "generated":
                counts["generated_only_batches"] += 1
            elif status == "acknowledged_success":
                counts["acknowledged_success_batches"] += 1
            else:
                counts["acknowledged_partial_batches"] += 1
            counts["created_recorded_batches"] += 1
            counts["created_batch_devices"] += len(members)
            counts["linked_acknowledgements"] += len(acknowledgements)
            if apply:
                self._insert_batch(
                    connection,
                    batch_id=batch_id,
                    message_type=str(group["message_type"]),
                    operation_scope=str(group["operation_scope"] or "legacy"),
                    product_family=group["product_family"],
                    product_variant=group["product_variant"],
                    basic_udi_di=group["basic_udi_di"],
                    created_at=str(group["created_at"]),
                    acknowledgements=acknowledgements,
                    status=status,
                    lineage_source="backfilled_recorded",
                )
                for member in members:
                    acknowledgement = acknowledgements.get(int(member["subject_id"]))
                    self._insert_batch_device(
                        connection,
                        batch_id=batch_id,
                        subject_id=int(member["subject_id"]),
                        generated_event_id=int(member["id"]),
                        acknowledgement=acknowledgement,
                    )
            existing_batch_ids.add(batch_id)

        transaction_groups = connection.execute(
            """
            SELECT message_type, transaction_id, submission_id, MIN(tested_at) AS created_at,
                   MIN(subject.product_family) AS product_family, MIN(subject.product_variant) AS product_variant,
                   MIN(subject.basic_udi_di) AS basic_udi_di
            FROM testing_events event JOIN testing_subjects subject ON subject.id = event.subject_id
            WHERE event.status IN ('SUCCESS', 'ERROR') AND COALESCE(event.correlation_id, '') = ''
              AND COALESCE(event.transaction_id, '') <> ''
            GROUP BY message_type, transaction_id, submission_id
            ORDER BY MIN(tested_at), transaction_id
            """
        ).fetchall()
        for group in transaction_groups:
            batch_id = f"legacy-transaction:{group['transaction_id']}"
            if batch_id in existing_batch_ids:
                counts["skipped_existing_batches"] += 1
                continue
            rows = connection.execute(
                """
                SELECT id, subject_id, status, message_id, source_file_name, tested_at
                FROM testing_events
                WHERE message_type = ? AND transaction_id = ?
                  AND COALESCE(submission_id, '') = COALESCE(?, '')
                  AND status IN ('SUCCESS', 'ERROR')
                ORDER BY id
                """,
                (group["message_type"], group["transaction_id"], group["submission_id"]),
            ).fetchall()
            acknowledgements = {int(row["subject_id"]): row for row in rows}
            status = self._batch_status(acknowledgements.values())
            counts["created_transaction_recorded_batches"] += 1
            counts["created_batch_devices"] += len(acknowledgements)
            counts["linked_acknowledgements"] += len(acknowledgements)
            counts["acknowledged_success_batches" if status == "acknowledged_success" else "acknowledged_partial_batches"] += 1
            if apply:
                self._insert_batch(connection, batch_id=batch_id, message_type=str(group["message_type"]),
                    operation_scope="legacy_transaction_recorded", product_family=group["product_family"],
                    product_variant=group["product_variant"], basic_udi_di=group["basic_udi_di"],
                    created_at=str(group["created_at"]), acknowledgements=acknowledgements, status=status,
                    lineage_source="backfilled_transaction_recorded")
                for subject_id, acknowledgement in acknowledgements.items():
                    self._insert_batch_device(connection, batch_id=batch_id, subject_id=subject_id,
                        generated_event_id=None, acknowledgement=acknowledgement)
            existing_batch_ids.add(batch_id)

        acknowledgement_only_groups = connection.execute(
            """
            SELECT
                event.correlation_id,
                event.message_type,
                MIN(event.tested_at) AS created_at,
                MIN(subject.product_family) AS product_family,
                MIN(subject.product_variant) AS product_variant,
                MIN(subject.basic_udi_di) AS basic_udi_di
            FROM testing_events event
            JOIN testing_subjects subject ON subject.id = event.subject_id
            WHERE event.status IN ('SUCCESS', 'ERROR')
              AND COALESCE(event.correlation_id, '') <> ''
              AND NOT EXISTS (
                  SELECT 1
                  FROM testing_events generated
                  WHERE generated.status = 'GENERATED'
                    AND generated.correlation_id = event.correlation_id
                    AND generated.message_type = event.message_type
              )
            GROUP BY event.correlation_id, event.message_type
            ORDER BY MIN(event.tested_at), event.correlation_id
            """
        ).fetchall()
        for group in acknowledgement_only_groups:
            batch_id = str(group["correlation_id"])
            if batch_id in existing_batch_ids:
                counts["skipped_existing_batches"] += 1
                continue
            acknowledgements = self._acknowledgements_by_subject(
                connection,
                correlation_id=batch_id,
                message_type=str(group["message_type"]),
            )
            status = self._batch_status(acknowledgements.values())
            counts["created_acknowledgement_only_batches"] += 1
            counts["created_batch_devices"] += len(acknowledgements)
            counts["linked_acknowledgements"] += len(acknowledgements)
            if status == "acknowledged_success":
                counts["acknowledged_success_batches"] += 1
            else:
                counts["acknowledged_partial_batches"] += 1
            if apply:
                self._insert_batch(
                    connection,
                    batch_id=batch_id,
                    message_type=str(group["message_type"]),
                    operation_scope="legacy_acknowledgement_only",
                    product_family=group["product_family"],
                    product_variant=group["product_variant"],
                    basic_udi_di=group["basic_udi_di"],
                    created_at=str(group["created_at"]),
                    acknowledgements=acknowledgements,
                    status=status,
                    lineage_source="backfilled_acknowledgement_only",
                )
                for subject_id, acknowledgement in acknowledgements.items():
                    self._insert_batch_device(
                        connection,
                        batch_id=batch_id,
                        subject_id=subject_id,
                        generated_event_id=None,
                        acknowledgement=acknowledgement,
                    )
            existing_batch_ids.add(batch_id)

        counts["unlinked_generated_events"] = int(
            connection.execute(
                "SELECT COUNT(*) FROM testing_events WHERE status = 'GENERATED' AND COALESCE(correlation_id, '') = ''"
            ).fetchone()[0]
        )
        counts["unlinked_acknowledgement_events"] = int(
            connection.execute(
                """
                SELECT COUNT(*)
                FROM testing_events
                WHERE status IN ('SUCCESS', 'ERROR')
                  AND COALESCE(correlation_id, '') = ''
                  AND COALESCE(transaction_id, '') = ''
                """
            ).fetchone()[0]
        )
        return TestingBatchBackfillResult(**counts)

    @staticmethod
    def _acknowledgements_by_subject(
        connection: sqlite3.Connection,
        *,
        correlation_id: str,
        message_type: str,
    ) -> dict[int, sqlite3.Row]:
        rows = connection.execute(
            """
            SELECT id, subject_id, status, message_id, source_file_name, tested_at
            FROM testing_events
            WHERE correlation_id = ?
              AND message_type = ?
              AND status IN ('SUCCESS', 'ERROR')
            ORDER BY id
            """,
            (correlation_id, message_type),
        ).fetchall()
        return {int(row["subject_id"]): row for row in rows}

    @staticmethod
    def _batch_status(acknowledgements: Iterable[sqlite3.Row]) -> str:
        rows = list(acknowledgements)
        if not rows:
            return "generated"
        return "acknowledged_partial" if any(row["status"] != "SUCCESS" for row in rows) else "acknowledged_success"

    @staticmethod
    def _insert_batch(
        connection: sqlite3.Connection,
        *,
        batch_id: str,
        message_type: str,
        operation_scope: str,
        product_family: object,
        product_variant: object,
        basic_udi_di: object,
        created_at: str,
        acknowledgements: dict[int, sqlite3.Row],
        status: str,
        lineage_source: str,
    ) -> None:
        first_acknowledgement = next(iter(acknowledgements.values()), None)
        connection.execute(
            """
            INSERT INTO testing_batches (
                batch_id, message_type, operation_scope, product_family, product_variant, basic_udi_di,
                created_at, acknowledgement_message_id, acknowledgement_source_file_name, acknowledged_at, status, lineage_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                batch_id,
                message_type,
                operation_scope,
                product_family,
                product_variant,
                basic_udi_di,
                created_at,
                first_acknowledgement["message_id"] if first_acknowledgement is not None else None,
                first_acknowledgement["source_file_name"] if first_acknowledgement is not None else None,
                first_acknowledgement["tested_at"] if first_acknowledgement is not None else None,
                status,
                lineage_source,
            ),
        )

    @staticmethod
    def _insert_batch_device(
        connection: sqlite3.Connection,
        *,
        batch_id: str,
        subject_id: int,
        generated_event_id: int | None,
        acknowledgement: sqlite3.Row | None,
    ) -> None:
        connection.execute(
            """
            INSERT INTO testing_batch_devices (
                batch_id, subject_id, generated_event_id, acknowledgement_event_id, outcome_status
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                batch_id,
                subject_id,
                generated_event_id,
                int(acknowledgement["id"]) if acknowledgement is not None else None,
                acknowledgement["status"] if acknowledgement is not None else None,
            ),
        )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection
