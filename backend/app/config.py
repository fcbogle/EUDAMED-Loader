from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    excel_dir: Path
    schema_dir: Path
    normalization_dir: Path
    reports_dir: Path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    project_root = Path(__file__).resolve().parents[2]
    return Settings(
        excel_dir=Path(
            os.getenv(
                "EUDAMED_EXCEL_DIR",
                "/Users/frankbogle/Documents/EUDAMED/InputExcel/EUDAMED_Excels",
            )
        ),
        schema_dir=Path(
            os.getenv(
                "EUDAMED_SCHEMA_DIR",
                "/Users/frankbogle/Documents/EUDAMED/Schema/EUDAMED_Schemas",
            )
        ),
        normalization_dir=project_root / "config" / "normalization",
        reports_dir=project_root / "docs" / "reports",
    )
