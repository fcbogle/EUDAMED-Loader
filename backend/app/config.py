from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    excel_dir: Path
    schema_dir: Path
    basic_udi_reference_dir: Path
    normalization_dir: Path
    canonical_mapping_dir: Path
    reports_dir: Path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    project_root = Path(__file__).resolve().parents[2]
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
        basic_udi_reference_dir=Path(
            os.getenv(
                "EUDAMED_BASIC_UDI_REFERENCE_DIR",
                str(project_root / "data" / "basic_udi_reference"),
            )
        ),
        normalization_dir=project_root / "config" / "normalization",
        canonical_mapping_dir=project_root / "config" / "canonical_mapping",
        reports_dir=project_root / "docs" / "reports",
    )
