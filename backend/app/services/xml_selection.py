from __future__ import annotations

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
        bundle = self._bundle()
        for record in bundle.records:
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
        bundle = self._bundle()
        for record in bundle.records:
            if (
                self._record_matches_family_variant(
                    record,
                    product_family=product_family,
                    product_variant=product_variant,
                )
                and record.catalogue_number == catalogue_number
                and record.xml_readiness.status == "complete"
                and (record.submission_operation or "").upper() == "POST"
            ):
                return record
        raise ValueError(
            f"Catalogue number {catalogue_number} is not an XML-ready POST record for "
            f"{product_family} / {product_variant}."
        )

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

    def _bundle(self):
        try:
            return self.projection_service.latest_bundle(require_import=self.require_import)
        except (CanonicalProjectionNoImportError, CanonicalProjectionUnavailableError) as exc:
            raise ValueError(str(exc)) from exc
