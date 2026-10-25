from __future__ import annotations

import os
import sys
from pathlib import Path
import sqlite3
import tempfile
from urllib.parse import parse_qs, unquote, urlparse

BACKEND_ROOT = Path(__file__).resolve().parents[1]

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest

from app.config import get_settings
from app.services.testing_state_store import TestingStateStore


@pytest.fixture(autouse=True)
def test_database_write_guard(monkeypatch, tmp_path_factory):
    """Never let a stale/local profile turn a test into an operational DB write."""
    original = sqlite3.connect
    allowed = [tmp_path_factory.getbasetemp().resolve(), Path(tempfile.gettempdir()).resolve(), Path('/tmp').resolve()]
    def guarded(database, *args, **kwargs):
        raw = os.fsdecode(database)
        readonly = False
        if kwargs.get("uri") and raw.startswith("file:"):
            uri = urlparse(raw)
            query = parse_qs(uri.query)
            if query.get("mode") == ["memory"] or uri.path == ":memory:":
                return original(database, *args, **kwargs)
            readonly = query.get("mode") == ["ro"]
            raw = unquote(uri.path)
        if raw != ":memory:" and not readonly:
            target = Path(raw).expanduser().resolve()
            if not any(target.is_relative_to(root) for root in allowed):
                raise RuntimeError(f"Tests cannot open a non-temporary database for writing: {target}")
        return original(database, *args, **kwargs)
    monkeypatch.setattr(sqlite3, "connect", guarded)


@pytest.fixture(autouse=True)
def clear_reviewed_post_state(test_database_write_guard, reset_testing_state_database) -> None:
    # Cleanup uses the session's fixed temporary path, never cached get_settings().
    def clear():
        with sqlite3.connect(reset_testing_state_database) as connection:
            connection.execute("DELETE FROM reviewed_post_baselines")
    get_settings.cache_clear()
    clear()
    yield
    get_settings.cache_clear()
    clear()


@pytest.fixture(scope="session", autouse=True)
def reset_testing_state_database(tmp_path_factory: pytest.TempPathFactory) -> None:
    session_tmp = tmp_path_factory.mktemp("session-testing-state")
    os.environ["EUDAMED_TESTING_STATE_DB_PATH"] = str(session_tmp / "testing-state.sqlite3")
    os.environ["EUDAMED_TESTING_STATE_BACKUP_DIR"] = str(session_tmp / "backups")
    get_settings.cache_clear()
    settings = get_settings()
    expected_database = (session_tmp / "testing-state.sqlite3").resolve()
    if settings.testing_state_db_path.resolve() != expected_database:
        raise RuntimeError("Test setup refused a database outside its fixed temporary location")
    if settings.testing_state_backup_dir.resolve() != (session_tmp / "backups").resolve():
        raise RuntimeError("Test setup refused a backup location outside its fixed temporary directory")
    if settings.testing_state_db_path.exists():
        settings.testing_state_db_path.unlink()
    TestingStateStore()
    _seed_testing_state_database_from_sql(
        db_path=settings.testing_state_db_path,
        seed_path=BACKEND_ROOT.parent / "data" / "testing" / "testing-state-seed.sql",
    )
    yield settings.testing_state_db_path
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
