# Publishing to the business repository and GitHub

Work in the original **EudamedUploader** checkout. Commit once, then run:

```bash
./scripts/publish-remotes.sh
```

The script publishes the current branch to the same branch name on both destinations:

- `origin`: business Azure repository, original history.
- `backup`: personal GitHub repository, cleaned history.

It does not use or update the separate `EUDAMED-Loader-GitHub` checkout. Do not run
`git push backup` directly from the original checkout: its historical databases
still exceed GitHub's file-size limit.

## One-time setup

Install Python 3 and Git, and install the history-cleaning tool on your Mac:

```bash
brew install git-filter-repo
```

Alternatively, install `git-filter-repo==2.47.0` in a dedicated Python environment
and set `FILTER_REPO_BIN` to its absolute executable path. That is the version used
for the initial GitHub export and the script's integration tests. The script also
recognizes `.venv/bin/git-filter-repo`; it never installs dependencies itself.

Existing Git authentication must work for both destinations. For GitHub, if needed:

```bash
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git --hostname github.com
```

Inspect the destinations with `git remote -v`. Each remote must have exactly one
push URL, and their URLs must differ.

## Daily workflow

1. Review and stage the intended files, then create your normal local commit.
2. Ensure `git status --short` is empty. Uncommitted and untracked files block
   publishing; ignored application data does not.
3. Optionally validate without publishing:

   ```bash
   ./scripts/publish-remotes.sh --dry-run
   ```

4. Publish:

   ```bash
   ./scripts/publish-remotes.sh
   ```

Both modes build an independent temporary clone and may take several minutes for
the original large history. Allow enough temporary disk space for that clone.
Normal completion and handled failures remove the temporary clone.

The script verifies that the cleaned current files match the original except for
the approved exclusions, checks all historical blobs against GitHub's 100 MiB
limit, checks repository integrity, and verifies that both updates are fast-forward
compatible. It then pushes the business branch first and GitHub second, verifying
each remote's resulting commit ID. Only the current branch is published; other
branches and tags are not pushed.

## History exclusions and recovery

The filter matches the initial September 26 GitHub export exactly:

```text
backend/app.db
data/testing/testing-state.sqlite3
data/testing/backups/
eudamed-backup-2026-05-20.tgz
```

Only the temporary clone is rewritten. The working database, original commits,
source files, remotes and branch tracking configuration are not changed. Original
and cleaned commit IDs differ. Commits made empty by the exclusions can be pruned.
This is a code/history export, not a database backup or a general sensitive-data
scanner. Other tracked files are retained.

Both pushes are normal pushes, never force-pushes. Git cannot make a transaction
across two repositories: if the business push succeeds but GitHub fails, the script
reports the separate outcomes and exits unsuccessfully. Fix the issue and rerun;
an already completed push is safe to repeat. A network interruption may leave a
push outcome uncertain, which the summary explicitly reports.

If a destination is ahead or diverged, the script stops. Review and reconcile the
history before retrying. Avoid making independent edits in GitHub; keep the original
business checkout as the source of changes. Do not change the exclusions casually:
that can change existing cleaned commit IDs and require a planned history migration.

## Verification

Run the synthetic local integration tests with:

```bash
python3 -m unittest discover -s tests -p 'test_publish_remotes.py' -v
```

The tests require `git-filter-repo` on PATH or `FILTER_REPO_BIN`. They use disposable
local bare repositories and cover incremental publication, repeat runs, clean-tree
and detached-HEAD guards, dry runs, divergent history, per-destination failures,
identical destination rejection and historical oversized-file detection.
