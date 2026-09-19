from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

from app import config


@pytest.fixture
def profiles(tmp_path, monkeypatch):
    for name in list(os.environ):
        if name.startswith("EUDAMED_"):
            monkeypatch.delenv(name)
    monkeypatch.setattr(config, "PROJECT_ROOT", tmp_path)
    for name, version in [("dev-3.0.32-derived", "3.0.32"), ("prod-3.0.30", "3.0.30")]:
        folder = tmp_path / "data/schema_profiles" / name / "service"
        (folder / "Message").mkdir(parents=True)
        schema = f'''<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="message"><xs:complexType><xs:attribute name="version" fixed="{version}"/></xs:complexType></xs:element></xs:schema>'''
        (folder / "Message/MessageType.xsd").write_text(schema)
        (folder / "Message.xsd").write_text(schema)
    prod = {
        "EUDAMED_ENVIRONMENT": "prod",
        "EUDAMED_DATA_ROOT": "data/prod",
        "EUDAMED_SCHEMA_DIR": "data/schema_profiles/prod-3.0.30",
        "EUDAMED_MESSAGE_SCHEMA_VERSION": "3.0.30",
        "EUDAMED_EXCEL_DIR": "data/prod/source_excel",
        "EUDAMED_BASIC_UDI_REFERENCE_DIR": "data/prod/basic_udi_reference",
        "EUDAMED_TESTING_STATE_DB_PATH": "data/prod/application.sqlite3",
        "EUDAMED_TESTING_STATE_BACKUP_DIR": "data/prod/backups",
        "EUDAMED_NORMALIZATION_DIR": "data/prod/normalization",
        "EUDAMED_REPORTS_DIR": "data/prod/reports",
        "EUDAMED_ARTIFACTS_DIR": "data/prod/artifacts",
        "EUDAMED_MANUFACTURER_SRN_OVERRIDE": "GB-MF-000000002",
        "EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE": "DE-AR-000000003",
        "EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE": "false",
    }
    def write(values=prod):
        (tmp_path / ".env.prod").write_text("\n".join(f"{k}={v}" for k,v in values.items()))
    write()
    config.get_settings.cache_clear()
    yield tmp_path, prod, write
    config.get_settings.cache_clear()


def select(monkeypatch, environment):
    monkeypatch.setenv("EUDAMED_ENVIRONMENT", environment)
    config.get_settings.cache_clear()
    return config.get_settings()


def test_dev_legacy_fallback_and_process_precedence(profiles, monkeypatch):
    root, _, _ = profiles
    (root / ".env").write_text("EUDAMED_MAX_BATCH_RECORDS=77\n")
    monkeypatch.setenv("EUDAMED_MAX_BATCH_RECORDS", "88")
    settings = select(monkeypatch, "dev")
    assert settings.eudamed_max_batch_records == 88
    assert settings.environment_file == root / ".env"
    assert settings.testing_state_db_path == root / "data/testing/testing-state.sqlite3"
    (root / ".env.dev").write_text("EUDAMED_ENVIRONMENT=dev\nEUDAMED_POST_PROFILE=dev_profile\n")
    settings = select(monkeypatch, "dev")
    assert settings.eudamed_post_profile == "dev_profile"
    assert "EUDAMED_POST_PROFILE" not in os.environ


def test_prod_never_inherits_legacy_file_and_check_is_read_only(profiles, monkeypatch):
    root, _, _ = profiles
    (root / ".env").write_text("EUDAMED_POST_PROFILE=legacy_dev\nEUDAMED_MANUFACTURER_SRN_OVERRIDE=UK-MF-000033261\n")
    settings = select(monkeypatch, "prod")
    config.validate_schema_package(settings)
    assert settings.eudamed_post_profile == "device_post"
    assert settings.eudamed_message_schema_version == "3.0.30"
    assert settings.testing_state_db_path == root / "data/prod/application.sqlite3"
    assert not (root / "data/prod").exists()


def test_switch_does_not_leak_loaded_dev_values(profiles, monkeypatch):
    root, _, _ = profiles
    (root / ".env.dev").write_text("EUDAMED_POST_PROFILE=dev_only\nEUDAMED_MANUFACTURER_SRN_OVERRIDE=GB-MF-000000001\n")
    assert select(monkeypatch, "dev").eudamed_post_profile == "dev_only"
    assert select(monkeypatch, "prod").eudamed_post_profile == "device_post"


@pytest.mark.parametrize("key,value,reason", [
    ("EUDAMED_MESSAGE_SCHEMA_VERSION", "3.0.32", "requires message schema"),
    ("EUDAMED_SCHEMA_DIR", "data/schema_profiles/dev-3.0.32-derived", "package version"),
    ("EUDAMED_TESTING_STATE_DB_PATH", "data/testing/testing-state.sqlite3", "beneath"),
    ("EUDAMED_EXCEL_DIR", "data/source_excel", "beneath"),
    ("EUDAMED_NORMALIZATION_DIR", "config/normalization", "beneath"),
    ("EUDAMED_ARTIFACTS_DIR", "data/prod/source_excel", "must not overlap"),
    ("EUDAMED_DATA_ROOT", "data", "overlaps Dev"),
    ("EUDAMED_MANUFACTURER_SRN_OVERRIDE", "UK-MF-000033261", "Playground SRN"),
    ("EUDAMED_MANUFACTURER_SRN_OVERRIDE", "", "explicit settings"),
    ("EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE", "", "representative SRN"),
    ("EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE", "true", "both suppress"),
    ("EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE", "maybe", "boolean"),
])
def test_prod_rejects_unsafe_or_incomplete_profile(profiles, monkeypatch, key, value, reason):
    root, prod, write = profiles
    write({**prod, key:value})
    with pytest.raises(ValueError, match=reason):
        select(monkeypatch, "prod")
    assert not (root / "data/prod/application.sqlite3").exists()


def test_missing_prod_file_cannot_fall_back(profiles, monkeypatch):
    root, _, _ = profiles
    (root / ".env.prod").unlink()
    with pytest.raises(ValueError, match="does not exist"):
        select(monkeypatch, "prod")


def test_mismatched_file_label_rejected(profiles, monkeypatch):
    _, prod, write = profiles
    write({**prod,"EUDAMED_ENVIRONMENT":"dev"})
    with pytest.raises(ValueError, match="declares a different"):
        select(monkeypatch,"prod")


def test_unknown_environment_rejected(profiles, monkeypatch):
    with pytest.raises(ValueError, match="must be dev or prod"):
        select(monkeypatch, "production")


def test_symlink_cannot_bypass_prod_isolation(profiles, monkeypatch):
    root, _, _ = profiles
    (root / "data/prod").mkdir()
    (root / "data/source_excel").mkdir()
    (root / "data/prod/source_excel").symlink_to(root / "data/source_excel", target_is_directory=True)
    with pytest.raises(ValueError, match="beneath"):
        select(monkeypatch, "prod")


def test_hardlink_database_rejected(profiles, monkeypatch):
    root, _, _ = profiles
    dev = root / "data/testing/testing-state.sqlite3"
    dev.parent.mkdir();dev.write_bytes(b"synthetic database sentinel")
    target = root / "data/prod/application.sqlite3"
    target.parent.mkdir();target.hardlink_to(dev)
    with pytest.raises(ValueError, match="database is the Dev"):
        select(monkeypatch, "prod")
    assert dev.read_bytes()==b"synthetic database sentinel"


def test_prod_compares_custom_dev_locations(profiles, monkeypatch):
    root, prod, write = profiles
    (root / ".env.dev").write_text("EUDAMED_EXCEL_DIR=custom/source\n")
    write({**prod,"EUDAMED_DATA_ROOT":"custom"})
    with pytest.raises(ValueError, match="overlaps Dev"):
        select(monkeypatch,"prod")


def test_dev_rejects_prod_storage(profiles, monkeypatch):
    monkeypatch.setenv("EUDAMED_TESTING_STATE_DB_PATH","data/prod/application.sqlite3")
    with pytest.raises(ValueError,match="Dev storage overlaps"):
        select(monkeypatch,"dev")


def test_schema_dependency_errors_are_reported_before_startup(profiles, monkeypatch):
    root, _, _ = profiles
    settings=select(monkeypatch,"prod")
    (settings.schema_dir / "service/Message.xsd").write_text('<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:include schemaLocation="absent.xsd"/></xs:schema>')
    with pytest.raises(ValueError,match="Cannot compile"):
        config.validate_schema_package(settings)
    assert not settings.testing_state_db_path.exists()


def test_check_config_command_does_not_create_database(tmp_path):
    project = Path(__file__).resolve().parents[2]
    db = tmp_path / "untouched.sqlite3"
    env = {k:v for k,v in os.environ.items() if not k.startswith("EUDAMED_")}
    profile = tmp_path / "dev.env"
    profile.write_text("EUDAMED_ENVIRONMENT=dev\n")
    env.update(EUDAMED_TESTING_STATE_DB_PATH=str(db), EUDAMED_SCHEMA_DIR=str(project/'data/schema_profiles/dev-3.0.32-derived'))
    result=subprocess.run([sys.executable,"-m","app.run","--environment","dev","--env-file",str(profile),"--check-config"],cwd=project/'backend',env=env,capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    assert 'no database opened' in result.stdout
    assert not db.exists()


def test_prod_check_command_uses_official_bundle_without_creating_state(tmp_path):
    project = Path(__file__).resolve().parents[2]
    profile = tmp_path / "prod.env"
    content = (project / ".env.prod.example").read_text()
    content = content.replace("EUDAMED_DATA_ROOT=data/prod", f"EUDAMED_DATA_ROOT={tmp_path}/prod")
    content = content.replace("=data/prod/", f"={tmp_path}/prod/")
    content = content.replace("EUDAMED_MANUFACTURER_SRN_OVERRIDE=\n", "EUDAMED_MANUFACTURER_SRN_OVERRIDE=GB-MF-000000002\n")
    content = content.replace("EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE=\n", "EUDAMED_AUTHORISED_REPRESENTATIVE_SRN_OVERRIDE=DE-AR-000000003\n")
    profile.write_text(content)
    env = {k:v for k,v in os.environ.items() if not k.startswith("EUDAMED_")}
    result = subprocess.run([sys.executable, "-m", "app.run", "--environment", "prod", "--env-file", str(profile), "--check-config"], cwd=project / "backend", env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert "XML schema: 3.0.30" in result.stdout
    assert not (tmp_path / "prod").exists()
