from __future__ import annotations

import json
from dataclasses import replace
from typing import Any

from app.config import get_settings
from app.services.canonical_projection import (
    CanonicalValidationBundle,
    CanonicalProjectionNoImportError,
    CanonicalProjectionService,
    CanonicalProjectionUnavailableError,
)
from app.services.canonical_validation import CanonicalValidationService
from app.services.xml_packaging import XmlPackageBuilder
from app.services.xml_projection import DeviceXmlProjectionBuilder, DeviceXmlRecord
from app.services.xml_rendering import EudamedMessageRenderer
from app.services.xml_selection import ValidationRecordSelector
from app.services.testing_state_store import TestingStateStore
from app.services.xml_validation import XmlValidationService
from app.validation_models import CanonicalValidationRecord
from app.xml_models import (
    BatchXmlChunkSummary,
    BatchXmlPreview,
    BulkPatchPreview,
    BulkPostPreview,
    BulkUdidiPostPreview,
    BulkXmlExcludedRecord,
    BulkXmlRecordSummary,
    GeneratedPatchScenarioPreview,
    MarketInfoPutPreview,
    PatchScenarioContext,
    PatchScenarioFieldDelta,
    PostRegistrationPreview,
    RegisteredDeviceAnchor,
    SingleRecordXmlPreview,
    XmlValidationResult,
    XmlGenerationScopeBundle,
    XmlGenerationSelectionSummary,
)


class XmlGenerationService:
    def __init__(self, *, require_import: bool = False) -> None:
        self.settings = get_settings()
        self.require_import = require_import
        self.validation_service = CanonicalValidationService()
        self.canonical_projection_service = CanonicalProjectionService(
            validation_service=self.validation_service,
        )
        self.xml_validation_service = XmlValidationService()
        self.selector = ValidationRecordSelector(self.validation_service, require_import=require_import)
        self.projection_builder = DeviceXmlProjectionBuilder()
        self.renderer = EudamedMessageRenderer(self.settings)
        self.package_builder = XmlPackageBuilder()
        self.testing_state_store = TestingStateStore()

    @property
    def project_root(self):
        return self.settings.schema_dir.parents[1]

    @staticmethod
    def _patch_state_snapshot_payload(record: DeviceXmlRecord) -> dict[str, Any]:
        return {
            "version": str(record.patch_version_override or record.source_version_marker or ""),
            "trade_name": record.trade_name,
            "base_quantity": record.base_quantity,
            "sterile": record.sterile,
            "contains_latex": record.contains_latex,
            "status_code": record.status_code,
            "storage_conditions": [
                {"code": item.code, "comment": item.comment}
                for item in record.storage_conditions
            ],
            "critical_warnings": [
                {"code": item.code, "comment": item.comment}
                for item in record.critical_warnings
            ],
        }

    def _validation_bundle(self) -> CanonicalValidationBundle:
        try:
            return self.canonical_projection_service.latest_bundle(require_import=self.require_import)
        except (CanonicalProjectionNoImportError, CanonicalProjectionUnavailableError) as exc:
            raise ValueError(str(exc)) from exc

    def generation_scope(self) -> XmlGenerationScopeBundle:
        bundle = self._validation_bundle()
        families = [
            XmlGenerationSelectionSummary(
                product_family=summary.product_family,
                product_variant="All variants",
                submission_operation=None,
                total_records=summary.total_records,
                xml_ready_records=summary.xml_ready_records,
                xml_blocked_records=summary.xml_blocked_records,
            )
            for summary in bundle.family_summaries
        ]
        return XmlGenerationScopeBundle(
            family_scope=bundle.family_scope,
            scope_note=(
                "XML generation now follows Canonical Validation scope. Select a product family and "
                "product variant, then generate XML only from rows that are currently XML-ready."
            ),
            total_xml_ready_records=bundle.xml_ready_records,
            families=families,
        )

    @staticmethod
    def _normalize_record_count(record_count: int | None, max_records: int) -> int:
        normalized = int(record_count or 1)
        if normalized < 1:
            raise ValueError("record_count must be between 1 and 300.")
        if normalized > max_records:
            raise ValueError(f"record_count must be between 1 and {max_records}.")
        return normalized

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
    def _record_matches_family_variant(
        cls,
        record: CanonicalValidationRecord,
        *,
        product_family: str,
        product_variant: str,
    ) -> bool:
        requested_family_candidates = set(cls._normalized_family_candidates(product_family))
        record_family_candidates = set(cls._normalized_family_candidates(record.product_family))
        if not requested_family_candidates or not record_family_candidates:
            return False
        return (
            bool(requested_family_candidates & record_family_candidates)
            and cls._normalize_identity(record.product_variant) == cls._normalize_identity(product_variant)
        )

    def _variant_post_records_with_exclusions(
        self,
        *,
        product_family: str,
        product_variant: str,
        record_count: int | None,
    ) -> tuple[list[CanonicalValidationRecord], list[BulkXmlExcludedRecord], int]:
        bundle = self._validation_bundle()
        variant_records = [
            record
            for record in bundle.records
            if self._record_matches_family_variant(
                record,
                product_family=product_family,
                product_variant=product_variant,
            )
        ]
        excluded: list[BulkXmlExcludedRecord] = []
        eligible_posts: list[CanonicalValidationRecord] = []
        for record in variant_records:
            if self._normalized_operation(record.submission_operation) != "POST":
                excluded.append(
                    BulkXmlExcludedRecord(
                        catalogue_number=record.catalogue_number,
                        primary_udi_di=record.primary_udi_di,
                        reason_code="not_post_operation",
                        reason_message="Record is not classified as a POST row.",
                    )
                )
                continue
            if record.xml_readiness.status != "complete":
                excluded.append(
                    BulkXmlExcludedRecord(
                        catalogue_number=record.catalogue_number,
                        primary_udi_di=record.primary_udi_di,
                        reason_code="xml_not_ready",
                        reason_message="Record is not XML-ready.",
                    )
                )
                continue
            eligible_posts.append(record)
        limited_posts = eligible_posts if record_count is None else eligible_posts[:record_count]
        return limited_posts, excluded, len(eligible_posts)

    def _require_reviewed_post_baseline(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> None:
        if self.testing_state_store.has_reviewed_post(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        ):
            return
        raise ValueError(
            "Generate and review the baseline POST for this exact selected record before drafting a PATCH."
        )

    def _require_tracked_successful_post_baseline(
        self,
        *,
        product_family: str,
        product_variant: str,
        primary_udi_di: str | None,
    ) -> None:
        if primary_udi_di and self.testing_state_store.has_successful_primary_udi_post(
            product_family=product_family,
            product_variant=product_variant,
            primary_udi_di=primary_udi_di,
        ):
            return
        raise ValueError(
            "This device does not yet have a tracked successful Playground registration, so PATCH cannot be generated."
        )

    def _variant_xml_ready_records(
        self,
        *,
        product_family: str,
        product_variant: str,
    ) -> list[CanonicalValidationRecord]:
        bundle = self._validation_bundle()
        return [
            record
            for record in bundle.records
            if self._record_matches_family_variant(
                record,
                product_family=product_family,
                product_variant=product_variant,
            )
            and record.xml_readiness.status == "complete"
        ]

    @staticmethod
    def _bulk_record_summary(record: CanonicalValidationRecord) -> BulkXmlRecordSummary:
        basic_udi_di = XmlGenerationService._record_basic_udi_di(record)
        return BulkXmlRecordSummary(
            catalogue_number=record.catalogue_number or "",
            primary_udi_di=record.primary_udi_di,
            basic_udi_di=basic_udi_di,
            trade_name=record.trade_name,
            source_workbook=record.source_workbook,
            source_sheet=record.source_sheet,
            source_row_index=record.source_row_index,
        )

    @staticmethod
    def _record_basic_udi_di(record: CanonicalValidationRecord) -> str | None:
        return next(
            (
                field.value
                for field in record.fields
                if field.canonical_path in {"basic_device.basic_udi_di", "device_record.basic_udi_identifier"}
                and field.value
            ),
            None,
        )

    def _deduplicate_bulk_basic_udi_posts(
        self,
        *,
        product_family: str,
        product_variant: str,
        records: list[CanonicalValidationRecord],
        excluded_records: list[BulkXmlExcludedRecord],
    ) -> tuple[list[CanonicalValidationRecord], list[BulkXmlExcludedRecord], int]:
        included: list[CanonicalValidationRecord] = []
        seen_basic_udi_dis: set[str] = set()
        eligible_basic_udi_dis: set[str] = set()

        for record in records:
            summary = self._bulk_record_summary(record)
            basic_udi_di = summary.basic_udi_di
            if not basic_udi_di:
                excluded_records.append(
                    BulkXmlExcludedRecord(
                        catalogue_number=record.catalogue_number,
                        primary_udi_di=record.primary_udi_di,
                        reason_code="missing_basic_udi_di",
                        reason_message="Record does not resolve to a Basic UDI-DI, so it cannot be used for Bulk Basic UDI POST.",
                    )
                )
                continue

            parent_already_posted = self.testing_state_store.has_successful_basic_udi_post(
                product_family=product_family,
                product_variant=product_variant,
                basic_udi_di=basic_udi_di,
            )
            if parent_already_posted:
                excluded_records.append(
                    BulkXmlExcludedRecord(
                        catalogue_number=record.catalogue_number,
                        primary_udi_di=record.primary_udi_di,
                        reason_code="parent_already_registered",
                        reason_message=(
                            f"Basic UDI-DI {basic_udi_di} already has a successful parent DEVICE.POST, so no new parent seed will be generated."
                        ),
                    )
                )
                continue

            if basic_udi_di in seen_basic_udi_dis:
                excluded_records.append(
                    BulkXmlExcludedRecord(
                        catalogue_number=record.catalogue_number,
                        primary_udi_di=record.primary_udi_di,
                        reason_code="duplicate_basic_udi_di",
                        reason_message=(
                            f"Bulk Basic UDI POST keeps only the first eligible row for Basic UDI-DI {basic_udi_di}."
                        ),
                    )
                )
                continue

            eligible_basic_udi_dis.add(basic_udi_di)
            seen_basic_udi_dis.add(basic_udi_di)
            included.append(record)

        return included, excluded_records, len(eligible_basic_udi_dis)

    def _bulk_udidi_post_candidates(
        self,
        *,
        product_family: str,
        product_variant: str,
        records: list[CanonicalValidationRecord],
        excluded_records: list[BulkXmlExcludedRecord],
    ) -> tuple[list[CanonicalValidationRecord], list[BulkXmlExcludedRecord], int]:
        grouped_records: dict[str, list[CanonicalValidationRecord]] = {}
        eligible_child_records = 0

        for record in records:
            summary = self._bulk_record_summary(record)
            basic_udi_di = summary.basic_udi_di
            if not basic_udi_di:
                excluded_records.append(
                    BulkXmlExcludedRecord(
                        catalogue_number=record.catalogue_number,
                        primary_udi_di=record.primary_udi_di,
                        reason_code="missing_basic_udi_di",
                        reason_message="Record does not resolve to a Basic UDI-DI, so it cannot be used for Bulk UDI-DI POST.",
                    )
                )
                continue
            grouped_records.setdefault(basic_udi_di, []).append(record)

        included: list[CanonicalValidationRecord] = []
        for basic_udi_di, group in grouped_records.items():
            parent_already_posted = self.testing_state_store.has_successful_basic_udi_post(
                product_family=product_family,
                product_variant=product_variant,
                basic_udi_di=basic_udi_di,
            )
            if not parent_already_posted:
                for record in group:
                    excluded_records.append(
                        BulkXmlExcludedRecord(
                            catalogue_number=record.catalogue_number,
                            primary_udi_di=record.primary_udi_di,
                            reason_code="parent_not_registered",
                            reason_message=(
                                f"Basic UDI-DI {basic_udi_di} does not yet have a successful parent DEVICE.POST. Run Bulk Basic UDI-DI POST first."
                            ),
                    )
                )
                continue

            for record in group:
                if not record.primary_udi_di:
                    excluded_records.append(
                        BulkXmlExcludedRecord(
                            catalogue_number=record.catalogue_number,
                            primary_udi_di=record.primary_udi_di,
                            reason_code="missing_primary_udi_di",
                            reason_message="Record does not currently resolve to a Device UDI-DI, so it cannot be used for Bulk UDI-DI POST.",
                        )
                    )
                    continue
                if self.testing_state_store.has_successful_primary_udi_post(
                    product_family=product_family,
                    product_variant=product_variant,
                    primary_udi_di=record.primary_udi_di,
                ):
                    excluded_records.append(
                        BulkXmlExcludedRecord(
                            catalogue_number=record.catalogue_number,
                            primary_udi_di=record.primary_udi_di,
                            reason_code="child_already_registered",
                            reason_message=(
                                f"Device UDI-DI {record.primary_udi_di} already has a successful registration in tracked state."
                            ),
                        )
                    )
                    continue

                eligible_child_records += 1
                included.append(record)

        return included, excluded_records, eligible_child_records

    def _bulk_patch_candidates(
        self,
        *,
        records: list[CanonicalValidationRecord],
        excluded_records: list[BulkXmlExcludedRecord],
        basic_udi_di: str,
        record_count: int,
        selected_catalogue_numbers: list[str] | None = None,
    ) -> tuple[list[CanonicalValidationRecord], list[BulkXmlExcludedRecord], int]:
        grouped_records: dict[str, list[CanonicalValidationRecord]] = {}

        for record in records:
            summary = self._bulk_record_summary(record)
            if summary.basic_udi_di:
                grouped_records.setdefault(summary.basic_udi_di, []).append(record)

        parent_group = grouped_records.get(basic_udi_di)
        if not parent_group:
            raise ValueError(f"Basic UDI-DI {basic_udi_di} does not resolve to an eligible POST cohort for bulk PATCH.")

        child_records = parent_group[1:]
        eligible_child_records = len(child_records)
        if not child_records:
            raise ValueError(f"Basic UDI-DI {basic_udi_di} does not currently have any eligible Device UDI-DI POST rows.")

        selected_catalogue_set = {
            catalogue_number.strip()
            for catalogue_number in (selected_catalogue_numbers or [])
            if isinstance(catalogue_number, str) and catalogue_number.strip()
        }
        if selected_catalogue_set:
            unknown_catalogues = sorted(
                selected_catalogue_set.difference({record.catalogue_number or "" for record in child_records})
            )
            if unknown_catalogues:
                raise ValueError(
                    "Selected bulk PATCH devices do not belong to the chosen Basic UDI-DI parent: "
                    + ", ".join(unknown_catalogues)
                )
            filtered_records = [record for record in child_records if (record.catalogue_number or "") in selected_catalogue_set]
            if not filtered_records:
                raise ValueError(f"No selected child devices remain under Basic UDI-DI {basic_udi_di} for bulk PATCH.")
            return filtered_records[:record_count], excluded_records, eligible_child_records

        return child_records[:record_count], excluded_records, eligible_child_records

    def _bulk_patch_selected_records(
        self,
        *,
        product_family: str,
        product_variant: str,
        basic_udi_di: str,
        record_count: int,
        selected_catalogue_numbers: list[str] | None = None,
    ) -> tuple[list[CanonicalValidationRecord], int, list[str]]:
        variant_records = self._variant_xml_ready_records(
            product_family=product_family,
            product_variant=product_variant,
        )
        record_lookup = {
            record.catalogue_number or "": record
            for record in variant_records
            if (record.catalogue_number or "")
        }
        posted_entries = self.testing_state_store.posted_entries(
            product_family=product_family,
            product_variant=product_variant,
            basic_udi_di=basic_udi_di,
        )
        posted_catalogues = [
            str(entry.get("catalogue_number") or "").strip()
            for entry in posted_entries
            if str(entry.get("catalogue_number") or "").strip()
        ]
        eligible_child_records = len(posted_catalogues)
        if not posted_catalogues:
            raise ValueError(f"Basic UDI-DI {basic_udi_di} does not currently have any posted child devices for bulk PATCH.")

        selected_catalogues = [
            catalogue_number.strip()
            for catalogue_number in (selected_catalogue_numbers or posted_catalogues)
            if isinstance(catalogue_number, str) and catalogue_number.strip()
        ]
        if not selected_catalogues:
            raise ValueError(f"No selected child devices remain under Basic UDI-DI {basic_udi_di} for bulk PATCH.")

        unknown_catalogues = sorted(set(selected_catalogues).difference(posted_catalogues))
        if unknown_catalogues:
            raise ValueError(
                "Selected bulk PATCH devices do not belong to the chosen Basic UDI-DI parent: "
                + ", ".join(unknown_catalogues)
            )

        missing_variant_records = [catalogue for catalogue in selected_catalogues if catalogue not in record_lookup]
        selected_records = [
            record_lookup[catalogue]
            for catalogue in selected_catalogues
            if catalogue in record_lookup
        ][:record_count]
        return selected_records, eligible_child_records, missing_variant_records

    def _next_valid_post_record(
        self,
        *,
        product_family: str,
        product_variant: str,
    ) -> CanonicalValidationRecord:
        candidate_records, _, _ = self._variant_post_records_with_exclusions(
            product_family=product_family,
            product_variant=product_variant,
            record_count=None,
        )
        parent_and_child_known = 0
        parent_known_child_unknown = 0
        child_known_parent_unknown = 0

        for record in candidate_records:
            summary = self._bulk_record_summary(record)
            basic_udi_di = summary.basic_udi_di
            if not basic_udi_di or not record.primary_udi_di:
                continue
            parent_known = self.testing_state_store.has_successful_basic_udi_post(
                product_family=product_family,
                product_variant=product_variant,
                basic_udi_di=basic_udi_di,
            )
            child_known = self.testing_state_store.has_successful_primary_udi_post(
                product_family=product_family,
                product_variant=product_variant,
                primary_udi_di=record.primary_udi_di,
            )
            if parent_known and child_known:
                parent_and_child_known += 1
                continue
            if parent_known and not child_known:
                parent_known_child_unknown += 1
                return record
            if child_known and not parent_known:
                child_known_parent_unknown += 1
                continue
            return record

        if child_known_parent_unknown:
            raise ValueError(
                f"Tracked state is inconsistent for {product_family} / {product_variant}: one or more Device UDI-DI records appear registered while the Basic UDI-DI is not recorded as posted."
            )
        if parent_and_child_known:
            raise ValueError(
                f"No new DEVICE.POST candidate is currently available for {product_family} / {product_variant}."
            )
        raise ValueError(
            f"No XML-ready POST candidate is currently available for {product_family} / {product_variant}."
        )

    def preview_bulk_post(
        self,
        *,
        product_family: str,
        product_variant: str,
        record_count: int,
        chunk_sequence: int = 1,
    ) -> BulkPostPreview:
        normalized_count = self._normalize_record_count(record_count, self.settings.eudamed_max_batch_records)
        candidate_records, excluded_records, _ = self._variant_post_records_with_exclusions(
            product_family=product_family,
            product_variant=product_variant,
            record_count=None,
        )
        deduplicated_records, excluded_records, eligible_basic_udi_posts = self._deduplicate_bulk_basic_udi_posts(
            product_family=product_family,
            product_variant=product_variant,
            records=candidate_records,
            excluded_records=excluded_records,
        )
        included_records_raw = deduplicated_records[:normalized_count]
        if not included_records_raw:
            parent_already_registered = [
                record for record in excluded_records if record.reason_code == "parent_already_registered"
            ]
            if parent_already_registered:
                raise ValueError(
                    f"Parent Basic UDI-DI already exists for {product_family} / {product_variant}. Use Bulk UDI-DI POST to add child devices."
                )
            raise ValueError(
                f"No eligible Basic UDI-DI POST records are currently available for {product_family} / {product_variant}."
            )
        record_chunks = self.selector.chunk_records(included_records_raw, self.settings.eudamed_max_batch_records)
        total_chunks = len(record_chunks)
        chunk_summaries: list[BatchXmlChunkSummary] = []
        xml_chunks: list[tuple[int, list[CanonicalValidationRecord], bytes]] = []
        for sequence, chunk_records in enumerate(record_chunks, start=1):
            xml_records = [self.projection_builder.build_device_record(record) for record in chunk_records]
            xml_bytes = self.renderer.render_message_records(xml_records)
            validation = self.xml_validation_service.validate_message(xml_bytes)
            file_name = self.package_builder.bulk_file_name(
                product_family=product_family,
                product_variant=product_variant,
                flow="post",
                sequence=sequence,
                total_chunks=total_chunks,
            )
            xml_chunks.append((sequence, chunk_records, xml_bytes))
            chunk_summaries.append(
                BatchXmlChunkSummary(
                    sequence=sequence,
                    file_name=file_name,
                    record_count=len(chunk_records),
                    first_catalogue_number=chunk_records[0].catalogue_number if chunk_records else None,
                    last_catalogue_number=chunk_records[-1].catalogue_number if chunk_records else None,
                    validation=validation,
                )
            )
        if chunk_sequence < 1 or chunk_sequence > total_chunks:
            raise ValueError(f"Bulk POST chunk {chunk_sequence} is out of range. Valid chunks are 1 to {total_chunks}.")
        selected_sequence, selected_records, selected_xml_bytes = xml_chunks[chunk_sequence - 1]
        selected_summary = chunk_summaries[chunk_sequence - 1]
        return BulkPostPreview(
            product_family=product_family,
            product_variant=product_variant,
            requested_record_count=normalized_count,
            eligible_post_records=eligible_basic_udi_posts,
            included_record_count=len(included_records_raw),
            excluded_record_count=len(excluded_records),
            package_file_name=self.package_builder.bulk_package_file_name(
                product_family=product_family, product_variant=product_variant, flow="post"
            ),
            max_records_per_file=self.settings.eudamed_max_batch_records,
            chunk_count=total_chunks,
            selected_chunk_sequence=selected_sequence,
            selected_chunk_file_name=selected_summary.file_name,
            selected_chunk_record_count=len(selected_records),
            selected_chunk_xml=selected_xml_bytes.decode("utf-8"),
            selected_chunk_validation=selected_summary.validation,
            included_records=[self._bulk_record_summary(record) for record in included_records_raw],
            excluded_records=excluded_records,
            chunks=chunk_summaries,
        )

    def download_bulk_post(
        self,
        *,
        product_family: str,
        product_variant: str,
        record_count: int,
    ) -> tuple[str, bytes]:
        preview = self.preview_bulk_post(
            product_family=product_family,
            product_variant=product_variant,
            record_count=record_count,
        )
        members: list[tuple[str, bytes]] = []
        manifest_chunks = []
        raw_candidate_records, excluded_records, _ = self._variant_post_records_with_exclusions(
            product_family=product_family,
            product_variant=product_variant,
            record_count=None,
        )
        raw_records, _, _ = self._deduplicate_bulk_basic_udi_posts(
            product_family=product_family,
            product_variant=product_variant,
            records=raw_candidate_records,
            excluded_records=excluded_records,
        )
        raw_records = raw_records[: preview.included_record_count]
        record_chunks = self.selector.chunk_records(raw_records, self.settings.eudamed_max_batch_records)
        total_chunks = len(record_chunks)
        for sequence, chunk_records in enumerate(record_chunks, start=1):
            file_name = self.package_builder.bulk_file_name(
                product_family=product_family,
                product_variant=product_variant,
                flow="post",
                sequence=sequence,
                total_chunks=total_chunks,
            )
            xml_records = [self.projection_builder.build_device_record(record) for record in chunk_records]
            xml_bytes = self.renderer.render_message_records(xml_records)
            validation = self.xml_validation_service.validate_message(xml_bytes)
            members.append((file_name, xml_bytes))
            manifest_chunks.append(
                {
                    "sequence": sequence,
                    "file_name": file_name,
                    "record_count": len(chunk_records),
                    "valid": validation.valid,
                }
            )
        manifest = {
            "mode": "bulk_post",
            "product_family": product_family,
            "product_variant": product_variant,
            "requested_record_count": preview.requested_record_count,
            "included_record_count": preview.included_record_count,
            "excluded_record_count": preview.excluded_record_count,
            "records": [record.model_dump(mode="json") for record in preview.included_records],
            "excluded_records": [record.model_dump(mode="json") for record in preview.excluded_records],
            "chunks": manifest_chunks,
        }
        members.append(
            (
                "excluded-records.json",
                json.dumps([record.model_dump(mode="json") for record in preview.excluded_records], indent=2).encode(
                    "utf-8"
                ),
            )
        )
        return self.package_builder.build_archive(
            package_file_name=preview.package_file_name,
            members=members,
            manifest=manifest,
        )

    def preview_bulk_udidi_post(
        self,
        *,
        product_family: str,
        product_variant: str,
        record_count: int,
        chunk_sequence: int = 1,
    ) -> BulkUdidiPostPreview:
        normalized_count = self._normalize_record_count(record_count, self.settings.eudamed_max_batch_records)
        candidate_records, excluded_records, _ = self._variant_post_records_with_exclusions(
            product_family=product_family,
            product_variant=product_variant,
            record_count=None,
        )
        included_candidates, excluded_records, eligible_child_records = self._bulk_udidi_post_candidates(
            product_family=product_family,
            product_variant=product_variant,
            records=candidate_records,
            excluded_records=excluded_records,
        )
        included_records_raw = included_candidates[:normalized_count]
        if not included_records_raw:
            raise ValueError(
                f"No eligible Device UDI-DI POST records are currently available for {product_family} / {product_variant}."
            )

        record_chunks = self.selector.chunk_records(included_records_raw, self.settings.eudamed_max_batch_records)
        total_chunks = len(record_chunks)
        chunk_summaries: list[BatchXmlChunkSummary] = []
        xml_chunks: list[tuple[int, list[CanonicalValidationRecord], bytes]] = []
        for sequence, chunk_records in enumerate(record_chunks, start=1):
            xml_records = [
                self.projection_builder.build_udidi_post_record(self.projection_builder.build_device_record(record))
                for record in chunk_records
            ]
            xml_bytes = self.renderer.render_message_records(xml_records)
            validation = self.xml_validation_service.validate_message(xml_bytes)
            file_name = self.package_builder.bulk_file_name(
                product_family=product_family,
                product_variant=product_variant,
                flow="udidi-post",
                sequence=sequence,
                total_chunks=total_chunks,
            )
            xml_chunks.append((sequence, chunk_records, xml_bytes))
            chunk_summaries.append(
                BatchXmlChunkSummary(
                    sequence=sequence,
                    file_name=file_name,
                    record_count=len(chunk_records),
                    first_catalogue_number=chunk_records[0].catalogue_number if chunk_records else None,
                    last_catalogue_number=chunk_records[-1].catalogue_number if chunk_records else None,
                    validation=validation,
                )
            )

        if chunk_sequence < 1 or chunk_sequence > total_chunks:
            raise ValueError(f"Bulk UDI-DI POST chunk {chunk_sequence} is out of range. Valid chunks are 1 to {total_chunks}.")

        selected_sequence, selected_records, selected_xml_bytes = xml_chunks[chunk_sequence - 1]
        selected_summary = chunk_summaries[chunk_sequence - 1]
        return BulkUdidiPostPreview(
            product_family=product_family,
            product_variant=product_variant,
            requested_record_count=normalized_count,
            eligible_child_records=eligible_child_records,
            included_record_count=len(included_records_raw),
            excluded_record_count=len(excluded_records),
            package_file_name=self.package_builder.bulk_package_file_name(
                product_family=product_family,
                product_variant=product_variant,
                flow="udidi-post",
            ),
            max_records_per_file=self.settings.eudamed_max_batch_records,
            chunk_count=total_chunks,
            selected_chunk_sequence=selected_sequence,
            selected_chunk_file_name=selected_summary.file_name,
            selected_chunk_record_count=len(selected_records),
            selected_chunk_xml=selected_xml_bytes.decode("utf-8"),
            selected_chunk_validation=selected_summary.validation,
            included_records=[self._bulk_record_summary(record) for record in included_records_raw],
            excluded_records=excluded_records,
            chunks=chunk_summaries,
        )

    def download_bulk_udidi_post(
        self,
        *,
        product_family: str,
        product_variant: str,
        record_count: int,
    ) -> tuple[str, bytes]:
        preview = self.preview_bulk_udidi_post(
            product_family=product_family,
            product_variant=product_variant,
            record_count=record_count,
        )
        raw_candidate_records, excluded_records, _ = self._variant_post_records_with_exclusions(
            product_family=product_family,
            product_variant=product_variant,
            record_count=None,
        )
        raw_records, _, _ = self._bulk_udidi_post_candidates(
            product_family=product_family,
            product_variant=product_variant,
            records=raw_candidate_records,
            excluded_records=excluded_records,
        )
        raw_records = raw_records[: preview.included_record_count]

        members: list[tuple[str, bytes]] = []
        manifest_chunks = []
        record_chunks = self.selector.chunk_records(raw_records, self.settings.eudamed_max_batch_records)
        total_chunks = len(record_chunks)
        for sequence, chunk_records in enumerate(record_chunks, start=1):
            file_name = self.package_builder.bulk_file_name(
                product_family=product_family,
                product_variant=product_variant,
                flow="udidi-post",
                sequence=sequence,
                total_chunks=total_chunks,
            )
            xml_records = [
                self.projection_builder.build_udidi_post_record(self.projection_builder.build_device_record(record))
                for record in chunk_records
            ]
            xml_bytes = self.renderer.render_message_records(xml_records)
            validation = self.xml_validation_service.validate_message(xml_bytes)
            members.append((file_name, xml_bytes))
            manifest_chunks.append(
                {
                    "sequence": sequence,
                    "file_name": file_name,
                    "record_count": len(chunk_records),
                    "valid": validation.valid,
                }
            )
        manifest = {
            "mode": "bulk_udidi_post",
            "product_family": product_family,
            "product_variant": product_variant,
            "requested_record_count": preview.requested_record_count,
            "included_record_count": preview.included_record_count,
            "excluded_record_count": preview.excluded_record_count,
            "records": [record.model_dump(mode="json") for record in preview.included_records],
            "excluded_records": [record.model_dump(mode="json") for record in preview.excluded_records],
            "chunks": manifest_chunks,
        }
        members.append(
            (
                "excluded-records.json",
                json.dumps([record.model_dump(mode="json") for record in preview.excluded_records], indent=2).encode(
                    "utf-8"
                ),
            )
        )
        return self.package_builder.build_archive(
            package_file_name=preview.package_file_name,
            members=members,
            manifest=manifest,
        )

    def preview_bulk_patch(
        self,
        *,
        product_family: str,
        product_variant: str,
        basic_udi_di: str,
        record_count: int,
        scenario_id: str,
        scenario_inputs: dict[str, Any] | None = None,
        selected_catalogue_numbers: list[str] | None = None,
        chunk_sequence: int = 1,
    ) -> BulkPatchPreview:
        normalized_count = self._normalize_record_count(record_count, self.settings.eudamed_max_batch_records)
        excluded_records: list[BulkXmlExcludedRecord] = []
        candidate_records, eligible_child_records, missing_variant_records = self._bulk_patch_selected_records(
            product_family=product_family,
            product_variant=product_variant,
            basic_udi_di=basic_udi_di,
            record_count=normalized_count,
            selected_catalogue_numbers=selected_catalogue_numbers,
        )
        scenario_data = scenario_inputs or {}
        included_summaries: list[BulkXmlRecordSummary] = []
        included_payloads: list[tuple[BulkXmlRecordSummary, bytes]] = []
        scenario_label = next(
            (label for sid, label in {
                "equivalent_first_patch": "Equivalent First Patch",
                "trade_name_edit": "Trade Name Edit",
                "warning_add": "Critical Warnings",
                "storage_condition_edit": "Storage Condition Edit",
                "base_quantity_edit": "Base Quantity",
                "status_code_edit": "Status Code",
            }.items() if sid == scenario_id),
            scenario_id,
        )
        blocked_scenarios = {
            "latex_edit": "Scenario is currently rejected by EUDAMED business rules.",
            "sterile_edit": "Scenario is currently rejected by EUDAMED business rules.",
        }
        unimplemented_scenarios = {
            "production_identifier_edit",
            "sterilization_edit",
            "reprocessed_edit",
            "number_of_reuses_edit",
            "mdn_codes_edit",
        }
        if scenario_id in blocked_scenarios or scenario_id in unimplemented_scenarios:
            reason_code = "scenario_blocked_by_eudamed" if scenario_id in blocked_scenarios else "scenario_not_implemented"
            reason_message = blocked_scenarios.get(scenario_id, "Scenario is not implemented for bulk PATCH.")
            for record in candidate_records:
                excluded_records.append(
                    BulkXmlExcludedRecord(
                        catalogue_number=record.catalogue_number,
                        primary_udi_di=record.primary_udi_di,
                        reason_code=reason_code,
                        reason_message=reason_message,
                    )
                )
            candidate_records = []
            raise ValueError(f"{scenario_label}: {reason_message}")
        for catalogue_number in missing_variant_records:
            excluded_records.append(
                BulkXmlExcludedRecord(
                    catalogue_number=catalogue_number,
                    primary_udi_di=None,
                    reason_code="not_xml_ready",
                    reason_message="Posted device is not currently XML-ready in canonical validation.",
                )
            )
        for record in candidate_records:
            post_record = self.projection_builder.build_device_record(record)
            patch_state_resolution = self.testing_state_store.latest_successful_patch_state(
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=post_record.catalogue_number,
            )
            if scenario_id == "equivalent_first_patch":
                derived_version = "2"
            else:
                derived_version = "2" if not patch_state_resolution else str(int(patch_state_resolution.state.version) + 1)
            try:
                preview = self.preview_generated_patch_scenario(
                    product_family=record.product_family,
                    product_variant=record.product_variant,
                    catalogue_number=post_record.catalogue_number,
                    scenario_id=scenario_id,
                    patch_version=derived_version,
                    scenario_inputs=scenario_data,
                    require_reviewed_post_baseline=False,
                )
            except ValueError as exc:
                excluded_records.append(
                    BulkXmlExcludedRecord(
                        catalogue_number=record.catalogue_number,
                        primary_udi_di=record.primary_udi_di,
                        reason_code="scenario_input_missing" if "required" in str(exc).lower() else "invalid_next_version",
                        reason_message=str(exc),
                    )
                )
                continue
            included_summary = self._bulk_record_summary(record)
            included_summary.base_message_type = preview.context.base_message_type
            included_summary.base_version = preview.context.base_version
            included_summary.derived_version = preview.context.proposed_patch_version
            included_summary.accepted_state_source = preview.context.base_state_source
            included_summary.scenario_id = scenario_id
            included_summaries.append(included_summary)
            included_payloads.append((included_summary, preview.derived_patch_xml.encode("utf-8")))
        if not included_payloads:
            if missing_variant_records:
                raise ValueError(
                    "Selected posted devices are not currently XML-ready in canonical validation: "
                    + ", ".join(missing_variant_records)
                )
            raise ValueError(
                f"No eligible records are currently available for bulk PATCH generation for {product_family} / {product_variant}."
            )
        payload_chunks = [
            included_payloads[index : index + self.settings.eudamed_max_batch_records]
            for index in range(0, len(included_payloads), self.settings.eudamed_max_batch_records)
        ]
        total_chunks = len(payload_chunks)
        chunk_summaries: list[BatchXmlChunkSummary] = []
        rendered_chunks: list[tuple[int, list[BulkXmlRecordSummary], bytes, XmlValidationResult, str]] = []
        for sequence, chunk_payloads in enumerate(payload_chunks, start=1):
            xml_bytes = self.renderer.render_batch_from_strings([payload.decode("utf-8") for _, payload in chunk_payloads])
            validation = self.xml_validation_service.validate_message(xml_bytes)
            file_name = self.package_builder.bulk_file_name(
                product_family=product_family,
                product_variant=product_variant,
                flow=f"patch-{scenario_id.replace('_', '-')}",
                sequence=sequence,
                total_chunks=total_chunks,
            )
            chunk_records = [summary for summary, _ in chunk_payloads]
            rendered_chunks.append((sequence, chunk_records, xml_bytes, validation, file_name))
            chunk_summaries.append(
                BatchXmlChunkSummary(
                    sequence=sequence,
                    file_name=file_name,
                    record_count=len(chunk_records),
                    first_catalogue_number=chunk_records[0].catalogue_number if chunk_records else None,
                    last_catalogue_number=chunk_records[-1].catalogue_number if chunk_records else None,
                    validation=validation,
                )
            )
        if chunk_sequence < 1 or chunk_sequence > total_chunks:
            raise ValueError(f"Bulk PATCH chunk {chunk_sequence} is out of range. Valid chunks are 1 to {total_chunks}.")
        selected_sequence, selected_records, selected_xml_bytes, selected_validation, selected_file_name = rendered_chunks[
            chunk_sequence - 1
        ]
        return BulkPatchPreview(
            product_family=product_family,
            product_variant=product_variant,
            selected_basic_udi_di=basic_udi_di,
            requested_record_count=len(included_summaries),
            eligible_child_records=eligible_child_records,
            scenario_id=scenario_id,
            scenario_label=scenario_label,
            package_file_name=self.package_builder.bulk_package_file_name(
                product_family=product_family,
                product_variant=product_variant,
                flow=f"patch-{scenario_id.replace('_', '-')}",
            ),
            max_records_per_file=self.settings.eudamed_max_batch_records,
            chunk_count=total_chunks,
            selected_chunk_sequence=selected_sequence,
            selected_chunk_file_name=selected_file_name,
            selected_chunk_record_count=len(selected_records),
            selected_chunk_xml=selected_xml_bytes.decode("utf-8"),
            selected_chunk_validation=selected_validation,
            included_record_count=len(included_summaries),
            excluded_record_count=len(excluded_records),
            included_records=included_summaries,
            excluded_records=excluded_records,
            chunks=chunk_summaries,
        )

    def download_bulk_patch(
        self,
        *,
        product_family: str,
        product_variant: str,
        basic_udi_di: str,
        record_count: int,
        scenario_id: str,
        scenario_inputs: dict[str, Any] | None = None,
        selected_catalogue_numbers: list[str] | None = None,
    ) -> tuple[str, bytes]:
        preview = self.preview_bulk_patch(
            product_family=product_family,
            product_variant=product_variant,
            basic_udi_di=basic_udi_di,
            record_count=record_count,
            scenario_id=scenario_id,
            scenario_inputs=scenario_inputs,
            selected_catalogue_numbers=selected_catalogue_numbers,
        )
        candidate_records, _, missing_variant_records = self._bulk_patch_selected_records(
            product_family=product_family,
            product_variant=product_variant,
            basic_udi_di=basic_udi_di,
            record_count=preview.requested_record_count,
            selected_catalogue_numbers=selected_catalogue_numbers,
        )
        if not candidate_records and missing_variant_records:
            raise ValueError(
                "Selected posted devices are not currently XML-ready in canonical validation: "
                + ", ".join(missing_variant_records)
            )
        members: list[tuple[str, bytes]] = []
        chunk_members = []
        successful_catalogues = {record.catalogue_number for record in preview.included_records}
        included_payloads: list[tuple[BulkXmlRecordSummary, bytes]] = []
        scenario_data = scenario_inputs or {}
        for record in candidate_records:
            if record.catalogue_number not in successful_catalogues:
                continue
            patch_state_resolution = self.testing_state_store.latest_successful_patch_state(
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=record.catalogue_number or "",
            )
            if scenario_id == "equivalent_first_patch":
                derived_version = "2"
            else:
                derived_version = "2" if not patch_state_resolution else str(int(patch_state_resolution.state.version) + 1)
            scenario_preview = self.preview_generated_patch_scenario(
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=record.catalogue_number or "",
                scenario_id=scenario_id,
                patch_version=derived_version,
                scenario_inputs=scenario_data,
                require_reviewed_post_baseline=False,
            )
            summary = next(item for item in preview.included_records if item.catalogue_number == record.catalogue_number)
            included_payloads.append((summary, scenario_preview.derived_patch_xml.encode("utf-8")))
        payload_chunks = [
            included_payloads[index : index + self.settings.eudamed_max_batch_records]
            for index in range(0, len(included_payloads), self.settings.eudamed_max_batch_records)
        ]
        total_chunks = len(payload_chunks)
        for sequence, chunk_payloads in enumerate(payload_chunks, start=1):
            xml_bytes = self.renderer.render_batch_from_strings([payload.decode("utf-8") for _, payload in chunk_payloads])
            file_name = self.package_builder.bulk_file_name(
                product_family=product_family,
                product_variant=product_variant,
                flow=f"patch-{scenario_id.replace('_', '-')}",
                sequence=sequence,
                total_chunks=total_chunks,
            )
            members.append((file_name, xml_bytes))
            chunk_members.append({"sequence": sequence, "file_name": file_name, "record_count": len(chunk_payloads)})
        manifest = {
            "mode": "bulk_patch",
            "product_family": product_family,
            "product_variant": product_variant,
            "basic_udi_di": basic_udi_di,
            "requested_record_count": preview.requested_record_count,
            "eligible_child_records": preview.eligible_child_records,
            "scenario_id": scenario_id,
            "scenario_label": preview.scenario_label,
            "included_record_count": preview.included_record_count,
            "excluded_record_count": preview.excluded_record_count,
            "records": [record.model_dump(mode="json") for record in preview.included_records],
            "excluded_records": [record.model_dump(mode="json") for record in preview.excluded_records],
            "chunks": chunk_members,
        }
        members.append(
            (
                "excluded-records.json",
                json.dumps([record.model_dump(mode="json") for record in preview.excluded_records], indent=2).encode(
                    "utf-8"
                ),
            )
        )
        return self.package_builder.build_archive(
            package_file_name=preview.package_file_name,
            members=members,
            manifest=manifest,
        )

    def preview_generated_patch_scenario(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
        scenario_id: str,
        patch_version: str,
        scenario_inputs: dict[str, Any] | None = None,
        require_reviewed_post_baseline: bool = True,
    ) -> GeneratedPatchScenarioPreview:
        if require_reviewed_post_baseline:
            self._require_reviewed_post_baseline(
                product_family=product_family,
                product_variant=product_variant,
                catalogue_number=catalogue_number,
            )
        scenario_data = scenario_inputs or {}
        post_source_record = self.selector.find_post_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        post_record = self.projection_builder.build_device_record(post_source_record)
        patch_state_resolution = self.testing_state_store.latest_successful_patch_state(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        normalized_version = self._validate_patch_version(patch_version)
        registered_device_anchor = self._registered_device_anchor(post_record)

        if normalized_version == "2":
            self._require_tracked_successful_post_baseline(
                product_family=product_family,
                product_variant=product_variant,
                primary_udi_di=post_record.primary_udi_di,
            )
            scenario_base_record = post_record
            base_message_type = "POST"
            base_version = "1"
            base_state_source = "accepted_post"
            base_state_label = "Accepted POST version 1"
        else:
            if not patch_state_resolution:
                raise ValueError(
                    "PATCH versions above 2 require a tracked latest successful PATCH state for this device."
                )
            scenario_base_record = self.projection_builder.build_patch_record_from_state(
                post_record,
                patch_state_resolution.state,
            )
            base_message_type = "PATCH"
            base_version = patch_state_resolution.state.version
            base_state_source = patch_state_resolution.source
            base_state_label = f"Latest successful PATCH version {patch_state_resolution.state.version}"

        base_xml_bytes = self.renderer.render_message(scenario_base_record)
        base_validation = self.xml_validation_service.validate_message(base_xml_bytes)

        derived_patch_record, scenario_label, field_deltas = self._build_generated_patch_scenario(
            post_record=post_record,
            scenario_base_record=scenario_base_record,
            base_message_type=base_message_type,
            scenario_id=scenario_id,
            patch_version=normalized_version,
            scenario_inputs=scenario_data,
        )
        derived_patch_xml_bytes = self.renderer.render_message(derived_patch_record)
        derived_patch_validation = self.xml_validation_service.validate_message(derived_patch_xml_bytes)
        derived_patch_file_name = self._scenario_patch_file_name(
            product_family=post_record.product_family,
            product_variant=post_record.product_variant,
            catalogue_number=post_record.catalogue_number,
            scenario_id=scenario_id,
        )
        self.testing_state_store.record_generated_patch_context(
            product_family=post_record.product_family,
            product_variant=post_record.product_variant,
            catalogue_number=post_record.catalogue_number,
            primary_udi_di=post_record.primary_udi_di,
            basic_udi_di=post_record.basic_identifier_code,
            patch_version=normalized_version,
            scenario_id=scenario_id,
            scenario_label=scenario_label,
            changed_fields=[delta.model_dump(mode="json") for delta in field_deltas],
            latest_successful_state=self._patch_state_snapshot_payload(derived_patch_record),
        )

        return GeneratedPatchScenarioPreview(
            scenario_id=scenario_id,
            scenario_label=scenario_label,
            product_family=post_record.product_family,
            product_variant=post_record.product_variant,
            catalogue_number=post_record.catalogue_number,
            primary_udi_di=post_record.primary_udi_di,
            registered_device_anchor=registered_device_anchor,
            context=PatchScenarioContext(
                scenario_id=scenario_id,
                scenario_label=scenario_label,
                product_family=post_record.product_family,
                product_variant=post_record.product_variant,
                catalogue_number=post_record.catalogue_number,
                primary_udi_di=post_record.primary_udi_di,
                parent_post_version="1",
                base_message_type=base_message_type,
                base_version=base_version,
                proposed_patch_version=normalized_version,
                base_state_source=base_state_source,
                base_state_label=base_state_label,
            ),
            field_deltas=field_deltas,
            base_file_name=(
                registered_device_anchor.post_file_name
                if base_message_type == "POST"
                else registered_device_anchor.patch_file_name
            ),
            base_xml=base_xml_bytes.decode("utf-8"),
            base_validation=base_validation,
            derived_patch_file_name=derived_patch_file_name,
            derived_patch_xml=derived_patch_xml_bytes.decode("utf-8"),
            derived_patch_validation=derived_patch_validation,
        )

    def download_generated_patch_scenario(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
        scenario_id: str,
        patch_version: str,
        scenario_inputs: dict[str, Any] | None = None,
    ) -> tuple[str, bytes]:
        preview = self.preview_generated_patch_scenario(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
            scenario_id=scenario_id,
            patch_version=patch_version,
            scenario_inputs=scenario_inputs,
        )
        package_file_name = self.package_builder.scenario_package_file_name(
            product_family=preview.product_family or product_family,
            product_variant=preview.product_variant or product_variant,
            scenario_id=preview.scenario_id,
            catalogue_number=preview.catalogue_number,
        )
        manifest = {
            "mode": preview.mode,
            "message_type": "UDI_DI.PATCH",
            "scenario_id": preview.scenario_id,
            "scenario_label": preview.scenario_label,
            "product_family": preview.product_family,
            "product_variant": preview.product_variant,
            "catalogue_number": preview.catalogue_number,
            "primary_udi_di": preview.primary_udi_di,
            "base_file_name": preview.base_file_name,
            "derived_patch_file_name": preview.derived_patch_file_name,
            "base_message_type": preview.context.base_message_type,
            "base_version": preview.context.base_version,
            "proposed_patch_version": preview.context.proposed_patch_version,
            "valid": preview.derived_patch_validation.valid,
        }
        return self.package_builder.build_archive(
            package_file_name=package_file_name,
            members=[(preview.derived_patch_file_name, preview.derived_patch_xml.encode("utf-8"))],
            manifest=manifest,
        )

    def preview_single_record(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> SingleRecordXmlPreview:
        record = self.selector.find_xml_ready_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        xml_record = self.projection_builder.build_device_record(record)
        xml_bytes = self.renderer.render_message(xml_record)
        validation = self.xml_validation_service.validate_message(xml_bytes)
        return SingleRecordXmlPreview(
            product_family=record.product_family,
            product_variant=record.product_variant,
            submission_operation=record.submission_operation,
            catalogue_number=xml_record.catalogue_number,
            trade_name=xml_record.trade_name,
            primary_udi_di=xml_record.primary_udi_di,
            file_name=self.package_builder.file_name(
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=xml_record.catalogue_number,
            ),
            xml=xml_bytes.decode("utf-8"),
            validation=validation,
        )

    def download_single_record(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> tuple[str, bytes]:
        preview = self.preview_single_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        return preview.file_name, preview.xml.encode("utf-8")

    def preview_post_registration(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> PostRegistrationPreview:
        record = self.selector.find_xml_ready_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        if self._normalized_operation(record.submission_operation) != "POST":
            raise ValueError(
                f"Catalogue number {catalogue_number} is not currently classified as a POST record for "
                f"{product_family} / {product_variant}."
            )

        post_record = self.projection_builder.build_device_record(record)
        parent_registered = self.testing_state_store.has_successful_basic_udi_post(
            product_family=record.product_family,
            product_variant=record.product_variant,
            basic_udi_di=post_record.basic_identifier_code,
        )
        xml_record = (
            self.projection_builder.build_udidi_post_record(post_record)
            if parent_registered
            else post_record
        )
        message_type = "UDI_DI.POST" if parent_registered else "DEVICE.POST"
        patch_state_resolution = self.testing_state_store.latest_successful_patch_state(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=post_record.catalogue_number,
        )
        post_xml_bytes = self.renderer.render_message(xml_record)
        post_file_name = self.package_builder.operation_file_name(
            product_family=record.product_family,
            product_variant=record.product_variant,
            operation="UDIDI-POST" if parent_registered else "POST",
            catalogue_number=post_record.catalogue_number,
        )
        self.testing_state_store.mark_reviewed_post(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=post_record.catalogue_number,
        )
        registered_device_anchor = self._registered_device_anchor(post_record)
        return PostRegistrationPreview(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=post_record.catalogue_number,
            primary_udi_di=post_record.primary_udi_di,
            message_type=message_type,
            registered_device_anchor=registered_device_anchor,
            latest_successful_patch_state=patch_state_resolution.state if patch_state_resolution else None,
            latest_successful_patch_scenario_id=patch_state_resolution.scenario_id if patch_state_resolution else None,
            post_file_name=post_file_name,
            post_xml=post_xml_bytes.decode("utf-8"),
            post_validation=self.xml_validation_service.validate_message(post_xml_bytes),
        )

    def preview_next_post_registration(
        self,
        *,
        product_family: str,
        product_variant: str,
    ) -> PostRegistrationPreview:
        record = self._next_valid_post_record(
            product_family=product_family,
            product_variant=product_variant,
        )
        return self.preview_post_registration(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=record.catalogue_number or "",
        )

    def preview_market_info_put(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
        market_countries: list[tuple[str, bool]] | None = None,
        market_info_version: str | None = None,
    ) -> MarketInfoPutPreview:
        record = self.selector.find_xml_ready_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        market_info_record = self.projection_builder.build_market_info_record(record)
        baseline_market_countries = list(market_info_record.market_countries)
        normalized_market_info_version = self._validate_market_info_version(market_info_version)
        if market_countries is not None:
            normalized_market_countries = self._normalized_market_info_countries(market_countries)
            market_info_record = replace(
                market_info_record,
                market_countries=normalized_market_countries,
            )
        market_info_record = replace(
            market_info_record,
            market_info_version=normalized_market_info_version,
        )
        self.testing_state_store.record_generated_market_info_context(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=market_info_record.catalogue_number,
            primary_udi_di=market_info_record.primary_udi_di,
            basic_udi_di=self._record_basic_udi_di(record),
            market_info_version=market_info_record.market_info_version,
            baseline_market_countries=[
                {
                    "country": country_code,
                    "original_placed_on_market": original_placed_on_market,
                }
                for country_code, original_placed_on_market in baseline_market_countries
            ],
            market_countries=[
                {
                    "country": country_code,
                    "original_placed_on_market": original_placed_on_market,
                }
                for country_code, original_placed_on_market in market_info_record.market_countries
            ],
        )
        xml_bytes = self.renderer.render_market_info_message(market_info_record)
        validation = self.xml_validation_service.validate_message(xml_bytes)
        return MarketInfoPutPreview(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=market_info_record.catalogue_number,
            primary_udi_di=market_info_record.primary_udi_di,
            market_info_version=market_info_record.market_info_version,
            registered_device_anchor=RegisteredDeviceAnchor(
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=market_info_record.catalogue_number,
                primary_udi_di=market_info_record.primary_udi_di,
                post_file_name=self.package_builder.operation_file_name(
                    product_family=record.product_family,
                    product_variant=record.product_variant,
                    operation="POST",
                    catalogue_number=market_info_record.catalogue_number,
                ),
                patch_file_name=self.package_builder.operation_file_name(
                    product_family=record.product_family,
                    product_variant=record.product_variant,
                    operation="PATCH",
                    catalogue_number=market_info_record.catalogue_number,
                ),
                post_valid=True,
                patch_valid=True,
                eudamed_status="EUDAMED Accepted",
            ),
            file_name=self.package_builder.market_info_file_name(
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=market_info_record.catalogue_number,
            ),
            xml=xml_bytes.decode("utf-8"),
            validation=validation,
        )

    def download_market_info_put(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
        market_countries: list[tuple[str, bool]] | None = None,
        market_info_version: str | None = None,
    ) -> tuple[str, bytes]:
        preview = self.preview_market_info_put(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
            market_countries=market_countries,
            market_info_version=market_info_version,
        )
        package_file_name = self.package_builder.operation_package_file_name(
            product_family=product_family,
            product_variant=product_variant,
            operation="market-info-put",
            catalogue_number=catalogue_number,
        )
        manifest = {
            "mode": preview.mode,
            "product_family": preview.product_family,
            "product_variant": preview.product_variant,
            "catalogue_number": preview.catalogue_number,
            "primary_udi_di": preview.primary_udi_di,
            "file_name": preview.file_name,
            "validation": preview.validation.model_dump(mode="json"),
        }
        return self.package_builder.build_archive(
            package_file_name=package_file_name,
            members=[(preview.file_name, preview.xml.encode("utf-8"))],
            manifest=manifest,
        )

    @staticmethod
    def _normalized_market_info_countries(
        market_countries: list[tuple[str, bool]],
    ) -> list[tuple[str, bool]]:
        normalized_items: list[tuple[str, bool]] = []
        seen_countries: set[str] = set()
        for country_code, original in market_countries:
            normalized_country_code = DeviceXmlProjectionBuilder._country_code(country_code)
            if not normalized_country_code:
                continue
            if normalized_country_code in seen_countries:
                continue
            seen_countries.add(normalized_country_code)
            normalized_items.append((normalized_country_code, bool(original)))
        if not normalized_items:
            raise ValueError("At least one market country is required for MARKET_INFO.PUT generation.")
        return normalized_items

    @staticmethod
    def _validate_market_info_version(market_info_version: str | None) -> str:
        normalized = str(market_info_version or "").strip()
        if not normalized:
            raise ValueError("market_info_version is required for MARKET_INFO.PUT generation.")
        try:
            parsed = int(normalized)
        except ValueError as exc:
            raise ValueError("market_info_version must be a positive integer.") from exc
        if parsed < 1:
            raise ValueError("market_info_version must be a positive integer.")
        return str(parsed)

    def _registered_device_anchor(
        self,
        post_record: DeviceXmlRecord,
    ) -> RegisteredDeviceAnchor:
        return RegisteredDeviceAnchor(
            product_family=post_record.product_family,
            product_variant=post_record.product_variant,
            catalogue_number=post_record.catalogue_number,
            primary_udi_di=post_record.primary_udi_di,
            post_file_name=self.package_builder.operation_file_name(
                product_family=post_record.product_family,
                product_variant=post_record.product_variant,
                operation="POST",
                catalogue_number=post_record.catalogue_number,
            ),
            patch_file_name=self.package_builder.operation_file_name(
                product_family=post_record.product_family,
                product_variant=post_record.product_variant,
                operation="PATCH",
                catalogue_number=post_record.catalogue_number,
            ),
            post_valid=True,
            patch_valid=True,
            eudamed_status="EUDAMED Accepted",
        )

    def _build_generated_patch_scenario(
        self,
        *,
        post_record,
        scenario_base_record,
        base_message_type: str,
        scenario_id: str,
        patch_version: str,
        scenario_inputs: dict[str, Any],
    ) -> tuple[Any, str, list[PatchScenarioFieldDelta]]:
        if scenario_id == "equivalent_first_patch":
            if patch_version != "2":
                raise ValueError("equivalent_first_patch must use patch_version 2.")
            derived_record = self.projection_builder.build_equivalent_first_patch(post_record)
            return (
                derived_record,
                "Equivalent First Patch",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value="1",
                        after_value="2",
                    ),
                ],
            )
        if scenario_id == "trade_name_edit":
            new_trade_name = self._required_string_input(scenario_inputs, "new_trade_name")
            derived_record = self.projection_builder.build_trade_name_edit_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                new_trade_name=new_trade_name,
                patch_version=patch_version,
            )
            return (
                derived_record,
                "Trade Name Edit",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                        after_value=patch_version,
                    ),
                    PatchScenarioFieldDelta(
                        field_key="trade_name",
                        label="Trade Name",
                        target_xpath_hint="udidi:tradeNames/lsn:name/lsn:textValue",
                        before_value=scenario_base_record.trade_name,
                        after_value=new_trade_name,
                    ),
                ],
            )
        if scenario_id == "warning_add":
            new_warning_code = self._required_string_input(scenario_inputs, "new_warning_code")
            new_warning_comment = self._optional_string_input(scenario_inputs, "new_warning_comment")
            derived_record = self.projection_builder.build_warning_add_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                new_warning_code=new_warning_code,
                new_warning_comment=new_warning_comment,
                patch_version=patch_version,
            )
            return (
                derived_record,
                "Critical Warnings",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                        after_value=patch_version,
                    ),
                    PatchScenarioFieldDelta(
                        field_key="critical_warning_replace",
                        label="Critical Warning",
                        target_xpath_hint="udidi:criticalWarnings/commondi:warning",
                        before_value=", ".join(item.code for item in scenario_base_record.critical_warnings) or "None",
                        after_value=(
                            f"{new_warning_code} ({new_warning_comment})"
                            if new_warning_comment
                            else new_warning_code
                        ),
                    ),
                ],
            )
        if scenario_id == "storage_condition_edit":
            raw_updates = scenario_inputs.get("updated_conditions")
            if not isinstance(raw_updates, list) or not raw_updates:
                raise ValueError("updated_conditions must contain at least one condition update.")
            condition_updates: dict[str, str] = {}
            for item in raw_updates:
                if not isinstance(item, dict):
                    raise ValueError("Each updated_conditions item must be an object.")
                code = self._required_string_input(item, "condition_code")
                replacement_comment = self._required_string_input(item, "replacement_comment")
                condition_updates[code] = replacement_comment
            baseline_by_code = {item.code: item.comment for item in scenario_base_record.storage_conditions}
            missing_codes = sorted(code for code in condition_updates if code not in baseline_by_code)
            if missing_codes:
                raise ValueError(
                    f"Unknown storage condition codes for scenario editing: {', '.join(missing_codes)}."
                )
            derived_record = self.projection_builder.build_storage_condition_edit_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                condition_updates=condition_updates,
                patch_version=patch_version,
            )
            field_deltas = [
                PatchScenarioFieldDelta(
                    field_key="patch_version",
                    label="PATCH Version",
                    target_xpath_hint="e:version",
                    before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                    after_value=patch_version,
                )
            ]
            for code, replacement_comment in condition_updates.items():
                field_deltas.append(
                    PatchScenarioFieldDelta(
                        field_key=f"storage_condition_{code}",
                        label=f"Storage Condition {code}",
                        target_xpath_hint="udidi:storageHandlingConditions/commondi:condition/commondi:comments/lsn:name/lsn:textValue",
                        before_value=baseline_by_code.get(code),
                        after_value=replacement_comment,
                    )
                )
            return derived_record, "Storage Condition Edit", field_deltas
        if scenario_id == "base_quantity_edit":
            new_base_quantity = self._required_positive_int_input(scenario_inputs, "new_base_quantity")
            derived_record = self.projection_builder.build_base_quantity_edit_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                new_base_quantity=new_base_quantity,
                patch_version=patch_version,
            )
            return (
                derived_record,
                "Base Quantity",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                        after_value=patch_version,
                    ),
                    PatchScenarioFieldDelta(
                        field_key="base_quantity",
                        label="Base Quantity",
                        target_xpath_hint="udidi:baseQuantity",
                        before_value=self._stringify_optional(scenario_base_record.base_quantity),
                        after_value=str(new_base_quantity),
                    ),
                ],
            )
        if scenario_id == "sterile_edit":
            new_sterile = self._required_bool_input(scenario_inputs, "new_sterile")
            derived_record = self.projection_builder.build_sterile_edit_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                new_sterile=new_sterile,
                patch_version=patch_version,
            )
            return (
                derived_record,
                "Sterile",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                        after_value=patch_version,
                    ),
                    PatchScenarioFieldDelta(
                        field_key="sterile",
                        label="Sterile",
                        target_xpath_hint="udidi:sterile",
                        before_value=self._bool_label(scenario_base_record.sterile),
                        after_value=self._bool_label(new_sterile),
                    ),
                ],
            )
        if scenario_id == "latex_edit":
            new_contains_latex = self._required_bool_input(scenario_inputs, "new_contains_latex")
            derived_record = self.projection_builder.build_latex_edit_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                new_contains_latex=new_contains_latex,
                patch_version=patch_version,
            )
            return (
                derived_record,
                "Latex",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                        after_value=patch_version,
                    ),
                    PatchScenarioFieldDelta(
                        field_key="latex",
                        label="Latex",
                        target_xpath_hint="udidi:latex",
                        before_value=self._bool_label(scenario_base_record.contains_latex),
                        after_value=self._bool_label(new_contains_latex),
                    ),
                ],
            )
        if scenario_id == "status_code_edit":
            new_status_code = self._required_choice_input(
                scenario_inputs,
                "new_status_code",
                {
                    "NOT_INTENDED_FOR_EU_MARKET",
                    "ON_THE_MARKET",
                    "NO_LONGER_PLACED_ON_THE_MARKET",
                },
            )
            derived_record = self.projection_builder.build_status_code_edit_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                new_status_code=new_status_code,
                patch_version=patch_version,
            )
            return (
                derived_record,
                "Status Code",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                        after_value=patch_version,
                    ),
                    PatchScenarioFieldDelta(
                        field_key="status_code",
                        label="Status Code",
                        target_xpath_hint="udidi:status/commondi:code",
                        before_value=scenario_base_record.status_code,
                        after_value=new_status_code,
                    ),
                ],
            )
        raise ValueError(f"Unsupported generated PATCH scenario {scenario_id!r}.")

    @staticmethod
    def _validate_patch_version(patch_version: str) -> str:
        normalized = str(patch_version).strip()
        if not normalized:
            raise ValueError("patch_version is required.")
        try:
            parsed = int(normalized)
        except ValueError as exc:
            raise ValueError("patch_version must be an integer.") from exc
        if parsed < 2:
            raise ValueError("patch_version must be an integer greater than or equal to 2.")
        return str(parsed)

    def _patch_edit_base_record(
        self,
        post_record: DeviceXmlRecord,
        scenario_base_record: DeviceXmlRecord,
        base_message_type: str,
    ) -> DeviceXmlRecord:
        if base_message_type == "POST":
            return self.projection_builder.build_equivalent_first_patch(post_record)
        return scenario_base_record

    @staticmethod
    def _scenario_before_version(base_message_type: str, scenario_base_record: DeviceXmlRecord) -> str:
        if base_message_type == "POST":
            return "1"
        return scenario_base_record.patch_version_override or "2"

    @staticmethod
    def _required_string_input(payload: dict[str, Any], key: str) -> str:
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{key} is required.")
        return value.strip()

    @staticmethod
    def _optional_string_input(payload: dict[str, Any], key: str) -> str | None:
        value = payload.get(key)
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError(f"{key} must be a string when provided.")
        normalized = value.strip()
        return normalized or None

    @staticmethod
    def _required_positive_int_input(payload: dict[str, Any], key: str) -> int:
        value = payload.get(key)
        if isinstance(value, bool):
            raise ValueError(f"{key} must be a positive integer.")
        if not isinstance(value, (int, str)):
            raise ValueError(f"{key} must be a positive integer.")
        try:
            parsed = int(value)
        except ValueError as exc:
            raise ValueError(f"{key} must be a positive integer.") from exc
        if parsed <= 0:
            raise ValueError(f"{key} must be a positive integer.")
        return parsed

    @staticmethod
    def _required_bool_input(payload: dict[str, Any], key: str) -> bool:
        value = payload.get(key)
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized == "true":
                return True
            if normalized == "false":
                return False
        raise ValueError(f"{key} must be true or false.")

    @staticmethod
    def _required_choice_input(payload: dict[str, Any], key: str, allowed: set[str]) -> str:
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{key} is required.")
        normalized = value.strip()
        if normalized not in allowed:
            raise ValueError(f"{key} must be one of: {', '.join(sorted(allowed))}.")
        return normalized

    @staticmethod
    def _bool_label(value: bool) -> str:
        return "true" if value else "false"

    @staticmethod
    def _stringify_optional(value: object) -> str | None:
        if value is None:
            return None
        return str(value)

    def _scenario_patch_file_name(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
        scenario_id: str,
    ) -> str:
        return (
            f"{self.package_builder._slugify(product_family)}-"
            f"{self.package_builder._slugify(product_variant)}-"
            f"patch-{scenario_id.replace('_', '-')}-"
            f"{self.package_builder._safe_catalogue_number(catalogue_number)}.xml"
        )

    def download_post_package(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> tuple[str, bytes]:
        preview = self.preview_post_registration(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        package_file_name = self.package_builder.operation_package_file_name(
            product_family=preview.product_family or product_family,
            product_variant=preview.product_variant or product_variant,
            operation="POST",
            catalogue_number=preview.catalogue_number,
        )
        manifest = {
            "mode": preview.mode,
            "message_type": preview.message_type,
            "product_family": preview.product_family,
            "product_variant": preview.product_variant,
            "catalogue_number": preview.catalogue_number,
            "primary_udi_di": preview.primary_udi_di,
            "file_name": preview.post_file_name,
            "valid": preview.post_validation.valid,
        }
        return self.package_builder.build_archive(
            package_file_name=package_file_name,
            members=[(preview.post_file_name, preview.post_xml.encode("utf-8"))],
            manifest=manifest,
        )

    def preview_batch(
        self,
        *,
        product_family: str,
        product_variant: str,
        chunk_sequence: int = 1,
    ) -> BatchXmlPreview:
        bundle = self._validation_bundle()
        records = self.selector.xml_ready_variant_records(
            bundle.records,
            product_family=product_family,
            product_variant=product_variant,
        )
        if not records:
            raise ValueError(
                f"No XML-ready records are currently available for batch generation for "
                f"{product_family} / {product_variant}."
            )

        record_chunks = self.selector.chunk_records(records, self.settings.eudamed_max_batch_records)
        xml_chunks: list[tuple[int, list[CanonicalValidationRecord], bytes]] = []
        chunk_summaries: list[BatchXmlChunkSummary] = []
        total_chunks = len(record_chunks)
        for sequence, chunk_records in enumerate(record_chunks, start=1):
            xml_records = [self.projection_builder.build_device_record(record) for record in chunk_records]
            xml_bytes = self.renderer.render_message_records(xml_records)
            validation = self.xml_validation_service.validate_message(xml_bytes)
            file_name = self.package_builder.batch_file_name(
                product_family=product_family,
                product_variant=product_variant,
                sequence=sequence,
                total_chunks=total_chunks,
            )
            xml_chunks.append((sequence, chunk_records, xml_bytes))
            chunk_summaries.append(
                BatchXmlChunkSummary(
                    sequence=sequence,
                    file_name=file_name,
                    record_count=len(chunk_records),
                    first_catalogue_number=chunk_records[0].catalogue_number if chunk_records else None,
                    last_catalogue_number=chunk_records[-1].catalogue_number if chunk_records else None,
                    validation=validation,
                )
            )

        if chunk_sequence < 1 or chunk_sequence > total_chunks:
            raise ValueError(f"Batch chunk {chunk_sequence} is out of range. Valid chunks are 1 to {total_chunks}.")

        selected_sequence, selected_records, selected_xml_bytes = xml_chunks[chunk_sequence - 1]
        selected_summary = chunk_summaries[chunk_sequence - 1]
        variant_summary = next(
            (
                summary
                for summary in bundle.variant_summaries
                if summary.product_family == product_family and summary.product_variant == product_variant
            ),
            None,
        )
        excluded_records = variant_summary.xml_blocked_records if variant_summary else 0
        return BatchXmlPreview(
            product_family=product_family,
            product_variant=product_variant,
            submission_operation=records[0].submission_operation,
            package_file_name=self.package_builder.batch_package_file_name(
                product_family=product_family,
                product_variant=product_variant,
            ),
            total_ready_records=len(records),
            excluded_records=excluded_records,
            max_records_per_file=self.settings.eudamed_max_batch_records,
            chunk_count=total_chunks,
            selected_chunk_sequence=selected_sequence,
            selected_chunk_file_name=selected_summary.file_name,
            selected_chunk_record_count=len(selected_records),
            selected_chunk_xml=selected_xml_bytes.decode("utf-8"),
            selected_chunk_validation=selected_summary.validation,
            chunks=chunk_summaries,
        )

    def download_batch(
        self,
        *,
        product_family: str,
        product_variant: str,
    ) -> tuple[str, bytes]:
        bundle = self._validation_bundle()
        records = self.selector.xml_ready_variant_records(
            bundle.records,
            product_family=product_family,
            product_variant=product_variant,
        )
        if not records:
            raise ValueError(
                f"No XML-ready records are currently available for batch generation for "
                f"{product_family} / {product_variant}."
            )

        record_chunks = self.selector.chunk_records(records, self.settings.eudamed_max_batch_records)
        package_file_name = self.package_builder.batch_package_file_name(
            product_family=product_family,
            product_variant=product_variant,
        )
        variant_summary = next(
            (
                summary
                for summary in bundle.variant_summaries
                if summary.product_family == product_family and summary.product_variant == product_variant
            ),
            None,
        )
        excluded_records = variant_summary.xml_blocked_records if variant_summary else 0

        members: list[tuple[str, bytes]] = []
        manifest_chunks = []
        total_chunks = len(record_chunks)
        for sequence, chunk_records in enumerate(record_chunks, start=1):
            file_name = self.package_builder.batch_file_name(
                product_family=product_family,
                product_variant=product_variant,
                sequence=sequence,
                total_chunks=total_chunks,
            )
            xml_records = [self.projection_builder.build_device_record(record) for record in chunk_records]
            xml_bytes = self.renderer.render_message_records(xml_records)
            validation = self.xml_validation_service.validate_message(xml_bytes)
            members.append((file_name, xml_bytes))
            manifest_chunks.append(
                {
                    "sequence": sequence,
                    "file_name": file_name,
                    "record_count": len(chunk_records),
                    "first_catalogue_number": chunk_records[0].catalogue_number if chunk_records else None,
                    "last_catalogue_number": chunk_records[-1].catalogue_number if chunk_records else None,
                    "valid": validation.valid,
                    "error_count": len(validation.errors),
                }
            )

        manifest = {
            "package_file_name": package_file_name,
            "product_family": product_family,
            "product_variant": product_variant,
            "submission_operation": records[0].submission_operation,
            "total_ready_records": len(records),
            "excluded_records": excluded_records,
            "max_records_per_file": self.settings.eudamed_max_batch_records,
            "chunk_count": len(record_chunks),
            "chunks": manifest_chunks,
        }
        return self.package_builder.build_archive(
            package_file_name=package_file_name,
            members=members,
            manifest=manifest,
        )

    @staticmethod
    def _normalized_operation(submission_operation: str | None) -> str:
        return (submission_operation or "POST").upper()
