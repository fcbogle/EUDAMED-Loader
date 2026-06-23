from __future__ import annotations

from app.services.canonical_validation import CanonicalValidationService
from app.validation_models import CanonicalValidationRecord


class ValidationRecordSelector:
    def __init__(self, validation_service: CanonicalValidationService) -> None:
        self.validation_service = validation_service

    def find_xml_ready_record(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> CanonicalValidationRecord:
        bundle = self.validation_service.build_validation_bundle()
        for record in bundle.records:
            if (
                record.product_family == product_family
                and record.product_variant == product_variant
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
        bundle = self.validation_service.build_validation_bundle()
        for record in bundle.records:
            if (
                record.product_family == product_family
                and record.product_variant == product_variant
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
            if record.product_family == product_family
            and record.product_variant == product_variant
            and record.xml_readiness.status == "complete"
        ]

    @staticmethod
    def chunk_records(
        records: list[CanonicalValidationRecord],
        max_records_per_file: int,
    ) -> list[list[CanonicalValidationRecord]]:
        return [
            records[index : index + max_records_per_file]
            for index in range(0, len(records), max_records_per_file)
        ]
