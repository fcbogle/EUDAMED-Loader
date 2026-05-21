from __future__ import annotations

from pathlib import Path

from app.config import get_settings


def test_default_settings_use_project_local_data_dirs(monkeypatch) -> None:
    monkeypatch.delenv("EUDAMED_EXCEL_DIR", raising=False)
    monkeypatch.delenv("EUDAMED_SCHEMA_DIR", raising=False)
    monkeypatch.delenv("EUDAMED_BASIC_UDI_REFERENCE_DIR", raising=False)
    get_settings.cache_clear()

    settings = get_settings()
    project_root = Path(__file__).resolve().parents[2]

    assert settings.excel_dir == project_root / "data" / "source_excel"
    assert settings.schema_dir == project_root / "data" / "schemas"
    assert settings.basic_udi_reference_dir == project_root / "data" / "basic_udi_reference"

    get_settings.cache_clear()
