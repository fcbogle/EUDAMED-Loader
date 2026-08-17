from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.canonical_validation import CanonicalValidationService
from app.services.canonical_review import CanonicalReviewService
from app.services.workbook_import import WorkbookImportService

router = APIRouter(tags=["canonical"])


@router.get("/canonical-review")
def canonical_review() -> dict:
    return CanonicalReviewService().load_review_bundle().model_dump(mode="json")


@router.get("/canonical-validation")
def canonical_validation() -> dict:
    return CanonicalValidationService().build_validation_bundle().model_dump(mode="json")


@router.get("/canonical-validation/sqlite")
def canonical_validation_sqlite() -> dict:
    workbook_import_service = WorkbookImportService()
    latest_import = workbook_import_service.latest_import_batch()
    bundle = workbook_import_service.canonical_validation_bundle_from_sqlite()
    if latest_import is not None and (
        bundle is None or bundle.total_source_records != latest_import.source_row_count
    ):
        workbook_import_service.rebuild_canonical_projection(import_batch_id=latest_import.import_batch_id)
        bundle = workbook_import_service.canonical_validation_bundle_from_sqlite(
            import_batch_id=latest_import.import_batch_id,
        )
    if bundle is None:
        return CanonicalValidationService().build_validation_bundle().model_dump(mode="json")
    return bundle.model_dump(mode="json")
