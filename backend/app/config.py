from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


class Settings(BaseModel):
    excel_dir: Path
    schema_dir: Path
    testing_state_db_path: Path
    testing_state_backup_dir: Path
    testing_state_backup_keep_count: int
    basic_udi_reference_dir: Path
    basic_udi_reference_workbook: Path
    legacy_basic_udi_reference_workbook: Path
    excluded_excel_workbook_names: tuple[str, ...]
    normalization_dir: Path
    canonical_mapping_dir: Path
    reports_dir: Path
    eudamed_message_schema_version: str
    eudamed_manufacturer_srn_override: str | None
    eudamed_authorised_representative_srn_override: str | None
    eudamed_suppress_authorised_representative: bool
    eudamed_max_batch_records: int
    eudamed_post_service_id: str
    eudamed_patch_service_id: str
    eudamed_market_info_service_id: str
    eudamed_post_profile: str
    eudamed_patch_profile: str


def _path_setting(project_root: Path, env_name: str, default: Path) -> Path:
    raw = os.getenv(env_name)
    if not raw:
        return default
    candidate = Path(raw).expanduser()
    if not candidate.is_absolute():
        candidate = project_root / candidate
    return candidate


def _bool_setting(env_name: str, default: bool = False) -> bool:
    raw = os.getenv(env_name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    project_root = PROJECT_ROOT
    basic_udi_reference_dir = _path_setting(
        project_root,
        "EUDAMED_BASIC_UDI_REFERENCE_DIR",
        project_root / "data" / "basic_udi_reference",
    )
    legacy_service_id = os.getenv("EUDAMED_SERVICE_ID")
    return Settings(
        excel_dir=_path_setting(
            project_root,
            "EUDAMED_EXCEL_DIR",
            project_root / "data" / "source_excel",
        ),
        schema_dir=_path_setting(
            project_root,
            "EUDAMED_SCHEMA_DIR",
            project_root / "data" / "schemas",
        ),
        testing_state_db_path=_path_setting(
            project_root,
            "EUDAMED_TESTING_STATE_DB_PATH",
            project_root / "data" / "testing" / "testing-state.sqlite3",
        ),
        testing_state_backup_dir=_path_setting(
            project_root,
            "EUDAMED_TESTING_STATE_BACKUP_DIR",
            project_root / "data" / "testing" / "backups",
        ),
        testing_state_backup_keep_count=int(os.getenv("EUDAMED_TESTING_STATE_BACKUP_KEEP_COUNT", "10")),
        basic_udi_reference_dir=basic_udi_reference_dir,
        basic_udi_reference_workbook=basic_udi_reference_dir / "BasicUDIs.xlsx",
        legacy_basic_udi_reference_workbook=basic_udi_reference_dir
        / "uat-eudamed_mdr_products_tracekey_sample_data.xlsx",
        excluded_excel_workbook_names=("Template for Accessories_Footspares EUDAMED.xlsx",),
        normalization_dir=project_root / "config" / "normalization",
        canonical_mapping_dir=project_root / "config" / "canonical_mapping",
        reports_dir=project_root / "docs" / "reports",
        eudamed_message_schema_version=os.getenv("EUDAMED_MESSAGE_SCHEMA_VERSION", "3.0.32"),
        eudamed_manufacturer_srn_override=os.getenv("EUDAMED_MANUFACTURER_SRN_OVERRIDE") or None,
        eudamed_authorised_representative_srn_override=(
            os.getenv("EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE") or None
        ),
        eudamed_suppress_authorised_representative=_bool_setting(
            "EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE",
            False,
        ),
        eudamed_max_batch_records=int(os.getenv("EUDAMED_MAX_BATCH_RECORDS", "300")),
        eudamed_post_service_id=os.getenv("EUDAMED_POST_SERVICE_ID", legacy_service_id or "DEVICE"),
        eudamed_patch_service_id=os.getenv("EUDAMED_PATCH_SERVICE_ID", legacy_service_id or "UDI_DI"),
        eudamed_market_info_service_id=os.getenv("EUDAMED_MARKET_INFO_SERVICE_ID", "MARKET_INFO"),
        eudamed_post_profile=os.getenv("EUDAMED_POST_PROFILE", "device_post"),
        eudamed_patch_profile=os.getenv("EUDAMED_PATCH_PROFILE", "udidi_patch"),
    )
