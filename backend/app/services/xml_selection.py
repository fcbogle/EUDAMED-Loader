from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any

from app.services.identity import normalize_identity, normalized_family_candidates
from app.services.canonical_projection import (
    CanonicalProjectionNoImportError,
    CanonicalProjectionService,
    CanonicalProjectionUnavailableError,
)
from app.services.canonical_validation import CanonicalValidationService
from app.validation_models import CanonicalValidationRecord


class ValidationRecordSelector:
    def __init__(self, validation_service: CanonicalValidationService, *, require_import: bool = False) -> None:
        self._request: ContextVar[dict[str, Any] | None] = ContextVar("xml_selection_request", default=None)
        self.validation_service = validation_service
        self.require_import = require_import
        self.projection_service = CanonicalProjectionService(validation_service=validation_service)

    def find_xml_ready_record(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> CanonicalValidationRecord:
        for record in self._catalogue_candidates(catalogue_number):
            if (
                self._record_matches_family_variant(
                    record,
                    product_family=product_family,
                    product_variant=product_variant,
                )
                and record.catalogue_number == catalogue_number
                and record.xml_readiness.status == "complete"
            ):
                return record
        raise ValueError(
            f"Catalogue number {catalogue_number} was not found as an XML-ready record for "
            f"{product_family} / {product_variant}."
        )

    def find_post_record(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> CanonicalValidationRecord:
        for record in self._catalogue_candidates(catalogue_number):
            if (
                self._record_matches_family_variant(
                    record,
                    product_family=product_family,
                    product_variant=product_variant,
                )
                and record.catalogue_number == catalogue_number
                and record.xml_readiness.status == "complete"
                and ((record.submission_operation or "").upper() == "POST" or self._imported_baseline_record(record))
            ):
                return record
        raise ValueError(
            f"Catalogue number {catalogue_number} is not an XML-ready POST record for "
            f"{product_family} / {product_variant}."
        )

    def _imported_baseline_record(self, record: CanonicalValidationRecord) -> bool:
        from app.config import get_settings
        from app.services.testing_state_store import TestingStateStore
        if get_settings().environment != "prod":
            return False
        state = TestingStateStore().accepted_post_state(product_family=record.product_family,
            product_variant=record.product_variant, catalogue_number=record.catalogue_number or "")
        return bool(state and state.get("accepted_state_source") == "production_export")

    @staticmethod
    def xml_ready_variant_records(
        records: list[CanonicalValidationRecord],
        *,
        product_family: str,
        product_variant: str,
    ) -> list[CanonicalValidationRecord]:
        return [
            record
            for record in records
            if ValidationRecordSelector._record_matches_family_variant(
                record,
                product_family=product_family,
                product_variant=product_variant,
            )
            and record.xml_readiness.status == "complete"
        ]

    @staticmethod
    def _optional_string(value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return str(value)
        normalized = value.strip()
        return normalized or None

    _normalize_identity = staticmethod(normalize_identity)

    _normalized_family_candidates = staticmethod(normalized_family_candidates)

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

    @staticmethod
    def chunk_records(
        records: list[CanonicalValidationRecord],
        max_records_per_file: int,
    ) -> list[list[CanonicalValidationRecord]]:
        return [
            records[index : index + max_records_per_file]
            for index in range(0, len(records), max_records_per_file)
        ]

    @contextmanager
    def request_scope(self, projection_service):
        if self._request.get() is not None:
            yield
            return
        token = self._request.set({"projection": projection_service})
        try:
            yield
        finally:
            self._request.reset(token)

    def _bundle(self):
        request = self._request.get()
        if request is not None and "bundle" in request:
            return request["bundle"]
        try:
            projection = request["projection"] if request is not None else self.projection_service
            bundle = projection.latest_bundle(require_import=self.require_import)
            if request is not None:
                request["bundle"] = bundle
            return bundle
        except (CanonicalProjectionNoImportError, CanonicalProjectionUnavailableError) as exc:
            raise ValueError(str(exc)) from exc

    def _catalogue_candidates(self, catalogue_number):
        bundle = self._bundle()
        request = self._request.get()
        if request is None:
            return bundle.records
        if "catalogues" not in request:
            lookup = {}
            for record in bundle.records:
                lookup.setdefault(record.catalogue_number, []).append(record)
            request["catalogues"] = lookup
        return request["catalogues"].get(catalogue_number, [])
