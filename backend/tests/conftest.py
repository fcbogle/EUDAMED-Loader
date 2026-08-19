from __future__ import annotations

import os
import sys
from pathlib import Path
import sqlite3

BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest

from app.config import get_settings
from app.services.testing_state_store import TestingStateStore


@pytest.fixture(autouse=True)
def clear_reviewed_post_state() -> None:
    TestingStateStore.clear_reviewed_posts()
    yield
    TestingStateStore.clear_reviewed_posts()


@pytest.fixture(scope="session", autouse=True)
def reset_testing_state_database(tmp_path_factory: pytest.TempPathFactory) -> None:
    session_tmp = tmp_path_factory.mktemp("session-testing-state")
    os.environ["EUDAMED_TESTING_STATE_DB_PATH"] = str(session_tmp / "testing-state.sqlite3")
    os.environ["EUDAMED_TESTING_STATE_BACKUP_DIR"] = str(session_tmp / "backups")
    get_settings.cache_clear()
    settings = get_settings()
    if settings.testing_state_db_path.exists():
        settings.testing_state_db_path.unlink()
    TestingStateStore()
    _seed_testing_state_database_from_sql(
        db_path=settings.testing_state_db_path,
        seed_path=BACKEND_ROOT.parent / "data" / "testing" / "testing-state-seed.sql",
    )
    yield
    get_settings.cache_clear()


def _seed_testing_state_database_from_sql(*, db_path: Path, seed_path: Path) -> None:
    if not seed_path.exists():
        return

    connection = sqlite3.connect(db_path)
    try:
        connection.executescript(seed_path.read_text())
        connection.commit()
    finally:
        connection.close()
