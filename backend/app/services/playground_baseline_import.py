"""Controlled, Dev-only export baseline import into the existing operational DB.

No migrations, canonical/source edits, fabricated successes or review approvals.
"""
from __future__ import annotations

from contextlib import closing
from datetime import UTC, datetime
import hashlib
import json
from pathlib import Path
import sqlite3
from uuid import uuid4

from app.config import Settings
from app.services.dev_input_batches import fingerprint
from app.services.playground_reconciliation import PlaygroundReconciliation, PARENT_FIELDS, normalized


def dump(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


class PlaygroundBaselineImporter:
    def __init__(self, settings: Settings):
        self.assessor = PlaygroundReconciliation(settings)
        self.settings = settings
        self.database = settings.testing_state_db_path.resolve()
        data = self.assessor.batches.root.parents[1]
        if self.database != data / 'testing/testing-state.sqlite3' or settings.testing_state_db_path.is_symlink():
            raise PermissionError('Baseline writes require the existing data/testing/testing-state.sqlite3 Dev database')
        self.backups = data / 'testing/backups'
        if self.backups.is_symlink():
            raise PermissionError('Dev backup directory must not be a symlink')

    def prepare(self, batch_id: str) -> dict:
        report = self.assessor.assess(batch_id)
        evidence_id = hashlib.sha256(dump({'contract': 'playground-baseline-v1',
            'manufacturer': report['manufacturer_srn'], 'files': report['export_files']}).encode()).hexdigest()
        report['evidence_id'] = evidence_id
        with closing(sqlite3.connect(self.database.as_uri() + '?mode=ro', uri=True)) as connection:
            connection.row_factory = sqlite3.Row
            imported = connection.execute("SELECT subject_id,raw_event_json FROM testing_events WHERE message_type='PLAYGROUND_EXPORT.SNAPSHOT' AND status='IMPORTED' AND accepted_state_source='playground_export'").fetchall()
        applied = {row['subject_id'] for row in imported if json.loads(row['raw_event_json'] or '{}').get('evidence_id') == evidence_id}
        expected = {row['testing_subject_id'] for row in report['records']}
        if applied:
            if None in expected or applied != expected:
                raise ValueError('Existing reconciliation evidence is incomplete or identity scope changed; investigate before applying')
            report['already_applied'] = True
            return report
        if len(expected) != len(report['records']) or None in expected:
            raise ValueError('Every export must resolve to one distinct existing testing subject')
        parents = {}
        for row in report['records']:
            if not row.get('device_subject_id') or row['outcome'] == 'Unable to compare':
                raise ValueError('Unresolved identity or unsupported export prevents reconciliation')
            snapshot = row['proposed_snapshot']
            if snapshot['unsupported_projection']:
                raise ValueError('Unsupported exported fields prevent reconciliation')
            # Owner-approved exceptions: legacy generic versions and unique
            # unlinked identity are retained in the audit, never silently erased.
            allowed = ('Legacy generic version ', 'Legacy testing subject resolved ',
                       'Generic summary version differs ')
            blocked = [warning for warning in row['warnings'] if not warning.startswith(allowed)]
            if blocked:
                raise ValueError(f"{row['catalogue']}: " + '; '.join(blocked))
            parent = tuple(row['parent'])
            projection = {'version': snapshot['parent_version'], **{key: snapshot['device_record'][key] for key in PARENT_FIELDS}}
            if parent in parents and normalized('parent', projection) != parents[parent]:
                raise ValueError('Exports contain inconsistent snapshots for a shared parent')
            parents[parent] = normalized('parent', projection)
        report['already_applied'] = False
        return report

    def apply(self, batch_id: str, *, expected_digest: str, approved_by: str) -> dict:
        if not approved_by.strip():
            raise ValueError('An approval attribution is required')
        before = self.prepare(batch_id)
        if before['already_applied']:
            return {'already_applied': True, 'evidence_id': before['evidence_id'], 'devices': len(before['records'])}
        if before['database_snapshot_sha256'] != expected_digest:
            raise ValueError('Assessment changed; review a fresh proposal before applying')
        run_id = uuid4().hex
        applied_at = datetime.now(UTC).isoformat()
        batch = self.assessor.batches._batch(batch_id)
        output = batch / 'reconciliation'
        output.mkdir(exist_ok=True)
        if output.is_symlink():
            raise ValueError('Reconciliation output must not be a symlink')
        audit_path = output / f'baseline-{run_id}.json'
        with closing(sqlite3.connect(self.database.as_uri() + '?mode=rw', uri=True, timeout=5)) as connection:
            connection.row_factory = sqlite3.Row
            connection.execute('PRAGMA foreign_keys=ON')
            connection.execute('BEGIN IMMEDIATE')
            try:
                # A second read snapshot under the reserved write lock prevents
                # concurrent submissions from slipping past the reviewed digest.
                current = self.prepare(batch_id)
                if current['already_applied'] or current['database_snapshot_sha256'] != expected_digest:
                    raise ValueError('Database evidence changed before the write lock; assess again')
                backup = self._backup(run_id)
                audit = {'run_id': run_id, 'batch_id': batch_id, 'evidence_id': current['evidence_id'],
                         'approved_by': approved_by, 'applied_at': applied_at, 'backup': backup,
                         'proposal': current, 'status': 'prepared'}
                audit_path.write_text(dump(audit) + '\n')
                for row in current['records']:
                    self._record(connection, row, current, run_id, applied_at, approved_by, backup)
                # Do not commit if source evidence changed while applying.
                if self.assessor.batches._inputs(batch_id)[3] != current['input_token']:
                    raise ValueError('Input batch changed during reconciliation')
                connection.commit()
            except BaseException:
                connection.rollback()
                raise
        result = {'run_id': run_id, 'evidence_id': current['evidence_id'], 'batch_id': batch_id,
                  'devices': len(current['records']), 'parents': current['summary']['parents'],
                  'already_applied': False, 'backup': backup, 'audit': str(audit_path)}
        audit.update(status='committed', result=result)
        try:
            audit_path.write_text(dump(audit) + '\n')
        except OSError as exc:
            result['audit_warning'] = f'Committed baseline; final filesystem audit update failed: {exc}. Database events retain run/backup evidence.'
        return result

    def _backup(self, run_id: str) -> dict:
        self.backups.mkdir(exist_ok=True)
        path = self.backups / f'testing-state-before-playground-baseline-{run_id}.sqlite3'
        with closing(sqlite3.connect(self.database.as_uri() + '?mode=ro', uri=True)) as source:
            with closing(sqlite3.connect(path)) as target:
                source.backup(target)
                if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise ValueError('Pre-change backup failed integrity check')
        return {'path': str(path), 'sha256': fingerprint(path), 'integrity_check': 'ok'}

    @staticmethod
    def _record(connection, row, report, run_id, applied_at, approved_by, backup):
        subject = connection.execute('SELECT * FROM testing_subjects WHERE id=?', (row['testing_subject_id'],)).fetchone()
        canonical = connection.execute('SELECT primary_udi_di,basic_udi_di FROM device_subject WHERE id=?', (row['device_subject_id'],)).fetchone()
        if subject is None or canonical is None or canonical['primary_udi_di'] != row['udi_di'] or canonical['basic_udi_di'] != row['parent'][1]:
            raise ValueError('Device identity/parent link changed before reconciliation')
        if subject['device_subject_id'] not in (None, row['device_subject_id']):
            raise ValueError('Testing subject has a conflicting relational identity')
        if subject['basic_udi_di'] and subject['basic_udi_di'] != row['parent'][1]:
            raise ValueError('Testing subject has a conflicting parent')
        snapshot = {**row['proposed_snapshot'], 'accepted_state_source': 'playground_export',
                    'reconciliation_id': run_id, 'evidence_id': report['evidence_id']}
        snapshot['device_record'].update(product_family=subject['product_family'], product_variant=subject['product_variant'])
        market = {'version': snapshot['market_info_version'], 'market_countries': snapshot['market_countries'],
                  'accepted_state_source': 'playground_export', 'reconciliation_id': run_id}
        event_index = connection.execute('SELECT COALESCE(MAX(event_index),-1)+1 FROM testing_events WHERE subject_id=?', (subject['id'],)).fetchone()[0]
        metadata = {'run_id': run_id, 'evidence_id': report['evidence_id'], 'approved_by': approved_by,
                    'applied_at': applied_at, 'batch_id': report['batch_id'], 'backup': backup,
                    'export_source': row['export_source'], 'review_notes': row['warnings'],
                    'identity_link': {'before': subject['device_subject_id'], 'after': row['device_subject_id']},
                    'review_approvals_created': False}
        connection.execute("""INSERT INTO testing_events(subject_id,event_index,message_type,status,event_kind,accepted_state_source,
            version,source_file_name,state_before_json,state_after_json,raw_event_json,product_family,product_variant,catalogue_number,
            primary_udi_di,basic_udi_di) VALUES(?,?,'PLAYGROUND_EXPORT.SNAPSHOT','IMPORTED','BASELINE_IMPORT','playground_export',?,?,?,?,?,?,?,?,?,?)""",
            (subject['id'], event_index, snapshot['version'], row['export_source']['file'], dump(dict(subject)), dump(snapshot),
             dump(metadata), subject['product_family'], subject['product_variant'], row['catalogue'], row['udi_di'], row['parent'][1]))
        # These existing columns also cache imported current state in Production.
        # Explicit historical POST/PATCH fields and every old event stay untouched.
        connection.execute("""UPDATE testing_subjects SET device_subject_id=?,registration_status='child_registered',
            latest_successful_version=?,latest_successful_state_json=?,latest_successful_market_info_version=?,
            latest_successful_market_info_state_json=? WHERE id=?""",
            (row['device_subject_id'], snapshot['version'], dump(snapshot), market['version'], dump(market), subject['id']))
