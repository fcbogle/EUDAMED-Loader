#!/usr/bin/env python3
"""Publish committed code to origin and a history-filtered backup remote.

Only a disposable clone is rewritten. Never create commits or force-push.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


# Must match the initial GitHub export; changing these may break ancestry.
EXCLUDED_PATHS = (
    "backend/app.db",
    "data/testing/testing-state.sqlite3",
    "data/testing/backups/",
    "eudamed-backup-2026-05-20.tgz",
)
MAX_BLOB_BYTES = 100 * 1024 * 1024


class PublishError(Exception):
    pass


def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    result = subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True,
    )
    if check and result.returncode:
        raise PublishError(result.stderr.decode(errors="replace").strip()
                           or result.stdout.decode(errors="replace").strip()
                           or f"Git command failed: {args[0]}")
    return result


def value(repo: Path, *args: str) -> str:
    return git(repo, *args).stdout.decode().strip()


def ensure_clean(repo: Path, expected_head: str | None = None) -> None:
    if git(repo, "status", "--porcelain", "--untracked-files=all").stdout:
        raise PublishError("Commit or set aside your pending changes first. Nothing was published.")
    if expected_head and value(repo, "rev-parse", "HEAD") != expected_head:
        raise PublishError("HEAD changed during preparation. Rerun from a stable checkout.")


def push_url(repo: Path, remote: str) -> str:
    urls = value(repo, "remote", "get-url", "--push", "--all", remote).splitlines()
    if len(urls) != 1:
        raise PublishError(f"Remote {remote} must have exactly one push URL.")
    url = urls[0]
    if url.startswith("-"):
        raise PublishError(f"Invalid URL for {remote}.")
    # Resolve relative local remotes before using them from a temporary clone.
    if ":" not in url and not url.startswith("/"):
        url = str((repo / url).resolve())
    return url


def remote_head(repo: Path, url: str, ref: str) -> str | None:
    output = value(repo, "ls-remote", "--heads", url, ref)
    return output.split()[0] if output else None


def check_ancestry(clone: Path, url: str, ref: str, target: str, name: str) -> None:
    if remote_head(clone, url, ref) is None:
        return
    check_ref = f"refs/publish-check/{name}"
    git(clone, "fetch", "--no-tags", url, f"{ref}:{check_ref}")
    result = git(clone, "merge-base", "--is-ancestor", check_ref, target, check=False)
    git(clone, "update-ref", "-d", check_ref)
    if result.returncode:
        raise PublishError(f"{name} branch is ahead or has diverged. No force-push will be attempted.")


def tree(repo: Path, revision: str) -> dict[bytes, bytes]:
    return dict((path, metadata) for metadata, path in (
        entry.split(b"\t", 1)
        for entry in git(repo, "ls-tree", "-rz", revision).stdout.split(b"\0") if entry
    ))


def excluded(path: bytes) -> bool:
    name = path.decode("utf-8", errors="surrogateescape")
    return any(name.startswith(item) if item.endswith("/") else name == item
               for item in EXCLUDED_PATHS)


def verify_export(source: Path, original: str, clone: Path, cleaned: str) -> None:
    expected = {path: data for path, data in tree(source, original).items() if not excluded(path)}
    if tree(clone, cleaned) != expected:
        raise PublishError("Cleaned files differ from the original beyond the approved exclusions.")
    # Check every reachable historical blob, not just files at the branch tip.
    objects = git(clone, "rev-list", "--objects", cleaned).stdout
    result = subprocess.run(
        ["git", "-C", str(clone), "cat-file", "--batch-check=%(objecttype) %(objectsize) %(rest)"],
        input=objects, capture_output=True, check=True,
    )
    for row in result.stdout.splitlines():
        kind, size, *path = row.split(b" ", 2)
        if kind == b"blob" and int(size) > MAX_BLOB_BYTES:
            raise PublishError(f"History still contains a file over 100 MiB: {path!r}")
        if kind == b"blob" and path and excluded(path[0]):
            raise PublishError(f"Excluded file remains in export history: {path!r}")
    git(clone, "fsck", "--full")


def find_filter(repo: Path) -> str:
    configured = os.environ.get("FILTER_REPO_BIN")
    candidates = [configured] if configured else [
        shutil.which("git-filter-repo"), str(repo / ".venv/bin/git-filter-repo"),
    ]
    for candidate in candidates:
        if candidate and os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return str(Path(candidate).resolve())
    raise PublishError(
        "git-filter-repo is required. Install with 'brew install git-filter-repo', "
        "or set FILTER_REPO_BIN to its executable. No packages are installed automatically."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Prepare and validate both destinations without pushing")
    args = parser.parse_args()
    business_status = "not pushed"
    github_status = "not pushed"
    try:
        repo = Path(value(Path(__file__).resolve().parent, "rev-parse", "--show-toplevel"))
        ensure_clean(repo)
        branch_result = git(repo, "symbolic-ref", "--quiet", "--short", "HEAD", check=False)
        if branch_result.returncode:
            raise PublishError("Check out a branch before publishing; detached HEAD is not supported.")
        branch = branch_result.stdout.decode().strip()
        if value(repo, "rev-parse", "--is-shallow-repository") == "true":
            raise PublishError("A complete local history is required; shallow clones are not supported.")
        original = value(repo, "rev-parse", "HEAD")
        business = push_url(repo, "origin")
        github = push_url(repo, "backup")
        if business == github:
            raise PublishError("origin and backup must be different repositories.")
        filter_bin = find_filter(repo)
        ref = f"refs/heads/{branch}"
        print(f"Publishing branch {branch}, commit {original[:12]}", flush=True)
        print("Destinations: origin (business), backup (cleaned GitHub)", flush=True)
        with tempfile.TemporaryDirectory(prefix="eudamed-publish-") as temp:
            clone = Path(temp) / "export"
            print("Creating an independent temporary clone; large histories may take several minutes…", flush=True)
            git(repo, "clone", "--no-local", "--no-checkout", "--single-branch", "--no-tags",
                "--branch", branch, str(repo), str(clone))
            if value(clone, "rev-parse", "HEAD") != original:
                raise PublishError("Branch changed during cloning. Rerun from a stable checkout.")
            check_ancestry(clone, business, ref, original, "business")
            print("Removing the approved database and backup paths from export history…", flush=True)
            command = [filter_bin, "--force"]
            for path in EXCLUDED_PATHS:
                command.extend(["--path", path])
            command.append("--invert-paths")
            # --force only applies inside this newly created disposable clone.
            # Preflight fetches above mean it may not pass filter-repo's fresh-clone heuristic.
            subprocess.run(command, cwd=clone, check=True)
            cleaned = value(clone, "rev-parse", "HEAD")
            verify_export(repo, original, clone, cleaned)
            check_ancestry(clone, github, ref, cleaned, "GitHub")
            ensure_clean(repo, original)
            if push_url(repo, "origin") != business or push_url(repo, "backup") != github:
                raise PublishError("Remote URLs changed during preparation. Rerun after reviewing them.")
            print(f"Validated original {original[:12]} → cleaned {cleaned[:12]}", flush=True)
            if args.dry_run:
                print("Dry run passed. Neither repository was pushed.")
                return 0
            print("Pushing business branch…", flush=True)
            business_status = "push attempted; verify remote if interrupted"
            git(repo, "push", "--no-follow-tags", business, f"{original}:{ref}")
            business_status = "pushed; verification pending"
            if remote_head(repo, business, ref) != original:
                raise PublishError("Business branch does not match the pushed commit; GitHub push skipped.")
            business_status = f"verified at {original[:12]}"
            print("Pushing cleaned GitHub branch…", flush=True)
            github_status = "push attempted; verify remote if interrupted"
            git(clone, "push", "--no-follow-tags", github, f"{cleaned}:{ref}")
            github_status = "pushed; verification pending"
            if remote_head(clone, github, ref) != cleaned:
                raise PublishError("GitHub branch does not match the pushed commit.")
            github_status = f"verified at {cleaned[:12]}"
        return 0
    except (PublishError, subprocess.CalledProcessError, OSError, KeyboardInterrupt) as exc:
        print(f"Publish stopped: {exc or 'interrupted'}", file=sys.stderr)
        print("Fix the reported issue and rerun. No force-push or rollback is performed.", file=sys.stderr)
        return 1
    finally:
        print(f"Business: {business_status}\nGitHub: {github_status}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
