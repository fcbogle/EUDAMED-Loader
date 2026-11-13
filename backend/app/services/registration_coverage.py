"""Owner-confirmed completeness evidence for negative registration conclusions.

A device export cannot establish absence of parent-only Basic UDI registrations.
Reading coverage never initializes schema or changes application state.
"""
from __future__ import annotations

from contextlib import closing
from datetime import UTC, datetime
import json
from pathlib import Path
import sqlite3
from uuid import uuid4

from app.config import Settings

TABLE = 'registration_scope_confirmation'


def coverage_for(connection: sqlite3.Connection, settings: Settings) -> dict | None:
    if not connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (TABLE,)).fetchone():
        return None
    manufacturer = settings.eudamed_manufacturer_srn_override
    if not manufacturer:
        return None  # No broad scope inference without an explicit active actor.
    row = connection.execute(f'''SELECT * FROM {TABLE} WHERE environment=? AND manufacturer_srn=?
        AND database_path=? ORDER BY id DESC LIMIT 1''',
        (settings.environment, manufacturer, str(settings.testing_state_db_path.resolve()))).fetchone()
    if row is None or row['revoked'] or row['coverage_kind'] != 'complete_manufacturer_devices':
        return None
    metadata = json.loads(row['metadata_json'])
    expected = {tuple(key) for key in metadata['registered_device_keys']}
    source = 'playground_export' if settings.environment == 'dev' else 'production_export'
    evidenced = set()
    latest_evidence_id = None
    for event in connection.execute("SELECT raw_event_json,state_after_json FROM testing_events WHERE status='IMPORTED' AND event_kind='BASELINE_IMPORT' AND accepted_state_source=? ORDER BY id", (source,)):
        raw = json.loads(event['raw_event_json'] or '{}')
        snapshot = json.loads(event['state_after_json'] or '{}')
        record = snapshot.get('device_record', {})
        if record.get('manufacturer_srn') == manufacturer:
            latest_evidence_id = raw.get('evidence_id')
            if latest_evidence_id != row['evidence_id']:
                continue
            evidenced.add((record.get('device_identifier_issuing_entity'), record.get('device_identifier_code')))
    if not expected or evidenced != expected or latest_evidence_id != row['evidence_id']:
        return None
    return {'environment': row['environment'], 'manufacturer_srn': manufacturer,
            'confirmed_at': row['confirmed_at'], 'export_as_of': metadata['export_as_of'],
            'covers_parent_only': False, 'confirmed_by': row['confirmed_by'],
            'registered_device_keys': expected, 'manufacturer_override': manufacturer,
            'evidence_id': row['evidence_id']}


def public_coverage(coverage: dict | None) -> dict | None:
    return {key: value for key, value in coverage.items() if key not in {'registered_device_keys', 'manufacturer_override'}} if coverage else None


def confirm_dev_device_scope(settings: Settings, batch_id: str, *, confirmed_by: str) -> dict:
    """Record the owner's complete-device-scope confirmation after a verified backup.

    Dev only. Production requires a separately reviewed scope confirmation path.
    Existing source/accepted snapshots and submission history are not updated.
    """
    from app.services.playground_baseline_import import PlaygroundBaselineImporter
    importer = PlaygroundBaselineImporter(settings)
    if not confirmed_by.strip():
        raise ValueError('Coverage confirmation attribution is required')
    proposal = importer.prepare(batch_id)
    if not proposal['already_applied']:
        raise ValueError('Apply and verify this export baseline before confirming its coverage')
    keys = sorted((row['issuer'], row['udi_di']) for row in proposal['records'])
    metadata = {'batch_id': batch_id, 'registered_device_keys': keys,
                'export_as_of': max(file['created_at'] for file in proposal['export_files']),
                'export_files': proposal['export_files'], 'covers_parent_only': False,
                'scope': 'All manufacturer device registrations in the supplied search, confirmed by owner; device extracts only.'}
    with closing(sqlite3.connect(importer.database.as_uri()+'?mode=rw', uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute('BEGIN IMMEDIATE')
        try:
            if coverage_for(connection, settings):
                existing = connection.execute(f'SELECT evidence_id FROM {TABLE} ORDER BY id DESC LIMIT 1').fetchone()
                if existing['evidence_id'] == proposal['evidence_id']:
                    connection.rollback()
                    return {'already_confirmed': True, 'evidence_id': proposal['evidence_id']}
            # Validate the same baseline under the reserved writer lock.
            locked = importer.prepare(batch_id)
            if locked['database_snapshot_sha256'] != proposal['database_snapshot_sha256']:
                raise ValueError('Registration evidence changed during scope confirmation')
            backup = importer._backup(uuid4().hex)
            connection.execute(f'''CREATE TABLE IF NOT EXISTS {TABLE} (
                id INTEGER PRIMARY KEY, environment TEXT NOT NULL, manufacturer_srn TEXT NOT NULL,
                database_path TEXT NOT NULL, evidence_id TEXT NOT NULL, coverage_kind TEXT NOT NULL,
                confirmed_at TEXT NOT NULL, confirmed_by TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0,
                metadata_json TEXT NOT NULL)''')
            metadata['backup'] = backup
            now = datetime.now(UTC).isoformat()
            connection.execute(f'''INSERT INTO {TABLE}(environment,manufacturer_srn,database_path,evidence_id,
                coverage_kind,confirmed_at,confirmed_by,metadata_json) VALUES(?,?,?,?,?,?,?,?)''',
                ('dev', proposal['manufacturer_srn'], str(importer.database), proposal['evidence_id'],
                 'complete_manufacturer_devices', now, confirmed_by, json.dumps(metadata, sort_keys=True)))
            if coverage_for(connection, settings) is None:
                raise ValueError('Coverage confirmation did not match retained baseline evidence')
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
    return {'already_confirmed': False, 'evidence_id': proposal['evidence_id'],
            'manufacturer_srn': proposal['manufacturer_srn'], 'devices_in_extracts': len(keys),
            'covers_parent_only': False, 'confirmed_at': now, 'backup': backup}
