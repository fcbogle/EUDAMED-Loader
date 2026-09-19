from __future__ import annotations

from pathlib import Path

from app.config import get_settings


def test_default_settings_use_project_local_data_dirs(monkeypatch) -> None:
    monkeypatch.delenv("EUDAMED_EXCEL_DIR", raising=False)
    monkeypatch.delenv("EUDAMED_SCHEMA_DIR", raising=False)
    monkeypatch.delenv("EUDAMED_BASIC_UDI_REFERENCE_DIR", raising=False)
    monkeypatch.delenv("EUDAMED_TESTING_STATE_DB_PATH", raising=False)
    monkeypatch.delenv("EUDAMED_TESTING_STATE_BACKUP_DIR", raising=False)
    monkeypatch.delenv("EUDAMED_TESTING_STATE_BACKUP_KEEP_COUNT", raising=False)
    get_settings.cache_clear()

    settings = get_settings()
    project_root = Path(__file__).resolve().parents[2]

    assert settings.excel_dir == project_root / "data" / "source_excel"
    assert settings.schema_dir == project_root / "data/schema_profiles/dev-3.0.32-derived"
    assert settings.basic_udi_reference_dir == project_root / "data" / "basic_udi_reference"
    assert settings.basic_udi_reference_workbook == project_root / "data" / "basic_udi_reference" / "BasicUDIs.xlsx"
    assert settings.legacy_basic_udi_reference_workbook == (
        project_root / "data" / "basic_udi_reference" / "uat-eudamed_mdr_products_tracekey_sample_data.xlsx"
    )
    assert settings.testing_state_db_path == project_root / "data" / "testing" / "testing-state.sqlite3"
    assert settings.testing_state_backup_dir == project_root / "data" / "testing" / "backups"
    assert settings.testing_state_backup_keep_count == 10
    assert settings.excluded_excel_workbook_names == ("Template for Accessories_Footspares EUDAMED.xlsx",)

    get_settings.cache_clear()
