from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import PROJECT_ROOT, get_settings, validate_schema_package
from app.routers import canonical, normalization, profiling, schemas, xml_generation
from app.services.workbook_import import WorkbookImportService

logger = logging.getLogger(__name__)

app = FastAPI(
    title="EUDAMED Profiling API",
    version="0.1.0",
    description="Read-only profiling and normalization review APIs for EUDAMED source data.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(profiling.router, prefix="/api")
app.include_router(normalization.router, prefix="/api")
app.include_router(canonical.router, prefix="/api")
app.include_router(schemas.router, prefix="/api")
app.include_router(xml_generation.router, prefix="/api")


@app.on_event("startup")
def log_testing_state_context() -> None:
    settings = get_settings()
    validate_schema_package(settings)
    service = WorkbookImportService()
    logger.warning(
        "Environment: %s | XML schema: %s | database: %s | import batches: %s | backup dir: %s",
        settings.environment,
        settings.eudamed_message_schema_version,
        settings.testing_state_db_path,
        service.import_batch_count(),
        settings.testing_state_backup_dir,
    )


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/environment")
def environment_context() -> dict[str, str]:
    """Expose the active target without disclosing actor settings or storage paths."""
    settings = get_settings()
    packages = {
        (PROJECT_ROOT / "data/schema_profiles/dev-3.0.32-derived").resolve(): "Derived package",
        (PROJECT_ROOT / "data/schema_profiles/prod-3.0.30").resolve(): "Official package",
    }
    return {
        "environment": settings.environment,
        "message_schema_version": settings.eudamed_message_schema_version,
        "schema_package": packages.get(settings.schema_dir.resolve(), "Custom package"),
    }
