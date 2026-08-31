from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from typing import Any, Literal, cast

import lxml.etree as ET

from app.models import SuccessXmlUploadResult
from app.services.testing_state_store import TestingStateStore

MESSAGE_NS = "https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Message/v1"
SERVICE_NS = "https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Service/v1"
NAMESPACES: dict[str, str] = {
    "message": MESSAGE_NS,
    "service": SERVICE_NS,
}


SuccessMessageType = Literal["DEVICE.POST", "UDI_DI.POST", "UDI_DI.PATCH", "MARKET_INFO.PUT"]
SuccessOperationLabel = Literal["Basic UDI-DI POST", "Device UDI-DI POST", "Device UDI-DI PATCH", "Market Info PUT"]


@dataclass(frozen=True)
class AcknowledgementPayload:
    message_type: SuccessMessageType
    operation_label: SuccessOperationLabel
    entity_code: str
    entity_version: str | None
    tested_at: str | None
    correlation_id: str | None
    message_id: str | None
    response_code: str
    source_file_name: str | None
    raw_xml: str


@dataclass(frozen=True)
class SubjectResolution:
    subject_id: int
    created_subject: bool
    product_family: str | None
    product_variant: str | None
    catalogue_number: str | None
    primary_udi_di: str | None
    basic_udi_di: str | None


class TestingSuccessXmlService:
    def __init__(self) -> None:
        self.store = TestingStateStore()

    def record_success_xml(self, *, xml_bytes: bytes, source_file_name: str | None = None) -> SuccessXmlUploadResult:
        acknowledgements = self._parse_acknowledgements(xml_bytes=xml_bytes, source_file_name=source_file_name)
        first_acknowledgement = acknowledgements[0]
        operation_scope = "bulk" if len(acknowledgements) > 1 else "single"
        batch_id = self._batch_id(first_acknowledgement)
        first_resolution: SubjectResolution | None = None
        recorded_event_count = 0
        duplicate_event_count = 0
        created_subject_count = 0
        with self.store._connect() as connection:
            for acknowledgement in acknowledgements:
                resolution = self._resolve_subject(connection, acknowledgement)
                if first_resolution is None:
                    first_resolution = resolution
                recorded_event, duplicate_event, event_id = self._record_event(
                    connection,
                    resolution.subject_id,
                    acknowledgement,
                    operation_scope=operation_scope,
                    batch_id=batch_id,
                )
                self._reconcile_subject_success_state(
                    connection,
                    resolution.subject_id,
                    acknowledgement,
                    event_id=event_id,
                )
                created_subject_count += 1 if resolution.created_subject else 0
                recorded_event_count += 1 if recorded_event else 0
                duplicate_event_count += 1 if duplicate_event else 0
        if first_resolution is None:
            raise ValueError("Success XML did not resolve any testing subjects.")
        if len(acknowledgements) == 1:
            summary_message = (
                f"Tracked successful {first_acknowledgement.operation_label} for "
                f"{first_resolution.catalogue_number or first_acknowledgement.entity_code}."
            )
        else:
            summary_message = (
                f"Tracked successful {first_acknowledgement.operation_label} acknowledgements for "
                f"{recorded_event_count} of {len(acknowledgements)} response entities."
            )
            if duplicate_event_count:
                summary_message += f" {duplicate_event_count} were already recorded."
        return SuccessXmlUploadResult(
            summary_message=summary_message,
            message_type=first_acknowledgement.message_type,
            operation_label=first_acknowledgement.operation_label,
            entity_code=first_acknowledgement.entity_code,
            product_family=first_resolution.product_family,
            product_variant=first_resolution.product_variant,
            catalogue_number=first_resolution.catalogue_number,
            primary_udi_di=first_resolution.primary_udi_di,
            basic_udi_di=first_resolution.basic_udi_di,
            tested_at=first_acknowledgement.tested_at,
            correlation_id=first_acknowledgement.correlation_id,
            message_id=first_acknowledgement.message_id,
            source_file_name=first_acknowledgement.source_file_name,
            subject_id=first_resolution.subject_id,
            created_subject=created_subject_count > 0,
            recorded_event=recorded_event_count > 0,
            duplicate_event=duplicate_event_count == len(acknowledgements),
            entity_count=len(acknowledgements),
            recorded_event_count=recorded_event_count,
            duplicate_event_count=duplicate_event_count,
            created_subject_count=created_subject_count,
        )

    def _reconcile_subject_success_state(
        self,
        connection: sqlite3.Connection,
        subject_id: int,
        acknowledgement: AcknowledgementPayload,
        *,
        event_id: int | None,
    ) -> None:
        if acknowledgement.message_type in {"DEVICE.POST", "UDI_DI.POST"}:
            generated_row = self._generated_event_row(
                connection,
                subject_id=subject_id,
                message_type=acknowledgement.message_type,
                correlation_id=acknowledgement.correlation_id,
                message_id=acknowledgement.message_id,
                columns="version, state_after_json",
            )
            latest_post_state_json = (
                self.store._optional_string(generated_row["state_after_json"])
                if generated_row is not None
                else None
            )
            latest_post_version = (
                self.store._optional_string(generated_row["version"])
                if generated_row is not None
                else None
            ) or acknowledgement.entity_version or "1"
            registration_status = "parent_registered" if acknowledgement.message_type == "DEVICE.POST" else "child_registered"
            connection.execute(
                """
                UPDATE testing_subjects
                SET post_success = 1,
                    registration_status = ?,
                    latest_successful_post_version = ?,
                    latest_successful_post_state_json = COALESCE(?, latest_successful_post_state_json),
                    latest_successful_version = COALESCE(?, latest_successful_version, '1'),
                    latest_successful_message_type = ?,
                    latest_successful_event_id = COALESCE(?, latest_successful_event_id),
                    latest_tested_at = COALESCE(?, latest_tested_at)
                WHERE id = ?
                """,
                (
                    registration_status,
                    latest_post_version,
                    latest_post_state_json,
                    latest_post_version,
                    acknowledgement.message_type,
                    event_id,
                    acknowledgement.tested_at,
                    subject_id,
                ),
            )
            return
        if acknowledgement.message_type == "UDI_DI.PATCH":
            generated_row = self._generated_event_row(
                connection,
                subject_id=subject_id,
                message_type=acknowledgement.message_type,
                correlation_id=acknowledgement.correlation_id,
                message_id=acknowledgement.message_id,
                columns="version, state_after_json",
            )
            patch_version = (
                self.store._optional_string(generated_row["version"])
                if generated_row is not None
                else None
            ) or acknowledgement.entity_version
            patch_state_json = (
                self.store._optional_string(generated_row["state_after_json"])
                if generated_row is not None
                else None
            )
            connection.execute(
                """
                UPDATE testing_subjects
                SET post_success = 1,
                    registration_status = 'child_registered',
                    baseline_patch_success = CASE WHEN ? = '2' THEN 1 ELSE baseline_patch_success END,
                    latest_successful_patch_version = COALESCE(?, latest_successful_patch_version),
                    latest_successful_patch_state_json = COALESCE(?, latest_successful_patch_state_json),
                    latest_successful_version = COALESCE(?, latest_successful_version),
                    latest_successful_state_json = COALESCE(?, latest_successful_state_json),
                    latest_successful_message_type = ?,
                    latest_successful_event_id = COALESCE(?, latest_successful_event_id),
                    latest_tested_at = COALESCE(?, latest_tested_at)
                WHERE id = ?
                """,
                (
                    patch_version,
                    patch_version,
                    patch_state_json,
                    patch_version,
                    patch_state_json,
                    acknowledgement.message_type,
                    event_id,
                    acknowledgement.tested_at,
                    subject_id,
                ),
            )
            return
        if acknowledgement.message_type != "MARKET_INFO.PUT":
            return

        version = acknowledgement.entity_version
        market_info_state_json: str | None = None
        generated_row = self._generated_event_row(
            connection,
            subject_id=subject_id,
            message_type="MARKET_INFO.PUT",
            correlation_id=acknowledgement.correlation_id,
            message_id=acknowledgement.message_id,
            columns="version, raw_event_json",
        )
        if generated_row is not None:
            version = self.store._optional_string(generated_row["version"]) or version
            generated_raw_json = self.store._optional_string(generated_row["raw_event_json"])
            if generated_raw_json:
                try:
                    generated_payload = json.loads(generated_raw_json)
                except json.JSONDecodeError:
                    generated_payload = None
                if isinstance(generated_payload, dict):
                    latest_market_info_state = generated_payload.get("latest_successful_market_info_state")
                    if isinstance(latest_market_info_state, dict):
                        market_info_state_json = json.dumps(latest_market_info_state)
        connection.execute(
            """
            UPDATE testing_subjects
            SET latest_successful_market_info_version = COALESCE(?, latest_successful_market_info_version),
                latest_successful_market_info_state_json = COALESCE(?, latest_successful_market_info_state_json),
                latest_successful_message_type = ?,
                latest_successful_event_id = COALESCE(?, latest_successful_event_id),
                latest_tested_at = COALESCE(?, latest_tested_at)
            WHERE id = ?
            """,
            (
                version,
                market_info_state_json,
                acknowledgement.message_type,
                event_id,
                acknowledgement.tested_at,
                subject_id,
            ),
        )

    def _parse_acknowledgements(self, *, xml_bytes: bytes, source_file_name: str | None) -> list[AcknowledgementPayload]:
        try:
            root = cast(Any, ET.fromstring(xml_bytes))
        except ET.XMLSyntaxError as exc:
            raise ValueError(f"Success XML could not be parsed: {exc}") from exc

        response_entities = root.findall(".//message:responseEntity", NAMESPACES)
        if not response_entities:
            raise ValueError("Success XML must contain at least one response entity.")

        service_id, service_operation = self._resolve_service_identity(root)
        if (service_id, service_operation) == ("MARKET_INFO", "PUT"):
            message_type = "MARKET_INFO.PUT"
            operation_label = "Market Info PUT"
        elif service_operation not in {"POST", "PATCH"}:
            raise ValueError(
                f"Only POST, PATCH, and MARKET_INFO.PUT acknowledgements are supported. Received {service_id or 'UNKNOWN'}.{service_operation or 'UNKNOWN'}."
            )
        elif service_id not in {"DEVICE", "UDI_DI"}:
            raise ValueError(
                f"Only DEVICE.POST, UDI_DI.POST, UDI_DI.PATCH, and MARKET_INFO.PUT acknowledgements are supported. Received {service_id or 'UNKNOWN'}.{service_operation or 'UNKNOWN'}."
            )
        elif service_id == "DEVICE" and service_operation == "POST":
            message_type: SuccessMessageType = "DEVICE.POST"
            operation_label: SuccessOperationLabel = "Basic UDI-DI POST"
        elif service_id == "UDI_DI" and service_operation == "POST":
            message_type = "UDI_DI.POST"
            operation_label = "Device UDI-DI POST"
        elif service_id == "UDI_DI" and service_operation == "PATCH":
            message_type = "UDI_DI.PATCH"
            operation_label = "Device UDI-DI PATCH"
        else:
            raise ValueError(
                f"Unsupported acknowledgement type {service_id or 'UNKNOWN'}.{service_operation or 'UNKNOWN'}."
            )
        tested_at = self._node_text(root.find("message:creationDateTime", NAMESPACES))
        correlation_id = self._node_text(root.find("message:correlationID", NAMESPACES))
        message_id = self._node_text(root.find("message:messageID", NAMESPACES))
        raw_xml = xml_bytes.decode("utf-8", errors="replace")
        acknowledgements: list[AcknowledgementPayload] = []
        for response_entity in response_entities:
            response_code = self._node_text(response_entity.find("message:responseCode", NAMESPACES))
            if response_code != "SUCCESS":
                raise ValueError(f"Only SUCCESS acknowledgements can be recorded. Received {response_code or 'UNKNOWN'}.")

            entity_code = self._node_text(response_entity.find("message:entityCode", NAMESPACES))
            if not entity_code:
                raise ValueError("Success XML is missing responseEntity.entityCode.")
            entity_version = self._node_text(response_entity.find("message:entityVersion", NAMESPACES))
            acknowledgements.append(
                AcknowledgementPayload(
                    message_type=message_type,
                    operation_label=operation_label,
                    entity_code=entity_code,
                    entity_version=entity_version,
                    tested_at=tested_at,
                    correlation_id=correlation_id,
                    message_id=message_id,
                    response_code=response_code,
                    source_file_name=source_file_name,
                    raw_xml=raw_xml,
                )
            )
        return acknowledgements

    def _resolve_service_identity(self, root: Any) -> tuple[str | None, str | None]:
        for path in ("message:sender/message:service", "message:recipient/message:service"):
            service_node = root.find(path, NAMESPACES)
            if service_node is None:
                continue
            service_id = self._node_text(service_node.find("service:serviceID", NAMESPACES))
            service_operation = self._node_text(service_node.find("service:serviceOperation", NAMESPACES))
            if service_id and service_operation:
                return service_id, service_operation
        return None, None

    def _generated_event_row(
        self,
        connection: sqlite3.Connection,
        *,
        subject_id: int,
        message_type: str,
        correlation_id: str | None,
        message_id: str | None,
        columns: str,
    ) -> sqlite3.Row | None:
        if correlation_id:
            exact_row = connection.execute(
                f"""
                SELECT {columns}
                FROM testing_events
                WHERE subject_id = ?
                  AND message_type = ?
                  AND status = 'GENERATED'
                  AND correlation_id = ?
                  AND COALESCE(message_id, '') = COALESCE(?, '')
                ORDER BY event_index DESC
                LIMIT 1
                """,
                (subject_id, message_type, correlation_id, message_id),
            ).fetchone()
            if exact_row is not None:
                return exact_row

            correlation_row = connection.execute(
                f"""
                SELECT {columns}
                FROM testing_events
                WHERE subject_id = ?
                  AND message_type = ?
                  AND status = 'GENERATED'
                  AND correlation_id = ?
                ORDER BY event_index DESC
                LIMIT 1
                """,
                (subject_id, message_type, correlation_id),
            ).fetchone()
            if correlation_row is not None:
                return correlation_row

        return connection.execute(
            f"""
            SELECT {columns}
            FROM testing_events
            WHERE subject_id = ?
              AND message_type = ?
              AND status = 'GENERATED'
            ORDER BY event_index DESC
            LIMIT 1
            """,
            (subject_id, message_type),
        ).fetchone()

    def _resolve_subject(self, connection: sqlite3.Connection, acknowledgement: AcknowledgementPayload) -> SubjectResolution:
        existing_subject = self._find_existing_testing_subject(connection, acknowledgement)
        if existing_subject is not None:
            return SubjectResolution(
                subject_id=int(existing_subject["id"]),
                created_subject=False,
                product_family=self.store._optional_string(existing_subject["product_family"]),
                product_variant=self.store._optional_string(existing_subject["product_variant"]),
                catalogue_number=self.store._optional_string(existing_subject["catalogue_number"]),
                primary_udi_di=self.store._optional_string(existing_subject["primary_udi_di"]),
                basic_udi_di=self.store._optional_string(existing_subject["basic_udi_di"]),
            )

        device_row = self._find_device_subject_row(connection, acknowledgement)
        if device_row is None:
            raise ValueError(
                f"No device subject could be resolved for {acknowledgement.operation_label} entity {acknowledgement.entity_code}."
            )

        subject_id = self._insert_testing_subject(connection, device_row)
        return SubjectResolution(
            subject_id=subject_id,
            created_subject=True,
            product_family=self.store._optional_string(device_row["product_family"]),
            product_variant=self.store._optional_string(device_row["product_variant"]),
            catalogue_number=self.store._optional_string(device_row["catalogue_number"]),
            primary_udi_di=self.store._optional_string(device_row["primary_udi_di"]),
            basic_udi_di=self.store._optional_string(device_row["basic_udi_di"]),
        )

    def _find_existing_testing_subject(
        self,
        connection: sqlite3.Connection,
        acknowledgement: AcknowledgementPayload,
    ) -> sqlite3.Row | None:
        rows = connection.execute(
            """
            SELECT *
            FROM testing_subjects
            WHERE normalized_primary_udi_di = ?
               OR normalized_basic_udi_di = ?
            ORDER BY id
            """,
            (
                self.store._normalize_identity(acknowledgement.entity_code),
                self.store._normalize_identity(acknowledgement.entity_code),
            ),
        ).fetchall()
        if acknowledgement.message_type in {"UDI_DI.POST", "UDI_DI.PATCH", "MARKET_INFO.PUT"}:
            for row in rows:
                if self.store._matches_identity(row["primary_udi_di"], acknowledgement.entity_code):
                    return row
            return None
        for row in rows:
            if self.store._matches_identity(row["basic_udi_di"], acknowledgement.entity_code):
                return row
        return None

    def _find_device_subject_row(
        self,
        connection: sqlite3.Connection,
        acknowledgement: AcknowledgementPayload,
    ) -> sqlite3.Row | None:
        rows = connection.execute(
            """
            SELECT
                ds.id,
                ds.subject_key,
                ds.product_family,
                ds.product_variant,
                ds.catalogue_number,
                ds.primary_udi_di,
                ds.basic_udi_di,
                ds.current_source_row_id,
                sr.sheet_name,
                sr.row_index,
                sw.workbook_name
            FROM device_subject ds
            LEFT JOIN source_row sr ON sr.id = ds.current_source_row_id
            LEFT JOIN source_workbook sw ON sw.id = sr.source_workbook_id
            ORDER BY ds.id
            """
        ).fetchall()
        if acknowledgement.message_type in {"UDI_DI.POST", "UDI_DI.PATCH", "MARKET_INFO.PUT"}:
            for row in rows:
                if self.store._matches_identity(row["primary_udi_di"], acknowledgement.entity_code):
                    return row
            return None
        for row in rows:
            if self.store._matches_identity(row["basic_udi_di"], acknowledgement.entity_code):
                return row
        return None

    def _insert_testing_subject(self, connection: sqlite3.Connection, device_row: sqlite3.Row) -> int:
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
                latest_successful_state_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0, NULL, NULL, NULL)
            """,
            (
                self.store._optional_string(device_row["subject_key"]),
                int(device_row["id"]),
                self.store._normalize_identity(device_row["product_family"]),
                self.store._normalize_identity(device_row["product_variant"]),
                self.store._normalize_identity(device_row["catalogue_number"]),
                self.store._normalize_identity(device_row["primary_udi_di"]),
                self.store._normalize_identity(device_row["basic_udi_di"]),
                self.store._optional_string(device_row["product_family"]),
                self.store._optional_string(device_row["product_variant"]),
                self.store._optional_string(device_row["catalogue_number"]),
                self.store._optional_string(device_row["primary_udi_di"]),
                self.store._optional_string(device_row["basic_udi_di"]),
                self.store._optional_string(device_row["workbook_name"]),
                self.store._optional_string(device_row["sheet_name"]),
                self.store._optional_int(device_row["row_index"]),
            ),
        )
        inserted_row = connection.execute("SELECT last_insert_rowid()").fetchone()
        if inserted_row is None:
            raise ValueError("Testing subject insert succeeded but no row id was returned.")
        return int(inserted_row[0])

    def _record_event(
        self,
        connection: sqlite3.Connection,
        subject_id: int,
        acknowledgement: AcknowledgementPayload,
        *,
        operation_scope: str,
        batch_id: str | None,
    ) -> tuple[bool, bool, int | None]:
        duplicate_row = connection.execute(
            """
            SELECT id
            FROM testing_events
            WHERE subject_id = ?
              AND COALESCE(correlation_id, '') = COALESCE(?, '')
              AND COALESCE(message_id, '') = COALESCE(?, '')
              AND message_type = ?
              AND status = 'SUCCESS'
            LIMIT 1
            """,
            (
                subject_id,
                acknowledgement.correlation_id,
                acknowledgement.message_id,
                acknowledgement.message_type,
            ),
        ).fetchone()
        if duplicate_row is not None:
            return False, True, int(duplicate_row["id"])

        next_index_row = connection.execute(
            "SELECT COALESCE(MAX(event_index), -1) + 1 FROM testing_events WHERE subject_id = ?",
            (subject_id,),
        ).fetchone()
        next_index = int(next_index_row[0]) if next_index_row is not None else 0
        subject_row = connection.execute(
            """
            SELECT product_family, product_variant, catalogue_number, primary_udi_di, basic_udi_di
            FROM testing_subjects
            WHERE id = ?
            """,
            (subject_id,),
        ).fetchone()
        version: str | None = (
            acknowledgement.entity_version
            if acknowledgement.message_type in {"DEVICE.POST", "UDI_DI.POST", "MARKET_INFO.PUT"}
            else None
        )
        scenario_id: str | None = None
        scenario_label: str | None = None
        changed_fields_json: str | None = None
        retained_fields_json: str | None = None
        unchanged_fields_json: str | None = None
        base_message_type: str | None = None
        base_version: str | None = None
        derived_version: str | None = version
        accepted_state_source: str | None = None
        state_before_json: str | None = None
        state_after_json: str | None = None
        delta_json: str | None = None
        raw_event_payload: dict[str, Any] = {
            "source_file_name": acknowledgement.source_file_name,
            "message_type": acknowledgement.message_type,
            "operation_label": acknowledgement.operation_label,
            "event_kind": "success_ack",
            "operation_scope": operation_scope,
            "batch_id": batch_id,
            "entity_code": acknowledgement.entity_code,
            "entity_version": acknowledgement.entity_version,
            "response_code": acknowledgement.response_code,
            "correlation_id": acknowledgement.correlation_id,
            "message_id": acknowledgement.message_id,
            "tested_at": acknowledgement.tested_at,
            "xml": acknowledgement.raw_xml,
            "product_family": self.store._optional_string(subject_row["product_family"]) if subject_row is not None else None,
            "product_variant": self.store._optional_string(subject_row["product_variant"]) if subject_row is not None else None,
            "catalogue_number": self.store._optional_string(subject_row["catalogue_number"]) if subject_row is not None else None,
            "primary_udi_di": self.store._optional_string(subject_row["primary_udi_di"]) if subject_row is not None else None,
            "basic_udi_di": self.store._optional_string(subject_row["basic_udi_di"]) if subject_row is not None else None,
        }
        if acknowledgement.message_type == "UDI_DI.PATCH":
            generated_row = self._generated_event_row(
                connection,
                subject_id=subject_id,
                message_type="UDI_DI.PATCH",
                correlation_id=acknowledgement.correlation_id,
                message_id=acknowledgement.message_id,
                columns=(
                    "version, base_message_type, base_version, derived_version, accepted_state_source, "
                    "scenario_id, scenario_label, state_before_json, state_after_json, delta_json, "
                    "changed_fields_json, retained_fields_json, unchanged_fields_json, raw_event_json"
                ),
            )
            if generated_row is not None:
                version = self.store._optional_string(generated_row["version"])
                base_message_type = self.store._optional_string(generated_row["base_message_type"])
                base_version = self.store._optional_string(generated_row["base_version"])
                derived_version = self.store._optional_string(generated_row["derived_version"]) or version
                accepted_state_source = self.store._optional_string(generated_row["accepted_state_source"])
                scenario_id = self.store._optional_string(generated_row["scenario_id"])
                scenario_label = self.store._optional_string(generated_row["scenario_label"])
                state_before_json = self.store._optional_string(generated_row["state_before_json"])
                state_after_json = self.store._optional_string(generated_row["state_after_json"])
                delta_json = self.store._optional_string(generated_row["delta_json"])
                changed_fields_json = self.store._optional_string(generated_row["changed_fields_json"])
                retained_fields_json = self.store._optional_string(generated_row["retained_fields_json"])
                unchanged_fields_json = self.store._optional_string(generated_row["unchanged_fields_json"])
                generated_raw_json = self.store._optional_string(generated_row["raw_event_json"])
                if generated_raw_json:
                    try:
                        generated_payload = json.loads(generated_raw_json)
                    except json.JSONDecodeError:
                        generated_payload = None
                    if isinstance(generated_payload, dict):
                        raw_event_payload["generated_patch_context"] = generated_payload
                        latest_state = generated_payload.get("latest_successful_state")
                        if isinstance(latest_state, dict):
                            raw_event_payload["accepted_patch_state"] = latest_state
        elif acknowledgement.message_type == "MARKET_INFO.PUT":
            subject_row = connection.execute(
                """
                SELECT latest_successful_market_info_state_json
                FROM testing_subjects
                WHERE id = ?
                """,
                (subject_id,),
            ).fetchone()
            subject_before_state = self._json_dict(
                subject_row["latest_successful_market_info_state_json"] if subject_row is not None else None
            )
            generated_row = self._generated_event_row(
                connection,
                subject_id=subject_id,
                message_type="MARKET_INFO.PUT",
                correlation_id=acknowledgement.correlation_id,
                message_id=acknowledgement.message_id,
                columns=(
                    "version, base_version, derived_version, accepted_state_source, "
                    "state_before_json, state_after_json, delta_json, raw_event_json"
                ),
            )
            market_info_state_json: str | None = None
            market_info_delta: dict[str, Any] | None = None
            if generated_row is not None:
                version = self.store._optional_string(generated_row["version"]) or version
                base_version = self.store._optional_string(generated_row["base_version"])
                derived_version = self.store._optional_string(generated_row["derived_version"]) or version
                accepted_state_source = self.store._optional_string(generated_row["accepted_state_source"])
                state_before_json = self.store._optional_string(generated_row["state_before_json"])
                state_after_json = self.store._optional_string(generated_row["state_after_json"])
                delta_json = self.store._optional_string(generated_row["delta_json"])
                generated_raw_json = self.store._optional_string(generated_row["raw_event_json"])
                if generated_raw_json:
                    try:
                        generated_payload = json.loads(generated_raw_json)
                    except json.JSONDecodeError:
                        generated_payload = None
                    if isinstance(generated_payload, dict):
                        raw_event_payload["generated_market_info_context"] = generated_payload
                        baseline_market_info_state = generated_payload.get("baseline_market_info_state")
                        latest_market_info_state = generated_payload.get("latest_successful_market_info_state")
                        if isinstance(subject_before_state, dict) and isinstance(latest_market_info_state, dict):
                            market_info_delta = self._market_info_delta(
                                before_state=subject_before_state,
                                after_state=latest_market_info_state,
                            )
                        elif isinstance(baseline_market_info_state, dict) and isinstance(latest_market_info_state, dict):
                            market_info_delta = self._market_info_delta(
                                before_state=baseline_market_info_state,
                                after_state=latest_market_info_state,
                            )
                        if isinstance(latest_market_info_state, dict):
                            market_info_state_json = json.dumps(latest_market_info_state)
            if market_info_delta:
                raw_event_payload["market_info_delta"] = market_info_delta
            connection.execute(
                """
                UPDATE testing_subjects
                SET latest_successful_market_info_version = COALESCE(?, latest_successful_market_info_version),
                    latest_successful_market_info_state_json = COALESCE(?, latest_successful_market_info_state_json)
                WHERE id = ?
                """,
                (
                    version,
                    market_info_state_json,
                    subject_id,
                ),
            )
        raw_event_json = json.dumps(raw_event_payload)
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
            ) VALUES (?, ?, ?, 'success_ack', 'SUCCESS', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                subject_id,
                next_index,
                acknowledgement.message_type,
                operation_scope,
                batch_id,
                version,
                base_message_type,
                base_version,
                derived_version,
                accepted_state_source,
                scenario_id,
                scenario_label,
                self.store._optional_string(raw_event_payload.get("product_family")),
                self.store._optional_string(raw_event_payload.get("product_variant")),
                self.store._optional_string(raw_event_payload.get("catalogue_number")),
                self.store._optional_string(raw_event_payload.get("primary_udi_di")),
                self.store._optional_string(raw_event_payload.get("basic_udi_di")),
                acknowledgement.tested_at,
                None,
                None,
                acknowledgement.tested_at,
                acknowledgement.correlation_id,
                acknowledgement.message_id,
                acknowledgement.source_file_name,
                state_before_json,
                state_after_json,
                delta_json,
                changed_fields_json,
                retained_fields_json,
                unchanged_fields_json,
                raw_event_json,
                acknowledgement.raw_xml,
            ),
        )
        inserted_row = connection.execute("SELECT last_insert_rowid()").fetchone()
        event_id = int(inserted_row[0]) if inserted_row is not None else None
        return True, False, event_id

    @staticmethod
    def _batch_id(acknowledgement: AcknowledgementPayload) -> str | None:
        if acknowledgement.correlation_id and acknowledgement.message_id:
            return f"{acknowledgement.correlation_id}:{acknowledgement.message_id}"
        return acknowledgement.correlation_id or acknowledgement.message_id

    def _market_info_delta(self, *, before_state: dict[str, Any], after_state: dict[str, Any]) -> dict[str, Any]:
        before_items = before_state.get("market_countries")
        after_items = after_state.get("market_countries")
        before_codes = {
            self.store._optional_string(item.get("country")) if isinstance(item, dict) else None
            for item in before_items
        } if isinstance(before_items, list) else set()
        after_codes = {
            self.store._optional_string(item.get("country")) if isinstance(item, dict) else None
            for item in after_items
        } if isinstance(after_items, list) else set()
        before_codes = {code for code in before_codes if code}
        after_codes = {code for code in after_codes if code}
        return {
            "added_countries": sorted(after_codes - before_codes),
            "removed_countries": sorted(before_codes - after_codes),
            "original_market_before": self._original_market_code(before_items),
            "original_market_after": self._original_market_code(after_items),
        }

    def _original_market_code(self, items: Any) -> str | None:
        if not isinstance(items, list):
            return None
        for item in items:
            if not isinstance(item, dict):
                continue
            if bool(item.get("original_placed_on_market")):
                return self.store._optional_string(item.get("country"))
        return None

    @staticmethod
    def _json_dict(value: object) -> dict[str, Any] | None:
        if not isinstance(value, str) or not value.strip():
            return None
        try:
            payload = json.loads(value)
        except json.JSONDecodeError:
            return None
        return payload if isinstance(payload, dict) else None

    @staticmethod
    def _node_text(node: Any) -> str | None:
        if node is None:
            return None
        text = node.text
        if not isinstance(text, str):
            return None
        value = text.strip()
        return value or None
