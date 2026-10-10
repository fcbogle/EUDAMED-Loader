# Dev and Prod configuration

Implemented 19 September 2026: explicit startup profile selection, separate storage
configuration, and checks before services open SQLite. The current environment is
**Dev**, targeting Playground. UI environment labels are implemented through
`GET /api/environment` and the shared EnvironmentBanner. The controlled Production
baseline importer is implemented as a separate service module. Documentation reviewed 9 October 2026.

## Select a profile at startup

Run from `backend/`:

```bash
# Read-only validation: no services, directory creation or SQLite access.
../.venv/bin/python -m app.run --environment dev --check-config

# Existing development workflow.
../.venv/bin/python -m app.run --environment dev --reload

# Validate a prepared production profile before starting anything.
../.venv/bin/python -m app.run --environment prod --check-config
```

A custom profile file can be supplied with `--env-file /absolute/path/to/profile.env`.
Relative paths in profile values are resolved against the project root, not the
working directory or profile file's directory. Restart the process to change profiles.

Existing direct Uvicorn invocation remains supported. It defaults to Dev; explicitly
set `EUDAMED_ENVIRONMENT=prod` to select Prod. `EUDAMED_ENVIRONMENT` must be selected
in the process/startup command; a file cannot silently switch environments.

Configuration precedence is process environment, then the selected profile, then
Dev defaults. Dotenv contents do not mutate process variables. Interpolation is
disabled: use literal values, not `${VARIABLE}` references.

## Files and migration

- Dev reads `.env.dev`. If absent, it uses the legacy `.env` for compatibility.
- Prod requires `.env.prod` (or the explicit custom file) and never loads `.env`.
- A declared `EUDAMED_ENVIRONMENT` inside a file must match the startup selection.
- `.env.dev.example` and `.env.prod.example` are committed templates. Real profile
  files are ignored. Custom files should be outside Git or separately ignored.
- The local `.env.dev` was created by preserving existing `.env` values and selecting
  the Dev schema profile. The original `.env` and existing database were retained.
- For other installations, copy `.env.dev.example` to `.env.dev` and transfer the
  existing actor overrides and other local settings before use.

## Profile settings

| Setting | Dev defaults | Prod example / requirement |
|---|---|---|
| XML version | 3.0.32 | Explicit 3.0.30 |
| Schema directory | `data/schema_profiles/dev-3.0.32-derived` | `data/schema_profiles/prod-3.0.30` |
| Device workbooks | `data/source_excel` | `data/prod/source_excel` |
| Basic UDI workbooks | `data/basic_udi_reference` | `data/prod/basic_udi_reference` |
| SQLite | `data/testing/testing-state.sqlite3` | `data/prod/application.sqlite3` |
| Backups | `data/testing/backups` | `data/prod/backups` |
| Normalization rules | `config/normalization` | `data/prod/normalization` |
| Reports | `docs/reports` | `data/prod/reports` |
| Artifact directory | `data/dev/artifacts` | `data/prod/artifacts` |

The existing `EUDAMED_TESTING_STATE_DB_PATH` and
`EUDAMED_TESTING_STATE_BACKUP_DIR` names remain supported for both environments to
avoid changing persistence callers. They select separate databases, not a separate
schema design. Source exclusions, including Accessories/Footspares, remain unchanged.

`EUDAMED_NORMALIZATION_DIR`, `EUDAMED_REPORTS_DIR` and `EUDAMED_ARTIFACTS_DIR`
are configurable. Normalization rules must be isolated because the API can edit
them. Canonical mapping definitions remain shared version-controlled code.

XML/ZIP responses are currently generated in memory and downloaded by the browser.
`artifacts_dir` reserves an environment-specific location for later server-side
artifact retention; this change does not persist downloads there or control the
browser's download directory. `reports_dir` is configuration, not an added report writer.

## Validation and isolation

Both profiles check the fixed version in `MessageType.xsd` against their target.
The startup handler and `--check-config` also compile `service/Message.xsd` before
starting database-backed services.

Prod requires explicit paths for every source/storage location, a data root,
schema settings, manufacturer SRN and representative suppression setting. An
explicit authorised representative SRN is required unless suppression is explicitly
selected; conflicting suppression/override settings are rejected. Actor settings
must be confirmed for the intended environment; no production identities are
pre-populated in the template.

All Prod source/storage paths must be distinct descendants of `EUDAMED_DATA_ROOT`.
The resolved root may not overlap standard Dev locations or custom Dev locations
in `.env.dev` (or the legacy `.env`). Symlink escapes and a hard-linked Dev database
are rejected. The known Playground manufacturer and the configured Dev manufacturer
cannot be used as the Prod manufacturer. Dev rejects the standard `data/prod` tree
and the root declared by `.env.prod`.

For custom external profile files/process overrides, administrators must preserve
separate roots: a process cannot discover every other deployment's configuration.
Checks prevent configured path collisions; they do not inspect whether someone has
copied Playground data into a different database file or validate SRNs against EUDAMED.

## Production preparation remains separate

The September profile implementation did not create a Production database or
import acceptance data. Production preparation inputs have since been supplied:
`data/prod/template/` (including the updated parent reference),
`data/prod/eudamed_xml/` and generated outputs in `data/prod/import_file/`. See
[preparation instructions](production-import-preparation.md) and the
[importer design](production-importer-design.md). Backend-confirmed Prod selects the prepared-workbook importer; Dev keeps raw
workbook import. `.env.prod.example` now includes:

```dotenv
EUDAMED_PRODUCTION_IMPORT_WORKBOOK=data/prod/import_file/production-import.xlsx
EUDAMED_PRODUCTION_IMPORT_AUDIT=data/prod/import_file/production-import.audit.json
```

Both files must be under the isolated Prod root, in the same directory, and match
by workbook hash. Blank actor fields intentionally prevent the example from
passing validation unchanged. Supply confirmed Production actors and its own
normalization rules. Never copy the Dev database into Prod.

Normal application startup initializes SQLite through existing services. Use
**`--check-config`** for read-only profile review without database creation.
Importer assessment itself can run against an absent database without creating
it; confirmation initializes tables and persists the import transaction.

Production UI uses Import Production Workbook, assessment, confirmation and JSON
reports. Accepted export baselines remain separate from successful upload events.
Synthetic regression covers the official Prod 3.0.30 schema and existing Dev
workflows; the supplied workbook was assessed without database population. First
local Production startup and reviewed import remain pending.

The Dev package is explicitly a **3.0.30-derived bundle with a 3.0.32 message
constraint**, not an official 3.0.32 release. See
[`data/schema_profiles/README.md`](../data/schema_profiles/README.md) for provenance
and the four-file comparison with the downloaded official Production bundle.

## Verification — September 19 checkpoint

These are historical profile-test results; latest complete and focused runs are
recorded in [session-handoff.md](session-handoff.md).


- Full backend suite: 199 passed in 239.30 seconds.
- After adding one further real-package Prod configuration smoke test, the focused
  environment-profile suite passed all 25 tests (the full run had already collected
  the preceding 24 profile tests). The additional test compiled official 3.0.30
  with synthetic actor settings and confirmed no production directories were created.
- Read-only Dev check passed against the preserved Dev database path.
- Coverage includes file precedence, no dotenv leakage, invalid/missing profiles,
  schema mismatch, storage overlap, symlink/hard-link escape, actor separation and
  schema dependency errors.
- No UI changes or live EUDAMED submissions were performed.

## Environment banner actor details

The shared banner shows schema/package and configured manufacturer/authorised
representative SRNs in one metadata row. `/api/environment` returns public actor
identifiers and explicit representative suppression, without storage paths or
other configuration. “Not included” means AR suppression is enabled; “Not configured”
means no override is supplied, and “Unconfirmed” means the older backend did not
provide actor metadata. These are configured overrides, not an assertion about
historical exported registrations. Restart the backend after the endpoint update.
