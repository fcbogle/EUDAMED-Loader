"""Publish a coherent current workbook/audit pair without modifying source inputs."""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import tempfile


@contextmanager
def current_pair_lock(directory: Path):
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / ".production-import.lock"
    if (directory / "~$production-import.xlsx").exists():
        raise ValueError("Close production-import.xlsx in Excel before updating or importing it.")
    try:
        handle = lock.open("x")
    except FileExistsError as exc:
        raise ValueError("Production workbook preparation/import is already in progress.") from exc
    try:
        handle.close()
        yield
    finally:
        lock.unlink(missing_ok=True)


def publish_current_pair(workbook: Path, audit: Path) -> tuple[Path, Path]:
    """Stage and replace; readers verify hashes because two renames are not atomic."""
    workbook_bytes, audit_bytes = workbook.read_bytes(), audit.read_bytes()
    manifest = json.loads(audit_bytes)
    if manifest.get("workbook_sha256") != hashlib.sha256(workbook_bytes).hexdigest():
        raise ValueError("Workbook does not match its companion audit.")
    directory = workbook.parent
    targets = (directory / "production-import.xlsx", directory / "production-import.audit.json")
    with current_pair_lock(directory):
        previous = [p.read_bytes() if p.exists() else None for p in targets]
        with tempfile.TemporaryDirectory(prefix=".production-stage-", dir=directory) as staging:
            stages = [Path(staging) / p.name for p in targets]
            for stage, content in zip(stages, (workbook_bytes, audit_bytes)):
                stage.write_bytes(content)
            changed = []
            try:
                for stage, target in zip(stages, targets):
                    os.replace(stage, target)
                    changed.append(target)
            except BaseException:
                for target, content in zip(targets, previous):
                    if target not in changed:
                        continue
                    if content is None:
                        target.unlink(missing_ok=True)
                    else:
                        restored = Path(staging) / (target.name + ".restore")
                        restored.write_bytes(content)
                        os.replace(restored, target)
                raise
    return targets
