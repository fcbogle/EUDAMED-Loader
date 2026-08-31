# SQLite Event Logging Schema Proposal

Date: 2026-08-31

## Purpose

Define the next SQLite schema shape for operational workflow logging so the application can:

- traverse all events for a single catalogue item
- traverse events by family/variant
- traverse events by posted child cohort under one `Basic UDI-DI`
- keep `testing_subjects` as the current-state projection
- keep `testing_events` as the append-only workflow/event log

## Current Position

The current implementation already has:

- `testing_subjects` as the per-device operational anchor
- `testing_events` as the per-subject event history
- `reviewed_post_baselines` as a separate reviewed-baseline marker
- accepted PATCH and Market Info snapshots stored on `testing_subjects`

The main weaknesses are:

- `latest_successful_version` mixes POST and PATCH meaning
- accepted POST state is not persisted as a first-class snapshot
- event semantics are partly implicit in `raw_event_json`
- cohort and lineage queries rely on a mixture of columns and JSON payloads

## Proposed Model

### 1. `testing_subjects`

Purpose: one row per operational device/catalogue item, holding current state and read-model fields.

```sql
CREATE TABLE testing_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_key TEXT NOT NULL UNIQUE,
    device_subject_id INTEGER REFERENCES device_subject(id) ON DELETE SET NULL,

    normalized_product_family TEXT NOT NULL,
    normalized_product_variant TEXT NOT NULL,
    normalized_catalogue_number TEXT NOT NULL,
    normalized_primary_udi_di TEXT,
    normalized_basic_udi_di TEXT,

    product_family TEXT,
    product_variant TEXT,
    catalogue_number TEXT,
    primary_udi_di TEXT,
    basic_udi_di TEXT,
    source_workbook TEXT,
    source_sheet TEXT,
    source_row_index INTEGER,

    registration_status TEXT NOT NULL DEFAULT 'unregistered',
    baseline_patch_success INTEGER NOT NULL DEFAULT 0,
    exclude_from_post_wave INTEGER NOT NULL DEFAULT 0,
    exclude_from_baseline_patch_wave INTEGER NOT NULL DEFAULT 0,

    latest_successful_post_version TEXT,
    latest_successful_post_state_json TEXT,

    latest_successful_patch_version TEXT,
    latest_successful_patch_state_json TEXT,

    latest_successful_market_info_version TEXT,
    latest_successful_market_info_state_json TEXT,

    latest_successful_message_type TEXT,
    latest_successful_event_id INTEGER REFERENCES testing_events(id) ON DELETE SET NULL,
    latest_tested_at TEXT
);
```

Notes:

- `registration_status` should be one of:
  - `unregistered`
  - `parent_registered`
  - `child_registered`
- Existing `post_success` and `latest_successful_version` should be treated as transitional compatibility fields and removed later.
- `latest_successful_post_state_json` should persist the first accepted registration baseline so version-2 PATCH lineage is explicit.

### 2. `testing_events`

Purpose: immutable append-only workflow log, one row per subject event.

```sql
CREATE TABLE testing_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES testing_subjects(id) ON DELETE CASCADE,
    event_index INTEGER NOT NULL,

    message_type TEXT NOT NULL,
    event_kind TEXT NOT NULL,
    status TEXT NOT NULL,

    operation_scope TEXT,
    batch_id TEXT,

    version TEXT,
    base_message_type TEXT,
    base_version TEXT,
    derived_version TEXT,
    accepted_state_source TEXT,

    scenario_id TEXT,
    scenario_label TEXT,

    product_family TEXT,
    product_variant TEXT,
    catalogue_number TEXT,
    primary_udi_di TEXT,
    basic_udi_di TEXT,

    tested_at TEXT,
    payload_created_at TEXT,
    correlation_id TEXT,
    message_id TEXT,
    transaction_id TEXT,
    submission_id TEXT,
    source_file_name TEXT,

    state_before_json TEXT,
    state_after_json TEXT,
    delta_json TEXT,

    changed_fields_json TEXT,
    retained_fields_json TEXT,
    unchanged_fields_json TEXT,

    raw_event_json TEXT NOT NULL,
    raw_xml TEXT,

    UNIQUE(subject_id, event_index)
);
```

Expected `event_kind` values:

- `generated`
- `success_ack`
- later, if needed:
  - `failure_ack`
  - `rejected_ack`
  - `manual_note`

Expected `status` values:

- `generated`
- `success`
- later:
  - `failed`
  - `rejected`

Notes:

- `message_type` remains the domain operation identity:
  - `DEVICE.POST`
  - `UDI_DI.POST`
  - `UDI_DI.PATCH`
  - `MARKET_INFO.PUT`
- `event_kind` distinguishes preview/generation from acknowledgement capture.
- `batch_id` links per-subject rows that came from the same bulk generation or bulk success XML upload.
- `state_before_json`, `state_after_json`, and `delta_json` are the key lineage fields for audit and replay.

### 3. `reviewed_post_baselines`

Keep this table for now.

```sql
CREATE TABLE reviewed_post_baselines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_subject_id INTEGER REFERENCES device_subject(id) ON DELETE SET NULL,
    normalized_product_family TEXT NOT NULL,
    normalized_product_variant TEXT NOT NULL,
    normalized_catalogue_number TEXT NOT NULL,
    product_family TEXT,
    product_variant TEXT,
    catalogue_number TEXT,
    reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(normalized_product_family, normalized_product_variant, normalized_catalogue_number)
);
```

Reason:

- it still has operator-facing value as a separate review marker
- it should not be the main lineage anchor for PATCH readiness anymore

### 4. Optional `testing_batches`

This is useful, but not required in the first schema slice.

```sql
CREATE TABLE testing_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL UNIQUE,
    operation_type TEXT NOT NULL,
    operation_scope TEXT NOT NULL,
    product_family TEXT,
    product_variant TEXT,
    basic_udi_di TEXT,
    record_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    source_file_name TEXT,
    correlation_id TEXT,
    message_id TEXT
);
```

If this table is skipped, `batch_id` on `testing_events` is enough for the first phase.

## Event Semantics

### Successful `DEVICE.POST`

Write:

- one `testing_events` row with:
  - `message_type = 'DEVICE.POST'`
  - `event_kind = 'success_ack'`
  - `status = 'success'`
- update `testing_subjects`:
  - `registration_status = 'parent_registered'`
  - `latest_successful_post_version = '1'` or ack version
  - `latest_successful_post_state_json = accepted parent/child baseline payload if available`

### Successful `UDI_DI.POST`

Write:

- one `testing_events` row with:
  - `message_type = 'UDI_DI.POST'`
  - `event_kind = 'success_ack'`
  - `status = 'success'`
- update `testing_subjects`:
  - `registration_status = 'child_registered'`
  - `latest_successful_post_version = '1'` or ack version
  - `latest_successful_post_state_json = accepted UDI-DI baseline payload`

### Generated `UDI_DI.PATCH`

Write:

- one `testing_events` row with:
  - `message_type = 'UDI_DI.PATCH'`
  - `event_kind = 'generated'`
  - `status = 'generated'`
  - `base_message_type`
  - `base_version`
  - `derived_version`
  - `state_before_json`
  - `state_after_json`
  - `delta_json`

Do not update accepted-state columns yet.

### Successful `UDI_DI.PATCH`

Write:

- one `testing_events` row with:
  - `message_type = 'UDI_DI.PATCH'`
  - `event_kind = 'success_ack'`
  - `status = 'success'`

Update `testing_subjects`:

- `latest_successful_patch_version`
- `latest_successful_patch_state_json`
- `latest_successful_message_type`
- `latest_successful_event_id`
- `latest_tested_at`

### Generated `MARKET_INFO.PUT`

Write:

- one `testing_events` row with:
  - `message_type = 'MARKET_INFO.PUT'`
  - `event_kind = 'generated'`
  - `status = 'generated'`
  - `base_version`
  - `derived_version`
  - `state_before_json`
  - `state_after_json`
  - `delta_json`

### Successful `MARKET_INFO.PUT`

Write:

- one `testing_events` row with:
  - `message_type = 'MARKET_INFO.PUT'`
  - `event_kind = 'success_ack'`
  - `status = 'success'`

Update `testing_subjects`:

- `latest_successful_market_info_version`
- `latest_successful_market_info_state_json`
- `latest_successful_message_type`
- `latest_successful_event_id`
- `latest_tested_at`

## Recommended Indexes

```sql
CREATE INDEX ix_testing_subjects_device_subject_id
    ON testing_subjects(device_subject_id);

CREATE INDEX ix_testing_subjects_family_variant
    ON testing_subjects(normalized_product_family, normalized_product_variant);

CREATE INDEX ix_testing_subjects_catalogue
    ON testing_subjects(normalized_catalogue_number);

CREATE INDEX ix_testing_subjects_primary_udi
    ON testing_subjects(normalized_primary_udi_di);

CREATE INDEX ix_testing_subjects_basic_udi
    ON testing_subjects(normalized_basic_udi_di);

CREATE INDEX ix_testing_events_subject_event_index
    ON testing_events(subject_id, event_index);

CREATE INDEX ix_testing_events_subject_tested_at
    ON testing_events(subject_id, tested_at);

CREATE INDEX ix_testing_events_message_kind_status
    ON testing_events(message_type, event_kind, status);

CREATE INDEX ix_testing_events_batch_id
    ON testing_events(batch_id);

CREATE INDEX ix_testing_events_correlation_message
    ON testing_events(correlation_id, message_id);

CREATE INDEX ix_testing_events_family_variant
    ON testing_events(product_family, product_variant);

CREATE INDEX ix_testing_events_basic_udi
    ON testing_events(basic_udi_di);
```

## Traversal Queries

### Single catalogue item

```sql
SELECT *
FROM testing_events
WHERE subject_id = ?
ORDER BY event_index, id;
```

### Family/variant event stream

```sql
SELECT event.*
FROM testing_events event
JOIN testing_subjects subject ON subject.id = event.subject_id
WHERE subject.normalized_product_family = ?
  AND subject.normalized_product_variant = ?
ORDER BY COALESCE(event.tested_at, event.payload_created_at), event.id;
```

### Posted child cohort under one parent

```sql
SELECT event.*
FROM testing_events event
JOIN testing_subjects subject ON subject.id = event.subject_id
WHERE subject.normalized_basic_udi_di = ?
ORDER BY COALESCE(event.tested_at, event.payload_created_at), event.id;
```

## Migration Strategy

### Phase 1

Add new columns without removing old ones:

- `testing_subjects`
  - `registration_status`
  - `latest_successful_post_version`
  - `latest_successful_post_state_json`
  - `latest_successful_patch_version`
  - `latest_successful_patch_state_json`
  - `latest_successful_message_type`
  - `latest_successful_event_id`
  - `latest_tested_at`
- `testing_events`
  - `event_kind`
  - `operation_scope`
  - `batch_id`
  - `base_message_type`
  - `base_version`
  - `derived_version`
  - `accepted_state_source`
  - `product_family`
  - `product_variant`
  - `catalogue_number`
  - `primary_udi_di`
  - `basic_udi_di`
  - `source_file_name`
  - `state_before_json`
  - `state_after_json`
  - `delta_json`
  - `raw_xml`

### Phase 2

Backfill from existing rows:

- derive `event_kind`
  - `status = 'GENERATED'` -> `generated`
  - `status = 'SUCCESS'` -> `success_ack`
- derive `status`
  - normalize current uppercase values to lowercase
- fill denormalized subject identity fields on `testing_events`
- split old `latest_successful_version` into:
  - `latest_successful_post_version`
  - `latest_successful_patch_version`
- map old `latest_successful_state_json` into `latest_successful_patch_state_json`

### Phase 3

Update write paths:

- generated PATCH logging
- generated Market Info logging
- success XML upload reconciliation
- accepted POST snapshot persistence

### Phase 4

Switch read-model queries to the new explicit columns, then retire:

- `post_success`
- `latest_successful_version`
- `latest_successful_state_json`

## Recommended First Implementation Slice

1. Extend `testing_events` with explicit lineage/logging columns.
2. Add explicit POST/PATCH accepted-state split on `testing_subjects`.
3. Persist accepted POST state snapshots during successful POST acknowledgement capture.
4. Leave `reviewed_post_baselines` in place as a separate review marker.
5. Keep old columns temporarily for compatibility while the read model is migrated.

## Open Decisions

1. Should `testing_batches` be introduced now, or should `batch_id` on `testing_events` be enough for the first release?
2. Should `DEVICE.POST` accepted state store only parent data, or the full accepted registration payload needed to seed later child/PATCH lineage?
3. Should `latest_successful_message_type` and `latest_successful_event_id` be maintained on every successful operation, including Market Info?
4. Should failure and rejection acknowledgements be modeled in the first logging phase, or deferred until success logging is complete?
