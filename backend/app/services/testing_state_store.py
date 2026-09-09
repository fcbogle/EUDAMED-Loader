from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import hashlib
from io import BytesIO
from zipfile import ZipFile
import json
import sqlite3
from typing import Any

from app.services.identity import normalize_identity, normalized_family_candidates
from app.services.accepted_state import accepted_device_state, accepted_post_state, accepted_market_state
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

    def record_generated_package(
        self,
        *,
        package_file_name: str,
        flow: str,
        operation_scope: str,
        product_family: str | None,
        product_variant: str | None,
        catalogue_number: str | None,
        basic_udi_di: str | None,
        members: list[tuple[str, bytes]],
        manifest: dict[str, Any],
        package_bytes: bytes,
        confirms_review: bool = False,
    ) -> None:
        """Record package metadata; an explicit ZIP download reviews only these bytes.

        Creation alone is not review. Historical rows are never backfilled as reviewed.
        A review receipt fingerprints every archive member, including the manifest,
        without copying XML or ZIP contents into the database.
        """
        created_at = datetime.now(UTC).isoformat(timespec="milliseconds")
        member_file_names = [file_name for file_name, _ in members]
        xml_member_count = sum(file_name.lower().endswith(".xml") for file_name in member_file_names)
        reviewed_members = None
        if confirms_review:
            with ZipFile(BytesIO(package_bytes)) as archive:
                reviewed_members = [
                    {"file_name": member.filename, "sha256": hashlib.sha256(archive.read(member)).hexdigest()}
                    for member in archive.infolist() if not member.is_dir()
                ]
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO generated_packages (
                    created_at,
                    flow,
                    operation_scope,
                    product_family,
                    product_variant,
                    catalogue_number,
                    basic_udi_di,
                    package_file_name,
                    package_byte_count,
                    member_count,
                    xml_member_count,
                    member_file_names_json,
                    manifest_json,
                    package_sha256,
                    reviewed_at,
                    review_basis,
                    reviewed_members_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    created_at,
                    flow,
                    operation_scope,
                    self._optional_string(product_family),
                    self._optional_string(product_variant),
                    self._optional_string(catalogue_number),
                    self._optional_string(basic_udi_di),
                    package_file_name,
                    len(package_bytes),
                    len(member_file_names),
                    xml_member_count,
                    json.dumps(member_file_names),
                    json.dumps(manifest, sort_keys=True),
                    hashlib.sha256(package_bytes).hexdigest(),
                    created_at if confirms_review else None,
                    "zip_download" if confirms_review else None,
                    json.dumps(reviewed_members, sort_keys=True) if confirms_review else None,
                ),
            )
            if confirms_review and flow == "post_registration" and product_family and product_variant and catalogue_number:
                self._record_post_review_history(
                    connection, product_family=product_family,
                    product_variant=product_variant, catalogue_number=catalogue_number,
                )

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
        if row is None:
            return None
        with self._connect() as connection:
            latest_state = accepted_device_state(connection, row)
        if latest_state is None:
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

    def latest_successful_market_info_state(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> dict[str, Any] | None:
        row = self._subject_row(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        if row is None:
            return None
        with self._connect() as connection:
            return accepted_market_state(connection, row)

    def accepted_post_state(self, *, product_family: str, product_variant: str, catalogue_number: str) -> dict[str, Any] | None:
        row = self._subject_row(product_family=product_family, product_variant=product_variant, catalogue_number=catalogue_number)
        if row is None:
            return None
        with self._connect() as connection:
            return accepted_post_state(connection, row)

    def latest_successful_market_info_version(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> str | None:
        row = self._subject_row(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        if row is None:
            return None
        return self._optional_string(row["latest_successful_market_info_version"])

    def latest_observed_market_info_version(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> str | None:
        """Return the highest Market Info version reported by EUDAMED for this device."""
        row = self._subject_row(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        if row is None:
            return None
        return self._optional_string(row["latest_observed_market_info_version"])

    def record_observed_market_info_version(
        self,
        connection: sqlite3.Connection,
        *,
        subject_id: int,
        version: str,
    ) -> None:
        """Keep a monotonic EUDAMED version floor without changing accepted state."""
        try:
            observed_version = int(str(version).strip())
        except (TypeError, ValueError):
            return
        if observed_version < 1:
            return
        row = connection.execute(
            "SELECT latest_observed_market_info_version FROM testing_subjects WHERE id = ?",
            (subject_id,),
        ).fetchone()
        try:
            current_version = int(str(row["latest_observed_market_info_version"] or "0").strip()) if row else 0
        except (TypeError, ValueError):
            current_version = 0
        if observed_version <= current_version:
            return
        connection.execute(
            "UPDATE testing_subjects SET latest_observed_market_info_version = ? WHERE id = ?",
            (str(observed_version), subject_id),
        )

    def has_pending_market_info_update_error(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> bool:
        row = self._subject_row(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        if row is None:
            return False
        with self._connect() as connection:
            error_row = connection.execute(
                """
                SELECT event_index
                FROM testing_events
                WHERE subject_id = ?
                  AND message_type = 'UDI_DI.PATCH'
                  AND event_kind = 'error_ack'
                  AND status = 'ERROR'
                  AND raw_event_json LIKE '%Update of Market Information service%'
                ORDER BY event_index DESC
                LIMIT 1
                """,
                (int(row["id"]),),
            ).fetchone()
            if error_row is None:
                return False
            market_info_success_row = connection.execute(
                """
                SELECT event_index
                FROM testing_events
                WHERE subject_id = ?
                  AND message_type = 'MARKET_INFO.PUT'
                  AND event_kind = 'success_ack'
                  AND status = 'SUCCESS'
                ORDER BY event_index DESC
                LIMIT 1
                """,
                (int(row["id"]),),
            ).fetchone()
        return market_info_success_row is None or int(market_info_success_row["event_index"]) <= int(error_row["event_index"])

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
                SELECT catalogue_number, primary_udi_di, basic_udi_di, latest_successful_version, latest_successful_market_info_version, baseline_patch_success
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
                "latest_market_info_version": self._optional_string(row["latest_successful_market_info_version"]),
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

    def _record_post_review_history(
        self,
        connection: sqlite3.Connection,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> None:
        """Maintain the legacy POST history indicator after its ZIP receipt is recorded."""
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
        """Historical POST download indicator; never proof that a current draft was reviewed."""
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

    def record_generated_patch_context(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
        primary_udi_di: str,
        basic_udi_di: str | None,
        patch_version: str,
        scenario_id: str,
        scenario_label: str,
        base_message_type: str,
        base_version: str,
        accepted_state_source: str,
        changed_fields: list[dict[str, Any]],
        state_before: dict[str, Any],
        latest_successful_state: dict[str, Any],
        correlation_id: str | None = None,
        message_id: str | None = None,
        operation_scope: str = "single",
    ) -> None:
        with self._connect() as connection:
            subject_id = self._ensure_testing_subject(
                connection,
                product_family=product_family,
                product_variant=product_variant,
                catalogue_number=catalogue_number,
                primary_udi_di=primary_udi_di,
                basic_udi_di=basic_udi_di,
            )
            payload_created_at = datetime.now(UTC).isoformat(timespec="milliseconds")
            raw_event_json = json.dumps(
                {
                    "message_type": "UDI_DI.PATCH",
                    "status": "GENERATED",
                    "event_kind": "generated",
                    "operation_scope": operation_scope,
                    "scenario_id": scenario_id,
                    "scenario_label": scenario_label,
                    "catalogue_number": catalogue_number,
                    "primary_udi_di": primary_udi_di,
                    "basic_udi_di": basic_udi_di,
                    "version": patch_version,
                    "base_message_type": base_message_type,
                    "base_version": base_version,
                    "derived_version": patch_version,
                    "accepted_state_source": accepted_state_source,
                    "correlation_id": correlation_id,
                    "message_id": message_id,
                    "state_before": state_before,
                    "latest_successful_state": latest_successful_state,
                }
            )
            changed_fields_json = json.dumps(changed_fields)
            state_before_json = json.dumps(state_before)
            state_after_json = json.dumps(latest_successful_state)
            delta_json = json.dumps({"changed_fields": changed_fields})

            next_index_row = connection.execute(
                "SELECT COALESCE(MAX(event_index), -1) + 1 FROM testing_events WHERE subject_id = ?",
                (subject_id,),
            ).fetchone()
            next_index = int(next_index_row[0]) if next_index_row is not None else 0
            connection.execute(
                """
                INSERT INTO testing_events (
                    subject_id,
                    event_index,
                    message_type,
                    event_kind,
                    status,
                    operation_scope,
                    batch_id,
                    version,
                    base_message_type,
                    base_version,
                    derived_version,
                    accepted_state_source,
                    scenario_id,
                    scenario_label,
                    product_family,
                    product_variant,
                    catalogue_number,
                    primary_udi_di,
                    basic_udi_di,
                    tested_at,
                    transaction_id,
                    submission_id,
                    payload_created_at,
                    correlation_id,
                    message_id,
                    source_file_name,
                    state_before_json,
                    state_after_json,
                    delta_json,
                    changed_fields_json,
                    retained_fields_json,
                    unchanged_fields_json,
                    raw_event_json,
                    raw_xml
                ) VALUES (?, ?, 'UDI_DI.PATCH', 'generated', 'GENERATED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    subject_id,
                    next_index,
                    operation_scope,
                    None,
                    patch_version,
                    base_message_type,
                    base_version,
                    patch_version,
                    accepted_state_source,
                    scenario_id,
                    scenario_label,
                    self._optional_string(product_family),
                    self._optional_string(product_variant),
                    self._optional_string(catalogue_number),
                    self._optional_string(primary_udi_di),
                    self._optional_string(basic_udi_di),
                    None,
                    None,
                    None,
                    payload_created_at,
                    correlation_id,
                    message_id,
                    None,
                    state_before_json,
                    state_after_json,
                    delta_json,
                    changed_fields_json,
                    None,
                    None,
                    raw_event_json,
                    None,
                ),
            )
            generated_event_id = int(connection.execute("SELECT last_insert_rowid()").fetchone()[0])
            self.record_generated_batch_device(
                connection,
                batch_id=correlation_id,
                message_type="UDI_DI.PATCH",
                operation_scope=operation_scope,
                product_family=product_family,
                product_variant=product_variant,
                basic_udi_di=basic_udi_di,
                subject_id=subject_id,
                generated_event_id=generated_event_id,
                created_at=payload_created_at,
            )

    def record_generated_post_context(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
        primary_udi_di: str,
        basic_udi_di: str | None,
        message_type: str,
        accepted_post_state: dict[str, Any],
        correlation_id: str | None = None,
        message_id: str | None = None,
        operation_scope: str = "single",
    ) -> None:
        with self._connect() as connection:
            subject_id = self._ensure_testing_subject(
                connection,
                product_family=product_family,
                product_variant=product_variant,
                catalogue_number=catalogue_number,
                primary_udi_di=primary_udi_di,
                basic_udi_di=basic_udi_di,
            )
            payload_created_at = datetime.now(UTC).isoformat(timespec="milliseconds")
            accepted_post_state_json = json.dumps(accepted_post_state)
            raw_event_json = json.dumps(
                {
                    "message_type": message_type,
                    "status": "GENERATED",
                    "event_kind": "generated",
                    "operation_scope": operation_scope,
                    "catalogue_number": catalogue_number,
                    "primary_udi_di": primary_udi_di,
                    "basic_udi_di": basic_udi_di,
                    "correlation_id": correlation_id,
                    "message_id": message_id,
                    "version": accepted_post_state.get("version"),
                    "state_after": accepted_post_state,
                }
            )

            next_index_row = connection.execute(
                "SELECT COALESCE(MAX(event_index), -1) + 1 FROM testing_events WHERE subject_id = ?",
                (subject_id,),
            ).fetchone()
            next_index = int(next_index_row[0]) if next_index_row is not None else 0
            connection.execute(
                """
                INSERT INTO testing_events (
                    subject_id,
                    event_index,
                    message_type,
                    event_kind,
                    status,
                    operation_scope,
                    batch_id,
                    version,
                    base_message_type,
                    base_version,
                    derived_version,
                    accepted_state_source,
                    scenario_id,
                    scenario_label,
                    product_family,
                    product_variant,
                    catalogue_number,
                    primary_udi_di,
                    basic_udi_di,
                    tested_at,
                    transaction_id,
                    submission_id,
                    payload_created_at,
                    correlation_id,
                    message_id,
                    source_file_name,
                    state_before_json,
                    state_after_json,
                    delta_json,
                    changed_fields_json,
                    retained_fields_json,
                    unchanged_fields_json,
                    raw_event_json,
                    raw_xml
                ) VALUES (?, ?, ?, 'generated', 'GENERATED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    subject_id,
                    next_index,
                    message_type,
                    operation_scope,
                    None,
                    self._optional_string(accepted_post_state.get("version")),
                    None,
                    None,
                    self._optional_string(accepted_post_state.get("version")),
                    "generated_post_preview",
                    None,
                    None,
                    self._optional_string(product_family),
                    self._optional_string(product_variant),
                    self._optional_string(catalogue_number),
                    self._optional_string(primary_udi_di),
                    self._optional_string(basic_udi_di),
                    None,
                    None,
                    None,
                    payload_created_at,
                    correlation_id,
                    message_id,
                    None,
                    None,
                    accepted_post_state_json,
                    None,
                    None,
                    None,
                    None,
                    raw_event_json,
                    None,
                ),
            )
            generated_event_id = int(connection.execute("SELECT last_insert_rowid()").fetchone()[0])
            self.record_generated_batch_device(
                connection,
                batch_id=correlation_id,
                message_type=message_type,
                operation_scope=operation_scope,
                product_family=product_family,
                product_variant=product_variant,
                basic_udi_di=basic_udi_di,
                subject_id=subject_id,
                generated_event_id=generated_event_id,
                created_at=payload_created_at,
            )

    def record_generated_market_info_context(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
        primary_udi_di: str,
        basic_udi_di: str | None,
        market_info_version: str,
        baseline_market_countries: list[dict[str, Any]],
        market_countries: list[dict[str, Any]],
        correlation_id: str | None = None,
        message_id: str | None = None,
        operation_scope: str = "single",
    ) -> None:
        with self._connect() as connection:
            subject_id = self._ensure_testing_subject(
                connection,
                product_family=product_family,
                product_variant=product_variant,
                catalogue_number=catalogue_number,
                primary_udi_di=primary_udi_di,
                basic_udi_di=basic_udi_di,
            )
            payload_created_at = datetime.now(UTC).isoformat(timespec="milliseconds")
            raw_event_json = json.dumps(
                {
                    "message_type": "MARKET_INFO.PUT",
                    "status": "GENERATED",
                    "event_kind": "generated",
                    "operation_scope": operation_scope,
                    "catalogue_number": catalogue_number,
                    "primary_udi_di": primary_udi_di,
                    "basic_udi_di": basic_udi_di,
                    "correlation_id": correlation_id,
                    "message_id": message_id,
                    "market_info_version": market_info_version,
                    "baseline_market_info_state": {
                        "market_countries": baseline_market_countries,
                    },
                    "latest_successful_market_info_state": {
                        "version": market_info_version,
                        "market_countries": market_countries,
                    },
                }
            )

            next_index_row = connection.execute(
                "SELECT COALESCE(MAX(event_index), -1) + 1 FROM testing_events WHERE subject_id = ?",
                (subject_id,),
            ).fetchone()
            next_index = int(next_index_row[0]) if next_index_row is not None else 0
            connection.execute(
                """
                INSERT INTO testing_events (
                    subject_id,
                    event_index,
                    message_type,
                    event_kind,
                    status,
                    operation_scope,
                    batch_id,
                    version,
                    base_message_type,
                    base_version,
                    derived_version,
                    accepted_state_source,
                    scenario_id,
                    scenario_label,
                    product_family,
                    product_variant,
                    catalogue_number,
                    primary_udi_di,
                    basic_udi_di,
                    tested_at,
                    transaction_id,
                    submission_id,
                    payload_created_at,
                    correlation_id,
                    message_id,
                    source_file_name,
                    state_before_json,
                    state_after_json,
                    delta_json,
                    changed_fields_json,
                    retained_fields_json,
                    unchanged_fields_json,
                    raw_event_json,
                    raw_xml
                ) VALUES (?, ?, 'MARKET_INFO.PUT', 'generated', 'GENERATED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    subject_id,
                    next_index,
                    operation_scope,
                    None,
                    market_info_version,
                    None,
                    self._previous_market_info_version(market_info_version),
                    market_info_version,
                    "market_info_generation",
                    None,
                    None,
                    self._optional_string(product_family),
                    self._optional_string(product_variant),
                    self._optional_string(catalogue_number),
                    self._optional_string(primary_udi_di),
                    self._optional_string(basic_udi_di),
                    None,
                    None,
                    None,
                    payload_created_at,
                    correlation_id,
                    message_id,
                    None,
                    json.dumps({"market_countries": baseline_market_countries}),
                    json.dumps({"version": market_info_version, "market_countries": market_countries}),
                    json.dumps(self._market_info_delta_payload(baseline_market_countries, market_countries)),
                    None,
                    None,
                    None,
                    raw_event_json,
                    None,
                ),
            )
            generated_event_id = int(connection.execute("SELECT last_insert_rowid()").fetchone()[0])
            self.record_generated_batch_device(
                connection,
                batch_id=correlation_id,
                message_type="MARKET_INFO.PUT",
                operation_scope=operation_scope,
                product_family=product_family,
                product_variant=product_variant,
                basic_udi_di=basic_udi_di,
                subject_id=subject_id,
                generated_event_id=generated_event_id,
                created_at=payload_created_at,
            )

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

    @classmethod
    def _previous_market_info_version(cls, market_info_version: str) -> str | None:
        try:
            version_number = int(str(market_info_version).strip())
        except (TypeError, ValueError):
            return None
        return str(version_number - 1) if version_number > 1 else None

    @classmethod
    def _market_info_delta_payload(
        cls,
        before_items: list[dict[str, Any]],
        after_items: list[dict[str, Any]],
    ) -> dict[str, Any]:
        before_codes = {
            cls._optional_string(item.get("country"))
            for item in before_items
            if isinstance(item, dict)
        }
        after_codes = {
            cls._optional_string(item.get("country"))
            for item in after_items
            if isinstance(item, dict)
        }
        before_codes = {code for code in before_codes if code}
        after_codes = {code for code in after_codes if code}
        return {
            "added_countries": sorted(after_codes - before_codes),
            "removed_countries": sorted(before_codes - after_codes),
        }

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
                    latest_successful_market_info_version TEXT,
                    latest_observed_market_info_version TEXT,
                    latest_successful_market_info_state_json TEXT,
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
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS generated_packages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    flow TEXT NOT NULL,
                    operation_scope TEXT NOT NULL,
                    product_family TEXT,
                    product_variant TEXT,
                    catalogue_number TEXT,
                    basic_udi_di TEXT,
                    package_file_name TEXT NOT NULL,
                    package_byte_count INTEGER NOT NULL,
                    member_count INTEGER NOT NULL,
                    xml_member_count INTEGER NOT NULL,
                    member_file_names_json TEXT NOT NULL,
                    manifest_json TEXT NOT NULL,
                    package_sha256 TEXT NOT NULL,
                    reviewed_at TEXT,
                    review_basis TEXT,
                    reviewed_members_json TEXT
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS testing_batches (
                    batch_id TEXT PRIMARY KEY,
                    message_type TEXT NOT NULL,
                    operation_scope TEXT NOT NULL,
                    product_family TEXT,
                    product_variant TEXT,
                    basic_udi_di TEXT,
                    created_at TEXT NOT NULL,
                    acknowledgement_message_id TEXT,
                    acknowledgement_source_file_name TEXT,
                    acknowledged_at TEXT,
                    status TEXT NOT NULL DEFAULT 'generated',
                    lineage_source TEXT NOT NULL DEFAULT 'recorded'
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS testing_batch_devices (
                    batch_id TEXT NOT NULL REFERENCES testing_batches(batch_id) ON DELETE CASCADE,
                    subject_id INTEGER NOT NULL REFERENCES testing_subjects(id) ON DELETE CASCADE,
                    generated_event_id INTEGER REFERENCES testing_events(id) ON DELETE SET NULL,
                    acknowledgement_event_id INTEGER REFERENCES testing_events(id) ON DELETE SET NULL,
                    outcome_status TEXT,
                    PRIMARY KEY (batch_id, subject_id)
                )
                """
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="registration_status",
                column_definition="TEXT NOT NULL DEFAULT 'unregistered'",
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="latest_successful_post_version",
                column_definition="TEXT",
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="latest_successful_post_state_json",
                column_definition="TEXT",
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="latest_successful_patch_version",
                column_definition="TEXT",
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="latest_successful_patch_state_json",
                column_definition="TEXT",
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="latest_successful_market_info_version",
                column_definition="TEXT",
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="latest_observed_market_info_version",
                column_definition="TEXT",
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="latest_successful_market_info_state_json",
                column_definition="TEXT",
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="device_subject_id",
                column_definition="INTEGER REFERENCES device_subject(id) ON DELETE SET NULL",
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="latest_successful_message_type",
                column_definition="TEXT",
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="latest_successful_event_id",
                column_definition="INTEGER",
            )
            self._ensure_column(
                connection,
                table_name="testing_subjects",
                column_name="latest_tested_at",
                column_definition="TEXT",
            )
            for column_name, column_definition in (
                ("event_kind", "TEXT"),
                ("operation_scope", "TEXT"),
                ("batch_id", "TEXT"),
                ("base_message_type", "TEXT"),
                ("base_version", "TEXT"),
                ("derived_version", "TEXT"),
                ("accepted_state_source", "TEXT"),
                ("product_family", "TEXT"),
                ("product_variant", "TEXT"),
                ("catalogue_number", "TEXT"),
                ("primary_udi_di", "TEXT"),
                ("basic_udi_di", "TEXT"),
                ("source_file_name", "TEXT"),
                ("state_before_json", "TEXT"),
                ("state_after_json", "TEXT"),
                ("delta_json", "TEXT"),
                ("raw_xml", "TEXT"),
            ):
                self._ensure_column(
                    connection,
                    table_name="testing_events",
                    column_name=column_name,
                    column_definition=column_definition,
                )
            # Additive migration: previous package creation does not prove review.
            for column_name in ("reviewed_at", "review_basis", "reviewed_members_json"):
                self._ensure_column(
                    connection, table_name="generated_packages", column_name=column_name,
                    column_definition="TEXT",
                )
            self._ensure_column(
                connection,
                table_name="reviewed_post_baselines",
                column_name="device_subject_id",
                column_definition="INTEGER REFERENCES device_subject(id) ON DELETE SET NULL",
            )
            self._ensure_column(
                connection,
                table_name="testing_batches",
                column_name="lineage_source",
                column_definition="TEXT NOT NULL DEFAULT 'recorded'",
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_testing_subjects_device_subject_id ON testing_subjects(device_subject_id)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_testing_subjects_family_variant ON testing_subjects(normalized_product_family, normalized_product_variant)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_testing_subjects_catalogue ON testing_subjects(normalized_catalogue_number)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_testing_subjects_primary_udi ON testing_subjects(normalized_primary_udi_di)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_testing_subjects_basic_udi ON testing_subjects(normalized_basic_udi_di)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_reviewed_post_baselines_device_subject_id ON reviewed_post_baselines(device_subject_id)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_testing_events_subject_event_index ON testing_events(subject_id, event_index)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_testing_events_subject_tested_at ON testing_events(subject_id, tested_at)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_testing_events_message_kind_status ON testing_events(message_type, event_kind, status)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_testing_events_batch_id ON testing_events(batch_id)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_testing_events_correlation_message ON testing_events(correlation_id, message_id)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_generated_packages_created_at ON generated_packages(created_at)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_generated_packages_scope ON generated_packages(product_family, product_variant, flow)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_testing_batch_devices_subject_id ON testing_batch_devices(subject_id)"
            )
            self._backfill_device_subject_links(connection)

    @staticmethod
    def record_generated_batch_device(
        connection: sqlite3.Connection,
        *,
        batch_id: str | None,
        message_type: str,
        operation_scope: str,
        product_family: str,
        product_variant: str,
        basic_udi_di: str | None,
        subject_id: int,
        generated_event_id: int,
        created_at: str,
    ) -> None:
        if not batch_id:
            return
        connection.execute(
            """
            INSERT INTO testing_batches (
                batch_id, message_type, operation_scope, product_family, product_variant, basic_udi_di, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(batch_id) DO NOTHING
            """,
            (batch_id, message_type, operation_scope, product_family, product_variant, basic_udi_di, created_at),
        )
        connection.execute(
            """
            INSERT INTO testing_batch_devices (batch_id, subject_id, generated_event_id)
            VALUES (?, ?, ?)
            ON CONFLICT(batch_id, subject_id) DO UPDATE SET generated_event_id = excluded.generated_event_id
            """,
            (batch_id, subject_id, generated_event_id),
        )

    @staticmethod
    def record_batch_acknowledgement(
        connection: sqlite3.Connection,
        *,
        batch_id: str | None,
        subject_id: int,
        acknowledgement_event_id: int,
        outcome_status: str,
        acknowledgement_message_id: str | None,
        source_file_name: str | None,
        acknowledged_at: str | None,
    ) -> None:
        if not batch_id:
            return
        connection.execute(
            """
            UPDATE testing_batch_devices
            SET acknowledgement_event_id = ?, outcome_status = ?
            WHERE batch_id = ? AND subject_id = ?
            """,
            (acknowledgement_event_id, outcome_status, batch_id, subject_id),
        )
        connection.execute(
            """
            UPDATE testing_batches
            SET acknowledgement_message_id = ?, acknowledgement_source_file_name = ?, acknowledged_at = ?,
                status = CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM testing_batch_devices
                        WHERE batch_id = testing_batches.batch_id
                          AND outcome_status <> 'SUCCESS'
                    ) THEN 'acknowledged_partial'
                    ELSE 'acknowledged_success'
                END
            WHERE batch_id = ?
            """,
            (acknowledgement_message_id, source_file_name, acknowledged_at, batch_id),
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

    def _ensure_testing_subject(
        self,
        connection: sqlite3.Connection,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
        primary_udi_di: str,
        basic_udi_di: str | None,
    ) -> int:
        subject_row = connection.execute(
            """
            SELECT id
            FROM testing_subjects
            WHERE normalized_product_family IN ({family_placeholders})
              AND normalized_product_variant = ?
              AND normalized_catalogue_number = ?
            LIMIT 1
            """.format(
                family_placeholders=", ".join("?" for _ in self._normalized_family_candidates(product_family)),
            ),
            (
                *self._normalized_family_candidates(product_family),
                self._normalize_identity(product_variant),
                self._normalize_identity(catalogue_number),
            ),
        ).fetchone()
        if subject_row is not None:
            return int(subject_row["id"])

        device_subject_id = self._resolve_device_subject_id(
            connection,
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
            primary_udi_di=primary_udi_di,
        )
        subject_key = self._normalize_identity(
            f"{product_family}|{product_variant}|{catalogue_number}|{primary_udi_di or basic_udi_di or ''}"
        )
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
                source_workbook,
                source_sheet,
                source_row_index,
                post_success,
                baseline_patch_success,
                exclude_from_post_wave,
                exclude_from_baseline_patch_wave,
                latest_successful_version,
                latest_successful_market_info_version,
                latest_successful_market_info_state_json,
                latest_successful_state_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0, 0, 0, NULL, NULL, NULL, NULL)
            """,
            (
                subject_key,
                device_subject_id,
                self._normalize_identity(product_family),
                self._normalize_identity(product_variant),
                self._normalize_identity(catalogue_number),
                self._normalize_identity(primary_udi_di),
                self._normalize_identity(basic_udi_di),
                self._optional_string(product_family),
                self._optional_string(product_variant),
                self._optional_string(catalogue_number),
                self._optional_string(primary_udi_di),
                self._optional_string(basic_udi_di),
            ),
        )
        inserted_row = connection.execute("SELECT last_insert_rowid()").fetchone()
        if inserted_row is None:
            raise ValueError("Testing subject insert succeeded but no row id was returned.")
        return int(inserted_row[0])

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

    _normalized_family_candidates = staticmethod(normalized_family_candidates)

    @classmethod
    def _family_match_clause(cls, product_family: object, *, table_name: str) -> tuple[str, tuple[str, ...]]:
        family_candidates = cls._normalized_family_candidates(product_family)
        if not family_candidates:
            return f"{table_name}.normalized_product_family = ''", ()
        clauses: list[str] = []
        params: list[str] = []
        for candidate in family_candidates:
            clauses.append(
                f"({table_name}.normalized_product_family = ? "
                f"OR {table_name}.normalized_product_family LIKE ? "
                f"OR {table_name}.normalized_product_family LIKE ? "
                f"OR {table_name}.normalized_product_family LIKE ?)"
            )
            params.extend(
                (
                    candidate,
                    f"{candidate}/%",
                    f"%/{candidate}",
                    f"%/{candidate}/%",
                )
            )
        if len(clauses) == 1:
            return clauses[0], tuple(params)
        return f"({' OR '.join(clauses)})", tuple(params)

    _normalize_identity = staticmethod(normalize_identity)

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
