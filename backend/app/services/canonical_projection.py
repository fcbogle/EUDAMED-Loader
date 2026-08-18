from __future__ import annotations

from app.services.canonical_validation import CanonicalValidationService
from app.services.workbook_import import WorkbookImportService
from app.validation_models import CanonicalValidationBundle


class CanonicalProjectionNoImportError(RuntimeError):
    pass


class CanonicalProjectionUnavailableError(RuntimeError):
    pass


class CanonicalProjectionService:
    def __init__(
        self,
        *,
        validation_service: CanonicalValidationService | None = None,
        workbook_import_service: WorkbookImportService | None = None,
    ) -> None:
        self.validation_service = validation_service or CanonicalValidationService()
        self.workbook_import_service = workbook_import_service or WorkbookImportService()

    def latest_bundle(self, *, require_import: bool = False) -> CanonicalValidationBundle:
        latest_import = self.workbook_import_service.latest_import_batch()
        if latest_import is None:
            if require_import:
                raise CanonicalProjectionNoImportError(
                    "No workbook import snapshot exists yet. Import workbooks before loading canonical validation."
                )
            bundle = self.validation_service.build_validation_bundle()
            bundle.persistence_source = "workbook_fallback"
            bundle.projection_status = "no_import"
            bundle.source_import_batch_id = None
            return bundle

        bundle = self.workbook_import_service.canonical_validation_bundle_from_sqlite(
            import_batch_id=latest_import.import_batch_id,
        )
        rebuilt = False
        if bundle is None or bundle.total_source_records != latest_import.source_row_count:
            self.workbook_import_service.rebuild_canonical_projection(
                import_batch_id=latest_import.import_batch_id,
            )
            rebuilt = True
            bundle = self.workbook_import_service.canonical_validation_bundle_from_sqlite(
                import_batch_id=latest_import.import_batch_id,
            )
        if bundle is None:
            raise CanonicalProjectionUnavailableError(
                "Canonical validation snapshot is missing in SQLite for the latest workbook import. "
                "Re-run the workbook import or rebuild the canonical projection."
            )

        bundle.persistence_source = "sqlite_projection"
        bundle.source_import_batch_id = latest_import.import_batch_id
        bundle.projection_status = "rebuilt" if rebuilt else "ready"
        return bundle
