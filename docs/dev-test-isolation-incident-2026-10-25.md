# Dev test-isolation incident — 25 October 2026

## Known impact and current position

An earlier full backend run failed the default-path configuration test because
the development worktree intentionally points at the original project's Dev
inputs. That test left a cached Settings object pointing at the operational
Playground database. The pre-existing autouse cleanup called
`TestingStateStore.clear_reviewed_posts()`, which uses cached settings and executes
`DELETE FROM reviewed_post_baselines`. This unintentionally cleared legacy Dev
POST-review entries. The table currently contains zero rows. The exact pre-run
row set was not captured, so its complete contents cannot be asserted from the
current file.

The operational Dev database SHA-256/mtime changed; the file size stayed
502,063,104 bytes. This supersedes any broad statement that both database files
remained unchanged throughout all verification. The file-preparation HTTP/direct
checks themselves had passed before/after fingerprint comparisons; the final
cross-suite fingerprint exposed the test-cleanup change.

Production's database retained its original SHA-256, size and modification time.
No Production files/configuration or main application code were changed.

Read-only checks after the incident still find 216 testing subjects, 1,284 testing
events and 8,423 device subjects. All 215 successful device identities remain
present. Comparing current versions with the five exports reproduces the earlier
comparison counts and the same two EliteVT discrepancies; no new identity/version
differences were observed. This is not a complete before/after comparison of every
database field. The affected review entries are distinct from submission events
and accepted device-state evidence.

## Safeguards implemented

- The default-path test now selects an empty synthetic profile, independent of
  the operator's ignored `.env.dev`.
- Cleanup uses the fixed session-temporary database path, not cached settings.
- An autouse SQLite connection guard rejects non-temporary database writes during
  pytest, even when an application service holds an operational cached path.
  Explicit read-only URIs remain supported and SQLite still rejects writes through
  them. This guard changes tests only, not operational application permissions.
- Regression checks exercise both direct connection rejection and the legacy
  cleanup method against an operational-path sentinel without creating/opening it.

## Recovery status — no newer backup available

The retained 3 September Dev backup contains 26 review entries but predates later
review sequence activity. It must not be assumed to contain the exact pre-run
state. No newer local backup was found in `data/testing/backups/`; listing local
Time Machine snapshots returned none. The owner confirmed no newer backup or
Time Machine snapshot is available.

No older database or baseline rows have been restored, and no review timestamps
or records have been fabricated. Read-only reconstruction attempts using headers
and the old backup's three review-table/index pages did not reproduce the known
pre-run hash. They did not write to the database. Recovery/review of these markers
must be agreed with the owner; do not restore the entire old database over current
registration history. Future markers need fresh owner review rather than invented
historical approvals. No such review/state updates have been performed.

A consistent post-incident safety backup was created using SQLite's backup API
with a read-only source connection:
`data/testing/backups/testing-state-after-review-cleanup-20261025T120142Z.sqlite3`.
Its JSON sidecar records source/backup hashes and its post-incident status.
The source fingerprint remained unchanged during backup. This copy protects the
remaining history; it is not a recovery of the missing entries.

The final guarded full suite passed **313 tests in 241.76 seconds** with two
existing FastAPI startup warnings. The Dev database retained its post-incident
fingerprint throughout that run, while Production retained its original
pre-implementation fingerprint. All 12 source/copy fingerprints still agree.

The file-only batch preparation workflow can be tested independently, but this
incident must remain visible in the handoff and must not be described as a clean
no-database-change implementation.

## Production-path regression follow-up

Eight isolation checks now include the actual configured Production-path shape,
read/write URI forms, poisoned cached Production settings and temporary symlink
redirection. Rejection occurs before calling SQLite. Session setup also checks its
exact temporary database and backup destinations before any delete/initialization;
a poisoned-configuration regression proves it refuses those operations. Combined
isolation/configuration/baseline verification passed 42 tests.

These changes currently live in the development worktree. The original main
checkout still has its old cleanup fixture. The separately prepared
`production-test-isolation.patch` contains only the test harness and isolation
regressions, and passes an application check against main. It has not been applied;
tests must remain in the guarded development checkout until these protections
are promoted to main. Normal Production application startup was not changed.

## Main checkout subsequently fixed

At the owner's explicit request, the isolated test-only patch has now been applied
to the original main checkout. Its fixture and isolation regression file are the
only files changed by that fix. All 34 focused tests passed there; both operational
database file hashes, sizes and modification times remained unchanged. No feature
or application changes were copied to main. These local main changes are not yet
committed/published; other checkouts are not assumed protected until they receive
the fix. This supersedes the earlier statement that this local main fixture is
still unguarded.
