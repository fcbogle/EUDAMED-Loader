# Working between Development and Production

Set up October 24, 2026. Run **one environment at a time**. Production contains
registered devices; development and tests must never write to its database.

## Folders, branches and databases

| | Production | Development / Playground |
| --- | --- | --- |
| Folder | `/Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader` | `/Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/.worktrees/development` |
| Branch | `main` | `feature/import-management-reporting` |
| Profile | Original folder's `.env.prod` | Development folder's `.env.dev` |
| Database | Original folder's `data/prod/application.sqlite3` | **Existing** original folder's `data/testing/testing-state.sqlite3` |
| XML schema | 3.0.30 | 3.0.32, targeting Playground |

Both worktrees started at commit `018734a1f7e6d5651e5c7951ccb62b3ca0f45eb6`.
This records the current code baseline; it does not confer formal release approval.
Each folder has its own Python environment and frontend dependencies. Development
uses explicit absolute paths to the existing Playground database, its backups and
Dev source/reference workbooks. Normalization rules, reports and artifacts belong
to the development worktree. No Production files or databases were copied.

The existing Playground database is deliberately retained. Development operations
can change Playground state. Do not substitute the Production database, import
Production acceptance into Playground, or point development at `data/prod`.
The development folder has no `.env.prod`. Existing profile checks do not prevent
every manually supplied cross-worktree path: review the printed database path.

Open the development folder in a separate VS Code window using **File → Open
Folder**. Work there for the next feature wave. Keep the original folder on `main`;
there is no need to switch branches in the Production folder.

## Before switching environments

1. Finish any active operation. Stop the current frontend and backend with
   **Ctrl+C in their own terminal windows**. Do not kill unrelated processes.
2. Close the old application's browser tabs. Both environments use
   `http://localhost:5173` and API port 8000, so an old tab could address the newly
   started environment.
3. Open fresh backend/frontend terminals in the intended folder. Stop if the
   branch, printed profile or database path is unexpected.

In each backend terminal, clear inherited process overrides before checking or
starting the application. This affects that terminal only; it does not edit any
profile or database:

```bash
for eudamed_key in $(printenv | cut -d= -f1); do
  case "$eudamed_key" in EUDAMED_*) unset "$eudamed_key" ;; esac
done
unset eudamed_key
```

Do not use the VS Code Run button unless its launch configuration has separately
been checked for the intended folder, interpreter and profile. Use these explicit
commands initially.

## Start Production from main

In the backend terminal, after clearing overrides:

```bash
cd /Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader
git branch --show-current
git status --short
cd backend
../.venv/bin/python -m app.run --environment prod --env-file .env.prod --check-config
```

The branch must be `main`, with no unexpected source changes. The profile must
be the original folder's `.env.prod`, and the database must be:

```text
/Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/data/prod/application.sqlite3
```

The check does not open SQLite. Once verified, start Production in that terminal:

```bash
../.venv/bin/python -m app.run --environment prod --env-file .env.prod --port 8000
```

In the separate frontend terminal:

```bash
cd /Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/frontend
npm run dev -- --port 5173 --strictPort
```

Open `http://localhost:5173`. Confirm the banner identifies **Prod** and schema
**3.0.30** before operating. `npm run dev` is the current frontend server command;
the backend profile determines the application's regulatory environment. Production
backend startup can initialize schema as part of normal operation; it was not
started or restarted as part of this development setup.

## Start Development with the existing Playground database

Stop Production first, then in the fresh backend terminal clear overrides and run:

```bash
cd /Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/.worktrees/development
git branch --show-current
cd backend
../.venv/bin/python -m app.run --environment dev --env-file .env.dev --check-config
```

The branch must be `feature/import-management-reporting`. The profile must be in
the development folder, and the database must be the original Playground file:

```text
/Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/data/testing/testing-state.sqlite3
```

Once verified, start Dev in that terminal:

```bash
../.venv/bin/python -m app.run --environment dev --env-file .env.dev --port 8000 --reload
```

In its separate frontend terminal:

```bash
cd /Users/frankbogle/PycharmProjects/Eudamed/EudamedUploader/.worktrees/development/frontend
npm run dev -- --port 5173 --strictPort
```

Open a fresh tab at `http://localhost:5173`. Confirm **Dev**, schema **3.0.32** and
the Playground actor settings before operating. To return to Production, stop
both Dev processes and repeat the Production instructions; no branch switch or
database copying is needed.

## Commit, publish and release

Run Git commands from the development folder. Inspect `git status` and `git diff`,
then stage only intended files and commit them. Do not add ignored profiles,
SQLite files, backups or dependencies. The nested worktree is ignored locally by
the Production checkout through `.git/info/exclude`; `main` was not edited.

For the business repository, the first branch push is:

```bash
git push -u origin feature/import-management-reporting
```

`origin` is Azure DevOps. `backup` is GitHub and uses filtered history: use the
existing `./scripts/publish-remotes.sh` workflow when publishing to both remotes;
do not replace it with a direct push to `backup` or merge its filtered history
back into the business branches. No remote push was performed during setup.

Older `develop` and feature branches remain historical; the new branch starts
from current `main`, not the older `develop` tip. Worktrees share Git history and
branches, but have separate working files. Avoid broad commands that update
`main` from the development worktree.

Review and test development before proposing a pull request into `main`. Merge,
Production updates, migrations and release decisions require deliberate owner
review. Do not pull new code into the running Production checkout, reset its
database, or treat copying the Playground database as a release procedure.

## Tests

Run the suites from the development folder with a clean Dev process environment:

```bash
.venv/bin/python -m pytest backend/tests tests -q -ra
npm --prefix frontend test
npm --prefix frontend run build
git diff --check
```

The backend session fixture redirects testing state to a temporary database.
Keep this isolation intact when adding tests; tests must not target either the
operational Playground database or Production. Use synthetic fixtures for new
tests. Allow at least five minutes for the complete backend suite, and continue
waiting if it is still progressing. Automated checks do not replace browser or
controlled Playground verification.
