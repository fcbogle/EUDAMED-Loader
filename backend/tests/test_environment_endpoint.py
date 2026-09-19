from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.mark.parametrize("environment", ["dev", "prod"])
def test_environment_endpoint_exposes_only_active_profile(monkeypatch, environment):
    monkeypatch.setattr(main, "get_settings", lambda: SimpleNamespace(environment=environment, testing_state_db_path="private-path", eudamed_manufacturer_srn_override="private-actor"))
    # No lifespan: this read-only endpoint must not require database initialization.
    response = TestClient(main.app).get("/api/environment")
    assert response.status_code == 200
    assert response.json() == {"environment": environment}
