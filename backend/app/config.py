from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    excel_dir: Path
    schema_dir: Path
    basic_udi_reference_dir: Path
    basic_udi_reference_workbook: Path
    legacy_basic_udi_reference_workbook: Path
    excluded_excel_workbook_names: tuple[str, ...]
    normalization_dir: Path
    canonical_mapping_dir: Path
    reports_dir: Path
    eudamed_message_schema_version: str
    eudamed_max_batch_records: int
    eudamed_service_id: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    project_root = Path(__file__).resolve().parents[2]
    basic_udi_reference_dir = Path(
        os.getenv(
            "EUDAMED_BASIC_UDI_REFERENCE_DIR",
            str(project_root / "data" / "basic_udi_reference"),
        )
    )
    return Settings(
        excel_dir=Path(
            os.getenv(
                "EUDAMED_EXCEL_DIR",
                str(project_root / "data" / "source_excel"),
            )
        ),
        schema_dir=Path(
            os.getenv(
                "EUDAMED_SCHEMA_DIR",
                str(project_root / "data" / "schemas"),
            )
        ),
        basic_udi_reference_dir=basic_udi_reference_dir,
        basic_udi_reference_workbook=basic_udi_reference_dir / "BasicUDIs.xlsx",
        legacy_basic_udi_reference_workbook=basic_udi_reference_dir
        / "uat-eudamed_mdr_products_tracekey_sample_data.xlsx",
        excluded_excel_workbook_names=("Template for Accessories_Footspares EUDAMED.xlsx",),
        normalization_dir=project_root / "config" / "normalization",
        canonical_mapping_dir=project_root / "config" / "canonical_mapping",
        reports_dir=project_root / "docs" / "reports",
        eudamed_message_schema_version=os.getenv("EUDAMED_MESSAGE_SCHEMA_VERSION", "3.0.30"),
        eudamed_max_batch_records=int(os.getenv("EUDAMED_MAX_BATCH_RECORDS", "300")),
        eudamed_service_id=os.getenv("EUDAMED_SERVICE_ID", "UDI_DI"),
    )
