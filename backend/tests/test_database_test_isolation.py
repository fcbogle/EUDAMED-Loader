"""Prove local/cached operational paths cannot be written during pytest runs."""
import sqlite3
from pathlib import Path

import pytest

from app.config import get_settings
from app.services.testing_state_store import TestingStateStore as StateStore


def test_write_guard_blocks_cached_operational_database(monkeypatch):
    base = get_settings()
    operational = Path(__file__).resolve().parents[2] / "data/testing/never-open-operational.sqlite3"
    monkeypatch.setattr('app.services.testing_state_store.get_settings', lambda: base.model_copy(update={"testing_state_db_path": operational}))
    # Exercise the connection guard directly even if this sentinel is absent.
    with pytest.raises(RuntimeError, match="non-temporary"):
        sqlite3.connect(operational)
    original_exists = Path.exists
    monkeypatch.setattr(Path, "exists", lambda path: True if path == operational else original_exists(path))
    with pytest.raises(RuntimeError, match="non-temporary"):
        StateStore.clear_reviewed_posts()
    monkeypatch.setattr(Path, "exists", original_exists)
    assert not operational.exists()


def test_readonly_uri_remains_readonly(tmp_path):
    path = tmp_path / "synthetic.sqlite3"
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE example(value TEXT)")
    with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as connection:
        assert connection.execute("SELECT count(*) FROM example").fetchone()[0] == 0
        with pytest.raises(sqlite3.OperationalError, match="readonly"):
            connection.execute("INSERT INTO example VALUES ('no')")


def production_database_path():
    repository = Path(__file__).resolve().parents[2]
    if repository.parent.name == '.worktrees':
        repository = repository.parent.parent
    return repository / 'data/prod/application.sqlite3'


@pytest.mark.parametrize('mode', [None, 'rw', 'rwc'])
def test_production_database_write_connections_are_rejected_before_open(mode):
    production = production_database_path()
    # The guard raises before calling SQLite. The Production file is never opened.
    with pytest.raises(RuntimeError, match='non-temporary'):
        if mode is None:
            sqlite3.connect(production)
        else:
            sqlite3.connect(production.as_uri() + '?mode=' + mode, uri=True)


def test_stale_production_profile_cannot_clear_review_records(monkeypatch):
    production = production_database_path()
    poisoned = get_settings().model_copy(update={'environment': 'prod', 'testing_state_db_path': production})
    monkeypatch.setattr('app.services.testing_state_store.get_settings', lambda: poisoned)
    original_exists = Path.exists
    monkeypatch.setattr(Path, 'exists', lambda path: True if path == production else original_exists(path))
    with pytest.raises(RuntimeError, match='non-temporary'):
        StateStore.clear_reviewed_posts()


def test_temporary_symlink_cannot_redirect_test_writes_to_production(tmp_path):
    alias = tmp_path / 'apparently-temporary.sqlite3'
    alias.symlink_to(production_database_path())
    with pytest.raises(RuntimeError, match='non-temporary'):
        sqlite3.connect(alias)


def test_session_setup_refuses_production_before_delete_or_initialization(monkeypatch, tmp_path):
    import conftest
    from types import SimpleNamespace
    poisoned = get_settings().model_copy(update={
        'environment': 'prod', 'testing_state_db_path': production_database_path(),
        'testing_state_backup_dir': production_database_path().parent / 'backups',
    })
    def cached_production_settings():
        return poisoned
    cached_production_settings.cache_clear = lambda: None
    monkeypatch.setattr(conftest, 'get_settings', cached_production_settings)
    # Register restoration for the environment keys the setup fixture assigns.
    monkeypatch.setenv('EUDAMED_TESTING_STATE_DB_PATH', str(tmp_path / 'before.sqlite3'))
    monkeypatch.setenv('EUDAMED_TESTING_STATE_BACKUP_DIR', str(tmp_path / 'before-backups'))
    def forbidden(*args, **kwargs):
        pytest.fail('Test setup reached a delete or database initializer')
    monkeypatch.setattr(Path, 'unlink', forbidden)
    monkeypatch.setattr(conftest, 'TestingStateStore', forbidden)
    fixture = conftest.reset_testing_state_database.__wrapped__(SimpleNamespace(mktemp=lambda name: tmp_path))
    with pytest.raises(RuntimeError, match='fixed temporary location'):
        next(fixture)
