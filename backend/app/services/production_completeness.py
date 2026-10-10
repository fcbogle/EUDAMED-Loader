"""Recover duplicate completeness fields from explicitly recorded export evidence."""
from app.validation_models import CanonicalValidationRecord


def populate_export_market_status(record: CanonicalValidationRecord) -> bool:
    fields = {field.canonical_path: field for field in record.fields}
    status = fields.get("device_record.status")
    market_status = fields.get("device_record.market_availability.market_status")
    if (status is None or market_status is None or market_status.value is not None
            or status.value is None or status.source_detail != "Supplied EUDAMED export snapshot"):
        return False
    market_status.value = status.value
    market_status.source = status.source
    market_status.source_detail = status.source_detail
    market_status.review_note = "Same UDI-DI status as the supplied accepted export; no default was applied."
    return True
