from types import SimpleNamespace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.mark.parametrize("environment", ["dev", "prod"])
def test_environment_endpoint_exposes_only_active_profile(monkeypatch, environment):
    monkeypatch.setattr(main, "get_settings", lambda: SimpleNamespace(environment=environment, schema_dir=main.PROJECT_ROOT / "data/schema_profiles" / ("dev-3.0.32-derived" if environment == "dev" else "prod-3.0.30"), eudamed_message_schema_version="3.0.32" if environment == "dev" else "3.0.30", testing_state_db_path="private-path", eudamed_manufacturer_srn_override="GB-MF-000000001", eudamed_authorised_representative_srn_override="DE-AR-000000002", eudamed_suppress_authorised_representative=False))
    # No lifespan: this read-only endpoint must not require database initialization.
    response = TestClient(main.app).get("/api/environment")
    assert response.status_code == 200
    assert response.json() == {
        "environment": environment,
        "message_schema_version": "3.0.32" if environment == "dev" else "3.0.30",
        "schema_package": "Derived package" if environment == "dev" else "Official package",
        "manufacturer_srn": "GB-MF-000000001",
        "authorised_representative_srn": "DE-AR-000000002",
        "authorised_representative_suppressed": False,
    }


def test_custom_schema_is_not_claimed_official(monkeypatch):
    monkeypatch.setattr(main, "get_settings", lambda: SimpleNamespace(
        environment="prod", schema_dir=Path("/custom/schema"), eudamed_message_schema_version="3.0.30", eudamed_manufacturer_srn_override=None,
        eudamed_authorised_representative_srn_override=None, eudamed_suppress_authorised_representative=True))
    response = TestClient(main.app).get("/api/environment")
    assert response.json()["schema_package"] == "Custom package"


def test_environment_endpoint_preserves_missing_actors_and_explicit_suppression(monkeypatch):
    monkeypatch.setattr(main, "get_settings", lambda: SimpleNamespace(
        environment="dev", schema_dir=main.PROJECT_ROOT / "data/schema_profiles/dev-3.0.32-derived",
        eudamed_message_schema_version="3.0.32", eudamed_manufacturer_srn_override=None,
        eudamed_authorised_representative_srn_override=None, eudamed_suppress_authorised_representative=True))
    payload=TestClient(main.app).get("/api/environment").json()
    assert payload['manufacturer_srn'] is None and payload['authorised_representative_srn'] is None
    assert payload['authorised_representative_suppressed'] is True
    assert set(payload)=={'environment','schema_package','message_schema_version','manufacturer_srn','authorised_representative_srn','authorised_representative_suppressed'}
