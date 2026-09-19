from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal
import xml.etree.ElementTree as ET

from pydantic import BaseModel
from dotenv import dotenv_values


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseModel):
    environment: Literal["dev", "prod"] = "dev"
    environment_file: Path | None = None
    data_root: Path | None = None
    artifacts_dir: Path
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


def _path_setting(project_root: Path, values: dict[str, str], env_name: str, default: Path) -> Path:
    raw = values.get(env_name)
    if not raw:
        return default
    candidate = Path(raw).expanduser()
    if not candidate.is_absolute():
        candidate = project_root / candidate
    return candidate


def _bool_setting(values: dict[str, str], env_name: str, default: bool = False) -> bool:
    raw = values.get(env_name)
    if raw is None:
        return default
    if raw.strip().lower() not in {"1", "true", "yes", "on", "0", "false", "no", "off"}:
        raise ValueError(f"{env_name} must be a boolean")
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _profile_values(environment: str, *, process_overrides: bool = True) -> tuple[dict[str, str], Path]:
    """Read only the selected profile; never export dotenv values into os.environ."""
    custom = os.getenv("EUDAMED_ENV_FILE") if process_overrides else None
    path = Path(custom).expanduser() if custom else PROJECT_ROOT / f".env.{environment}"
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    if not path.exists():
        if custom or environment == "prod":
            raise ValueError(f"Environment file does not exist: {path}")
        # Preserve existing installations until .env.dev is created. Never used for Prod.
        path = PROJECT_ROOT / ".env"
    values = {key: value for key, value in dotenv_values(path, interpolate=False).items() if value is not None} if path.exists() else {}
    declared = values.get("EUDAMED_ENVIRONMENT")
    if declared and declared != environment:
        raise ValueError(f"{path.name} declares a different EUDAMED_ENVIRONMENT")
    if process_overrides:
        values.update({key: value for key, value in os.environ.items() if key.startswith("EUDAMED_")})
    return values, path


def _overlap(a: Path, b: Path) -> bool:
    a, b = a.resolve(), b.resolve()
    return a == b or a in b.parents or b in a.parents


def _validate_profile(settings: Settings, values: dict[str, str]) -> None:
    expected = "3.0.30" if settings.environment == "prod" else "3.0.32"
    if settings.eudamed_message_schema_version != expected:
        raise ValueError(f"{settings.environment} requires message schema {expected}")
    schema = settings.schema_dir / "service" / "Message" / "MessageType.xsd"
    try:
        root = ET.parse(schema).getroot()
        versions = {node.get("fixed") for node in root.findall(".//{http://www.w3.org/2001/XMLSchema}attribute") if node.get("name") == "version"}
    except (OSError, ET.ParseError) as exc:
        raise ValueError(f"Cannot read message schema: {schema}") from exc
    if versions != {expected}:
        raise ValueError(f"Schema package version does not match {expected}: {schema}")
    if not (settings.schema_dir / "service" / "Message.xsd").is_file():
        raise ValueError("Schema package is missing service/Message.xsd")
    if settings.environment != "prod":
        # Do not let a Dev launch consume the reserved production tree.
        reserved = [PROJECT_ROOT / "data" / "prod"]
        prod_file = PROJECT_ROOT / ".env.prod"
        if prod_file.exists():
            prod_values = {k: v for k, v in dotenv_values(prod_file, interpolate=False).items() if v is not None}
            if prod_values.get("EUDAMED_DATA_ROOT"):
                reserved.append(_path_setting(PROJECT_ROOT, prod_values, "EUDAMED_DATA_ROOT", reserved[0]))
        for path in _isolated_paths(settings):
            if any(_overlap(path, root) for root in reserved):
                raise ValueError(f"Dev storage overlaps reserved Prod storage: {path}")
        return

    required = ["EUDAMED_DATA_ROOT", "EUDAMED_EXCEL_DIR", "EUDAMED_BASIC_UDI_REFERENCE_DIR",
                "EUDAMED_TESTING_STATE_DB_PATH", "EUDAMED_TESTING_STATE_BACKUP_DIR",
                "EUDAMED_NORMALIZATION_DIR", "EUDAMED_REPORTS_DIR", "EUDAMED_ARTIFACTS_DIR",
                "EUDAMED_SCHEMA_DIR", "EUDAMED_MESSAGE_SCHEMA_VERSION", "EUDAMED_MANUFACTURER_SRN_OVERRIDE",
                "EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE"]
    missing = [key for key in required if not values.get(key, "").strip()]
    if missing:
        raise ValueError("Prod requires explicit settings: " + ", ".join(missing))
    if not settings.eudamed_suppress_authorised_representative and not settings.eudamed_authorised_representative_srn_override:
        raise ValueError("Prod requires an explicit authorised representative SRN or explicit suppression")
    if settings.eudamed_suppress_authorised_representative and settings.eudamed_authorised_representative_srn_override:
        raise ValueError("Prod cannot both suppress and override the authorised representative")
    dev_values, _ = _profile_values("dev", process_overrides=False)
    dev_actor = dev_values.get("EUDAMED_MANUFACTURER_SRN_OVERRIDE")
    if settings.eudamed_manufacturer_srn_override in {"UK-MF-000033261", dev_actor}:
        raise ValueError("Prod manufacturer SRN must differ from the Dev/Playground SRN")
    if not settings.data_root:
        raise ValueError("Prod requires EUDAMED_DATA_ROOT")
    prod_root = settings.data_root.resolve()
    dev_locations = {
        "EUDAMED_EXCEL_DIR": PROJECT_ROOT / "data/source_excel",
        "EUDAMED_BASIC_UDI_REFERENCE_DIR": PROJECT_ROOT / "data/basic_udi_reference",
        "EUDAMED_TESTING_STATE_DB_PATH": PROJECT_ROOT / "data/testing/testing-state.sqlite3",
        "EUDAMED_TESTING_STATE_BACKUP_DIR": PROJECT_ROOT / "data/testing/backups",
        "EUDAMED_NORMALIZATION_DIR": PROJECT_ROOT / "config/normalization",
        "EUDAMED_REPORTS_DIR": PROJECT_ROOT / "docs/reports",
        "EUDAMED_ARTIFACTS_DIR": PROJECT_ROOT / "data/dev/artifacts",
    }
    for key, default in dev_locations.items():
        for dev_path in (default, _path_setting(PROJECT_ROOT, dev_values, key, default)):
            if _overlap(prod_root, dev_path):
                raise ValueError(f"Prod data root overlaps Dev storage: {key}")
    paths = _isolated_paths(settings)
    for path in paths:
        if prod_root not in path.resolve().parents:
            raise ValueError(f"Prod storage must be beneath EUDAMED_DATA_ROOT: {path}")
    for i, first in enumerate(paths):
        for second in paths[i + 1:]:
            if _overlap(first, second):
                raise ValueError(f"Prod storage locations must not overlap: {first} and {second}")
    # Also catch hard links to the existing Dev database, which resolve() cannot detect.
    dev_db = _path_setting(PROJECT_ROOT, dev_values, "EUDAMED_TESTING_STATE_DB_PATH", dev_locations["EUDAMED_TESTING_STATE_DB_PATH"])
    for candidate in {dev_db, dev_locations["EUDAMED_TESTING_STATE_DB_PATH"]}:
        if candidate.exists() and settings.testing_state_db_path.exists() and settings.testing_state_db_path.samefile(candidate):
            raise ValueError("Prod database is the Dev database")


def _isolated_paths(settings: Settings) -> list[Path]:
    return [settings.excel_dir, settings.basic_udi_reference_dir, settings.testing_state_db_path,
            settings.testing_state_backup_dir, settings.normalization_dir, settings.reports_dir,
            settings.artifacts_dir]


def validate_schema_package(settings: Settings) -> None:
    """Compile the selected schema before any service can create database state."""
    from lxml import etree

    try:
        parser = etree.XMLParser(resolve_entities=False, no_network=True)
        etree.XMLSchema(etree.parse(str(settings.schema_dir / "service/Message.xsd"), parser))
    except (OSError, etree.LxmlError) as exc:
        raise ValueError(f"Cannot compile schema package: {settings.schema_dir}") from exc


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    project_root = PROJECT_ROOT
    environment = os.getenv("EUDAMED_ENVIRONMENT", "dev").strip().lower()
    if environment not in {"dev", "prod"}:
        raise ValueError("EUDAMED_ENVIRONMENT must be dev or prod")
    values, env_file = _profile_values(environment)
    def path(key: str, default: Path) -> Path:
        return _path_setting(project_root, values, key, default)
    basic_dir = path("EUDAMED_BASIC_UDI_REFERENCE_DIR", project_root / "data/basic_udi_reference")
    legacy_service_id = values.get("EUDAMED_SERVICE_ID")
    schema_profile = "prod-3.0.30" if environment == "prod" else "dev-3.0.32-derived"
    settings = Settings(
        environment=environment,
        environment_file=env_file,
        data_root=path("EUDAMED_DATA_ROOT", project_root / "data" / environment),
        excel_dir=path("EUDAMED_EXCEL_DIR", project_root / "data/source_excel"),
        schema_dir=path("EUDAMED_SCHEMA_DIR", project_root / "data/schema_profiles" / schema_profile),
        testing_state_db_path=path("EUDAMED_TESTING_STATE_DB_PATH", project_root / "data/testing/testing-state.sqlite3"),
        testing_state_backup_dir=path("EUDAMED_TESTING_STATE_BACKUP_DIR", project_root / "data/testing/backups"),
        testing_state_backup_keep_count=int(values.get("EUDAMED_TESTING_STATE_BACKUP_KEEP_COUNT", "10")),
        basic_udi_reference_dir=basic_dir,
        basic_udi_reference_workbook=basic_dir / "BasicUDIs.xlsx",
        legacy_basic_udi_reference_workbook=basic_dir / "uat-eudamed_mdr_products_tracekey_sample_data.xlsx",
        excluded_excel_workbook_names=("Template for Accessories_Footspares EUDAMED.xlsx",),
        normalization_dir=path("EUDAMED_NORMALIZATION_DIR", project_root / "config/normalization"),
        canonical_mapping_dir=project_root / "config/canonical_mapping",
        reports_dir=path("EUDAMED_REPORTS_DIR", project_root / "docs/reports"),
        artifacts_dir=path("EUDAMED_ARTIFACTS_DIR", project_root / "data/dev/artifacts"),
        eudamed_message_schema_version=values.get("EUDAMED_MESSAGE_SCHEMA_VERSION", "3.0.32" if environment == "dev" else "3.0.30"),
        eudamed_manufacturer_srn_override=values.get("EUDAMED_MANUFACTURER_SRN_OVERRIDE") or None,
        eudamed_authorised_representative_srn_override=values.get("EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE") or None,
        eudamed_suppress_authorised_representative=_bool_setting(values, "EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE", False),
        eudamed_max_batch_records=int(values.get("EUDAMED_MAX_BATCH_RECORDS", "300")),
        eudamed_post_service_id=values.get("EUDAMED_POST_SERVICE_ID", legacy_service_id or "DEVICE"),
        eudamed_patch_service_id=values.get("EUDAMED_PATCH_SERVICE_ID", "UDI_DI"),
        eudamed_market_info_service_id=values.get("EUDAMED_MARKET_INFO_SERVICE_ID", "MARKET_INFO"),
        eudamed_post_profile=values.get("EUDAMED_POST_PROFILE", "device_post"),
        eudamed_patch_profile=values.get("EUDAMED_PATCH_PROFILE", "udidi_patch"),
    )
    _validate_profile(settings, values)
    return settings
