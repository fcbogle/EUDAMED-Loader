# XML preparation performance — September 16, 2026

Implemented request-local preparation for single POST, Bulk Basic UDI POST, Bulk UDI-DI POST and Bulk PATCH. Baseline: commit `66e3851`; after: the performance changes in this worktree. No UI, database schema, transport or cross-request cache changes.

## Method and limits

- Python 3.11, local macOS execution. Each flow/action uses a fresh temporary SQLite database and 1,000 simplified synthetic canonical records. Only the requested 1/10/50/100 records belong to the selected family. No application database or production exports are used.
- Canonical loading reads fixture JSON from SQLite and validates the full Pydantic bundle. Projection, rendering, XSD validation, acceptance lookup, audit writes and ZIP compression use the real application services. The fixture does not reproduce the full import read model, workbook parsing or production data distribution.
- “Cold” clears the compiled XSD cache; “warm” repeats the same operation on the same fixture/service. This does not flush OS filesystem caches. Fixture creation and service construction are excluded. Warm ZIP calls add generated history but do not change acceptance.
- Each cell is one observed run, not a statistical latency guarantee. Actors, schema version (3.0.32) and the batch limit (300) are fixed across revisions. UUIDs and timestamps remain real.
- Measurements stop at the Python service result. HTTP transfer, browser rendering and real operator end-to-end latency are not measured. HTTP response-contract smoke tests separately exercise all four flows.
- Stage instrumentation measures exclusive time in selected methods. Uninstrumented request setup, transaction commit, model assembly and Python overhead remain in total time; stage sums are not a complete profiler. Nested renderer calls are counted separately.

## Timings (seconds)

| Flow | Devices | Action | Before cold | After cold | Before warm | After warm |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| Single POST | 1 | preview | 0.109 | 0.054 | 0.104 | 0.042 |
| Single POST | 1 | zip | 0.050 | 0.060 | 0.045 | 0.046 |
| Bulk Basic UDI POST | 10 | preview | 0.049 | 0.051 | 0.041 | 0.042 |
| Bulk Basic UDI POST | 10 | zip | 0.110 | 0.062 | 0.092 | 0.048 |
| Bulk Basic UDI POST | 50 | preview | 0.072 | 0.058 | 0.057 | 0.050 |
| Bulk Basic UDI POST | 50 | zip | 0.151 | 0.072 | 0.149 | 0.059 |
| Bulk Basic UDI POST | 100 | preview | 0.073 | 0.069 | 0.065 | 0.061 |
| Bulk Basic UDI POST | 100 | zip | 0.218 | 0.087 | 0.208 | 0.071 |
| Bulk UDI-DI POST | 10 | preview | 0.050 | 0.050 | 0.041 | 0.042 |
| Bulk UDI-DI POST | 10 | zip | 0.110 | 0.061 | 0.094 | 0.048 |
| Bulk UDI-DI POST | 50 | preview | 0.055 | 0.056 | 0.060 | 0.048 |
| Bulk UDI-DI POST | 50 | zip | 0.148 | 0.070 | 0.132 | 0.057 |
| Bulk UDI-DI POST | 100 | preview | 0.071 | 0.065 | 0.062 | 0.057 |
| Bulk UDI-DI POST | 100 | zip | 0.209 | 0.082 | 0.198 | 0.066 |
| Bulk PATCH | 10 | preview | 0.497 | 0.054 | 0.489 | 0.046 |
| Bulk PATCH | 10 | zip | 0.972 | 0.069 | 0.973 | 0.052 |
| Bulk PATCH | 50 | preview | 2.338 | 0.073 | 2.313 | 0.064 |
| Bulk PATCH | 50 | zip | 4.650 | 0.082 | 4.667 | 0.074 |
| Bulk PATCH | 100 | preview | 4.757 | 0.094 | 4.804 | 0.108 |
| Bulk PATCH | 100 | zip | 9.644 | 0.107 | 9.699 | 0.099 |

For this fixture, 100-device PATCH warm preview dropped from 4.804 to 0.108 seconds and ZIP preparation from 9.699 to 0.099 seconds. Bulk Basic UDI POST and Bulk UDI-DI POST ZIP preparation improved; single POST ZIP time is effectively unchanged at this measurement scale. Do not extrapolate these ratios into a production SLA.

## Why the timings changed

| 100-device warm ZIP | Canonical loads before / after | Validation calls before / after |
| --- | ---: | ---: |
| Bulk Basic UDI POST | 2 / 1 | 2 / 1 |
| Bulk UDI-DI POST | 2 / 1 | 2 / 1 |
| Bulk PATCH | 202 / 1 | 401 / 201 |

- One canonical bundle and catalogue index per operation call; nested calls share it. The next request reloads source data and accepted state, even when a service instance is reused.
- Operation-specific preparation creates the selected records, validated XML chunks and their generation contexts once. Downloads use those exact bytes for archive contents and manifests.
- A single SQLite snapshot prefetches the selected family/variant subjects and registration flags. Per-device state/version and pending-rejection checks still apply. Bulk generation contexts and ZIP receipts commit in one transaction after archive construction.
- Individual PATCH baseline/derived validation remains; the final batch is also validated. The removed calls were duplicate preparation for download, not removal of the required checks.
- If acceptance changes concurrently so the read snapshot cannot become a writer, download fails with refresh/retry guidance and no package audit is committed. The snapshot is not a database-wide write reservation; SQLite contention remains possible.
- Archive, final validation, context-write or receipt-write failures roll back the operation. Single POST and controlled single PATCH downloads also share the transaction; other legacy download flows are not claimed to have been refactored.

## Measured stages: 100-device warm PATCH ZIP

| Instrumented stage | Before (s) | After (s) |
| --- | ---: | ---: |
| accepted_state | 0.3604 | 0.0068 |
| audit_writes | 0.0546 | 0.0035 |
| canonical_load | 8.5271 | 0.0399 |
| compression | 0.0011 | 0.0011 |
| projection | 0.0087 | 0.0031 |
| rendering | 0.0530 | 0.0219 |
| selection | 0.0081 | 0.0014 |
| validation | 0.0250 | 0.0073 |
| Uninstrumented remainder | 0.6615 | 0.0143 |

The remainder includes request/transaction overhead and code outside the instrumented methods. It is not a measurement of network or browser latency.

## Verification

25 new synthetic regressions cover exact validated bytes and envelope IDs, preview side effects, failure rollback, one commit per batch, concurrent acceptance drift, source/registration refresh between requests, mixed accepted versions/countries, exclusions and HTTP preview/download contracts. Full-suite results are recorded in the session handoff.

## Reproduction

```bash
PYTHONPATH=backend .venv/bin/python backend/scripts/benchmark_xml.py --output /tmp/xml-timings.json
```

The script supports `--population` and `--sizes`. Run the same harness against the baseline revision in a separate directory to reproduce the comparison. Keep schema/configuration identical. Further work: repeat on a representative imported dataset, measure real HTTP/browser time, and consider separating presentation-only PATCH work only if profiling warrants it.

Raw measurements: [before](benchmarks/xml-generation-before-2026-09-16.json), [after](benchmarks/xml-generation-after-2026-09-16.json).
