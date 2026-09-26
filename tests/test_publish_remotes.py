"""Synthetic integration checks. All pushes go to disposable local bare repositories."""
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('publisher', ROOT / 'scripts/publish_remotes.py')
publisher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publisher)
FILTER = os.environ.get('FILTER_REPO_BIN') or shutil.which('git-filter-repo')


@unittest.skipUnless(FILTER, 'Set FILTER_REPO_BIN or install git-filter-repo to run integration tests')
class PublishTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='publish-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / 'source'
        self.repo.mkdir()
        self.env = {**os.environ, 'FILTER_REPO_BIN': str(FILTER), 'GIT_CONFIG_NOSYSTEM': '1',
                    'GIT_CONFIG_GLOBAL': os.devnull, 'GIT_AUTHOR_NAME': 'Synthetic Author',
                    'GIT_AUTHOR_EMAIL': 'test@example.invalid', 'GIT_COMMITTER_NAME': 'Synthetic Author',
                    'GIT_COMMITTER_EMAIL': 'test@example.invalid'}
        self.git(self.repo, 'init', '-b', 'feature/test')
        (self.repo / 'scripts').mkdir()
        for name in ['publish_remotes.py', 'publish-remotes.sh']:
            shutil.copy2(ROOT / 'scripts' / name, self.repo / 'scripts' / name)
        (self.repo / '.gitignore').write_text('__pycache__/\n')
        (self.repo / 'app.py').write_text('print("first")\n')
        for name in ['backend/app.db', 'data/testing/testing-state.sqlite3',
                     'data/testing/backups/old.sqlite3', 'eudamed-backup-2026-05-20.tgz']:
            p = self.repo / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text('synthetic data, never real devices\n')
        self.commit()
        self.business = self.root / 'business.git'
        self.github = self.root / 'github.git'
        for remote, path in [('origin', self.business), ('backup', self.github)]:
            self.git(self.root, 'init', '--bare', str(path))
            self.git(self.repo, 'remote', 'add', remote, str(path))

    def git(self, repo, *args):
        return subprocess.check_output(['git', '-C', str(repo), *args], env=self.env, stderr=subprocess.PIPE).decode().strip()

    def commit(self):
        self.git(self.repo, 'add', '.')
        self.git(self.repo, 'commit', '-m', 'Synthetic change')

    def run_publish(self, *args):
        return subprocess.run(['sh', str(self.repo / 'scripts/publish-remotes.sh'), *args],
                              cwd=self.root, env=self.env, text=True, capture_output=True)

    def head(self, repo):
        return self.git(repo, 'rev-parse', 'refs/heads/feature/test')

    def test_publish_retry_and_incremental_history_leave_source_unchanged(self):
        original = self.head(self.repo)
        db = (self.repo / 'data/testing/testing-state.sqlite3').read_bytes()
        first = self.run_publish()
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        self.assertEqual(self.head(self.business), original)
        cleaned = self.head(self.github)
        self.assertNotEqual(cleaned, original)
        self.assertEqual(self.head(self.repo), original)
        self.assertEqual(self.git(self.repo, 'status', '--porcelain'), '')
        self.assertEqual((self.repo / 'data/testing/testing-state.sqlite3').read_bytes(), db)
        history = self.git(self.github, 'log', 'feature/test', '--format=', '--name-only')
        self.assertNotIn('sqlite3', history)
        self.assertNotIn('backend/app.db', history)
        self.assertNotIn('.tgz', history)
        self.assertEqual(self.run_publish().returncode, 0)
        self.assertEqual(self.head(self.github), cleaned)
        (self.repo / 'app.py').write_text('print("second")\n')
        self.commit()
        result = self.run_publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.git(self.github, 'merge-base', '--is-ancestor', cleaned, self.head(self.github))
        self.assertEqual(self.git(self.github, 'show', 'feature/test:app.py'), 'print("second")')

    def test_dry_run_never_publishes(self):
        result = self.run_publish('--dry-run')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.git(self.business, 'for-each-ref'), '')
        self.assertEqual(self.git(self.github, 'for-each-ref'), '')

    def test_dirty_checkout_stops_before_publishing(self):
        (self.repo / 'untracked.txt').write_text('pending')
        result = self.run_publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('pending changes', result.stderr)
        self.assertEqual(self.git(self.business, 'for-each-ref'), '')

    def test_detached_head_stops(self):
        self.git(self.repo, 'checkout', '--detach')
        result = self.run_publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('detached HEAD', result.stderr)

    def test_diverged_github_prevents_business_push(self):
        self.assertEqual(self.run_publish().returncode, 0)
        business_before = self.head(self.business)
        other = self.root / 'other'
        self.git(self.root, 'clone', '--branch', 'feature/test', str(self.github), str(other))
        (other / 'remote-only.txt').write_text('remote edit')
        self.git(other, 'add', '.')
        self.git(other, 'commit', '-m', 'Remote change')
        self.git(other, 'push', 'origin', 'feature/test')
        github_before = self.head(self.github)
        (self.repo / 'app.py').write_text('print("local change")\n')
        self.commit()
        result = self.run_publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('GitHub branch is ahead or has diverged', result.stderr)
        self.assertEqual(self.head(self.business), business_before)
        self.assertEqual(self.head(self.github), github_before)

    def test_partial_push_failure_is_reported_and_retry_works(self):
        hook = self.github / 'hooks/pre-receive'
        hook.write_text('#!/bin/sh\nexit 1\n')
        hook.chmod(0o755)
        result = self.run_publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Business: verified', result.stdout)
        self.assertIn('GitHub: push attempted', result.stdout)
        self.assertEqual(self.head(self.business), self.head(self.repo))
        self.assertEqual(self.git(self.github, 'for-each-ref'), '')
        hook.unlink()
        self.assertEqual(self.run_publish().returncode, 0)

    def test_business_rejection_skips_github(self):
        hook = self.business / 'hooks/pre-receive'
        hook.write_text('#!/bin/sh\nexit 1\n')
        hook.chmod(0o755)
        result = self.run_publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('GitHub: not pushed', result.stdout)
        self.assertEqual(self.git(self.business, 'for-each-ref'), '')
        self.assertEqual(self.git(self.github, 'for-each-ref'), '')

    def test_same_destination_is_rejected(self):
        self.git(self.repo, 'remote', 'set-url', 'backup', str(self.business))
        result = self.run_publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('different repositories', result.stderr)

    def test_history_size_check_includes_deleted_files(self):
        # Use a small test threshold instead of constructing a 100 MiB fixture.
        repo = self.root / 'size-test'
        repo.mkdir()
        self.git(repo, 'init', '-b', 'main')
        (repo / 'large.txt').write_text('x' * 200)
        self.git(repo, 'add', '.')
        self.git(repo, 'commit', '-m', 'Add file')
        self.git(repo, 'rm', 'large.txt')
        self.git(repo, 'commit', '-m', 'Remove file')
        head = self.git(repo, 'rev-parse', 'HEAD')
        old_limit = publisher.MAX_BLOB_BYTES
        publisher.MAX_BLOB_BYTES = 100
        try:
            with self.assertRaisesRegex(publisher.PublishError, 'over 100 MiB'):
                publisher.verify_export(repo, head, repo, head)
        finally:
            publisher.MAX_BLOB_BYTES = old_limit


if __name__ == '__main__':
    unittest.main()
