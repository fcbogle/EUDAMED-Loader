from __future__ import annotations

import sys
from pathlib import Path

import pytest

from app.config import get_settings

BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.testing_state_store import TestingStateStore


@pytest.fixture(autouse=True)
def clear_reviewed_post_state() -> None:
    TestingStateStore.clear_reviewed_posts()
    yield
    TestingStateStore.clear_reviewed_posts()


@pytest.fixture(scope="session", autouse=True)
def reset_testing_state_database() -> None:
    settings = get_settings()
    if settings.testing_state_db_path.exists():
        settings.testing_state_db_path.unlink()
    TestingStateStore()
    yield
