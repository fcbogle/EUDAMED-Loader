"""Apply only acknowledged PATCH deltas to current canonical data.

Source rows, workbooks and response XML stay unchanged. All writes use the caller's
transaction. Success evidence is retained even when a local conflict blocks sync.
"""
from copy import deepcopy
from datetime import UTC, datetime
import json

from app.services.current_device_comparison import current_device_values
from app.validation_models import CanonicalValidationRecord
from app.xml_models import StorageConditionXmlItem, CriticalWarningXmlItem

SCENARIOS = {
    'trade_name_edit': ('trade_name', 'device_record.trade_name', 'Trade Name'),
    'base_quantity_edit': ('base_quantity', 'device_record.base_quantity', 'Base Quantity'),
    'status_code_edit': ('status_code', 'device_record.status', 'UDI-DI Status'),
    'warning_add': ('critical_warnings', 'device_record.warnings', 'Critical Warnings'),
    'storage_condition_edit': ('storage_conditions', 'device_record.storage_conditions', 'Storage Conditions'),
}
STRUCTURES = {'critical_warnings': 'critical_warning_items', 'storage_conditions': 'storage_condition_items'}
APPLIED = {'applied', 'already_current'}


def _json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False)


def _normalise(attribute, value):
    if attribute in STRUCTURES:
        model = CriticalWarningXmlItem if attribute == 'critical_warnings' else StorageConditionXmlItem
        if not isinstance(value, list):
            raise ValueError('Accepted structured values are unavailable')
        return sorted([model.model_validate(item).model_dump(mode='json') for item in value],
                      key=lambda item: (item['code'], item.get('comment') or ''))
    if attribute == 'base_quantity':
        if isinstance(value, bool) or value is None or not str(value).strip().isdigit() or int(value) < 1:
            raise ValueError('Accepted base quantity must be a positive integer')
        return int(value)
    if not isinstance(value, str) or not value.strip():
        raise ValueError('Accepted value is missing')
    if attribute == 'status_code' and value not in {'ON_THE_MARKET', 'NO_LONGER_PLACED_ON_THE_MARKET', 'NOT_INTENDED_FOR_EU_MARKET'}:
        raise ValueError('Accepted device status is invalid')
    return value


def current_value(record, scenario):
    attribute, path, _ = SCENARIOS[scenario]
    if not any(field['canonical_path'] == path for field in record.get('fields', [])):
        raise ValueError('The current device field is missing')
    values, _, _ = current_device_values(record)
    fields = values['device_record']
    if attribute not in fields:
        raise ValueError('The current device value cannot be read safely')
    value = fields[attribute]
    # An explicitly empty current field can be replaced only with a captured draft baseline.
    return None if value is None else _normalise(attribute, value)


def capture_current_data(record, scenario):
    if scenario not in SCENARIOS:
        return None
    try:
        return {'format_version': 1, 'attribute': SCENARIOS[scenario][0], 'value': current_value(record, scenario)}
    except (ValueError, TypeError, KeyError):
        return {'format_version': 1, 'attribute': SCENARIOS[scenario][0], 'unavailable': True}


def _tables(connection):
    return {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def _target(connection, subject):
    if not subject['device_subject_id']:
        raise ValueError('The accepted subject has no linked device identity')
    rows = connection.execute('SELECT * FROM canonical_device_record WHERE device_subject_id=?',
                              (subject['device_subject_id'],)).fetchall()
    if len(rows) != 1:
        raise ValueError('A unique current device record is required')
    row = rows[0]
    record = json.loads(row['record_json'])
    if not record.get('primary_udi_di') or record['primary_udi_di'] != subject['primary_udi_di']:
        raise ValueError('Current and accepted device identities do not match')
    return row, record


def _write_current(connection, row, record, scenario, value, note):
    attribute, path, _ = SCENARIOS[scenario]
    record = deepcopy(record)
    field = next(field for field in record['fields'] if field['canonical_path'] == path)
    if attribute in STRUCTURES:
        key = STRUCTURES[attribute]
        labels = {item.get('normalized_code'): item.get('item_type') for item in record.get(key, [])}
        record[key] = [{'sequence': index + 1, 'item_type': labels.get(item['code']) or item['code'],
                        'normalized_code': item['code'], 'description': item.get('comment'), 'source_fields': []}
                       for index, item in enumerate(value)]
        field['value'] = str(len(value))
    else:
        field['value'] = str(value) if attribute == 'base_quantity' and value is not None else value
        if attribute == 'trade_name':
            record['trade_name'] = value
    field['source'] = 'derived'
    field['source_detail'] = note
    field['review_note'] = '\n'.join(filter(None, (field.get('review_note'), note)))
    CanonicalValidationRecord.model_validate(record)
    indexed = connection.execute('UPDATE canonical_field_value SET value_json=?,field_status=?,review_note=? '
        'WHERE canonical_device_record_id=? AND canonical_path=?',
        (_json(field['value']) if field['value'] is not None else None,
         'populated' if field['value'] is not None else 'missing', field['review_note'], row['id'], path))
    if indexed.rowcount != 1:
        raise ValueError('The current device field index is unavailable or ambiguous')
    connection.execute('UPDATE canonical_device_record SET record_json=?,canonical_version=canonical_version+1,updated_at=? WHERE id=?',
        (_json(record), datetime.now(UTC).isoformat(), row['id']))


def _record_result(connection, event, raw, result):
    result = {'event_id': event['id'], **result}
    old = raw.get('current_data_sync')
    comparable = lambda value: {key: item for key, item in value.items() if key not in {'checked_at', 'previous_attempts'}}
    if isinstance(old, dict) and comparable(old) == comparable(result):
        return old
    if isinstance(old, dict):
        result['previous_attempts'] = [*old.get('previous_attempts', []), comparable(old)]
    result['checked_at'] = datetime.now(UTC).isoformat()
    raw['current_data_sync'] = result
    connection.execute('UPDATE testing_events SET raw_event_json=? WHERE id=?', (_json(raw), event['id']))
    return result


def sync_successful_patch(connection, event_id):
    """Synchronise an existing, correlated success. Safe for duplicate uploads and repair."""
    event = connection.execute('SELECT * FROM testing_events WHERE id=?', (event_id,)).fetchone()
    if not event or event['status'] != 'SUCCESS' or event['message_type'] != 'UDI_DI.PATCH':
        return {'status': 'not_applicable', 'event_id': event_id}
    scenario = event['scenario_id']
    if scenario not in SCENARIOS:
        return {'status': 'not_applicable', 'event_id': event_id}
    raw = json.loads(event['raw_event_json'] or '{}')
    if raw.get('current_data_sync', {}).get('status') in APPLIED:
        return {'status': 'already_processed', 'event_id': event_id}
    def finish(status, reason, **details):
        return _record_result(connection, event, raw, {'status': status, 'reason': reason, 'scenario_id': scenario, **details})
    if event['event_kind'] != 'success_ack' or raw.get('response_code') != 'SUCCESS':
        return {'status': 'not_applicable', 'event_id': event_id}
    try:
        if not {'canonical_device_record', 'canonical_field_value'} <= _tables(connection):
            return finish('unavailable', 'Current device data has not been imported')
        subject = connection.execute('SELECT * FROM testing_subjects WHERE id=?', (event['subject_id'],)).fetchone()
        version = int(event['version'])
        accepted = json.loads(subject['latest_successful_state_json'] or '{}')
        if int(subject['latest_successful_version'] or 0) != version:
            return finish('historical', 'A different accepted version is current; no current values changed')
        if int(accepted.get('version') or 0) != version:
            return finish('conflict', 'The accepted payload state is unavailable for this version')
        if raw.get('entity_version') and str(raw['entity_version']) != str(version):
            return finish('conflict', 'The response version differs from the generated payload')
        if not event['correlation_id']:
            return finish('conflict', 'A correlated generated PATCH is required')
        generated = connection.execute("SELECT * FROM testing_events WHERE subject_id=? AND message_type='UDI_DI.PATCH' "
            "AND status='GENERATED' AND correlation_id=? AND version=?", (event['subject_id'], event['correlation_id'], event['version'])).fetchall()
        generated_id = raw.get('generated_event_id')
        message = raw.get('generated_patch_context', {}).get('message_id')
        if generated_id:
            generated = [row for row in generated if row['id'] == generated_id]
        elif message:
            generated = [row for row in generated if row['message_id'] == message]
        if len(generated) != 1 or generated[0]['scenario_id'] != scenario:
            return finish('conflict', 'The generated payload is unavailable or ambiguous')
        draft = generated[0]
        after = json.loads(draft['state_after_json'] or '{}')
        if str(after.get('version')) != str(version):
            return finish('conflict', 'The stored generated state has a different version')
        attribute, path, _ = SCENARIOS[scenario]
        desired = _normalise(attribute, after.get(attribute))
        if _normalise(attribute, accepted.get(attribute)) != desired:
            return finish('conflict', 'The accepted projection differs from the acknowledged payload')
        row, record = _target(connection, subject)
        current = current_value(record, scenario)
        field = next(item for item in record['fields'] if item['canonical_path'] == path)
        index = connection.execute('SELECT value_json FROM canonical_field_value WHERE canonical_device_record_id=? AND canonical_path=?',
                                   (row['id'], path)).fetchall()
        if len(index) != 1 or (json.loads(index[0]['value_json']) if index[0]['value_json'] is not None else None) != field['value']:
            return finish('conflict', 'The current device record and field index disagree; review their values')
        source = json.loads(draft['raw_event_json'] or '{}')
        captured = source.get('current_data_before')
        if captured is not None:
            if captured.get('attribute') != attribute or captured.get('unavailable'):
                return finish('conflict', 'The draft did not capture a usable current device value')
            expected = captured.get('value')
        else:
            before = json.loads(draft['state_before_json'] or '{}')
            expected = _normalise(attribute, before.get(attribute))
        details = {'attribute': attribute, 'canonical_path': path, 'device_subject_id': subject['device_subject_id'],
                   'canonical_record_id': row['id'], 'version': str(version), 'before_value': current,
                   'after_value': desired, 'expected_current_value': expected,
                   'before_field': deepcopy(field), 'source_row_id': row['source_row_id'],
                   'generated_event_id': draft['id']}
        if current != desired and current != expected:
            return finish('conflict', 'Current device data changed after the draft; review without overwriting it', **details)
        if current == desired:
            return finish('already_current', 'Current device data already matches the acknowledged change', **details)
        note = f"Accepted UDI_DI.PATCH version {version}; success event {event_id}; response {event['source_file_name'] or 'retained XML'}"
        # A savepoint ensures an indexing/projection error cannot leave a partial current-data update.
        connection.execute('SAVEPOINT patch_current_data')
        try:
            _write_current(connection, row, record, scenario, desired, note)
            connection.execute('RELEASE patch_current_data')
        except Exception:
            connection.execute('ROLLBACK TO patch_current_data')
            connection.execute('RELEASE patch_current_data')
            raise
        return finish('applied', 'Current device data updated from the acknowledged PATCH', **details)
    except (ValueError, TypeError, KeyError, IndexError, StopIteration) as exc:
        return finish('conflict', str(exc))


def projection_overrides(connection):
    """Retain qualified changes (and newer local values) when rebuilding imported projections."""
    if not {'testing_events', 'testing_subjects', 'canonical_device_record'} <= _tables(connection):
        return []
    latest = {}
    for event in connection.execute("SELECT e.*,t.device_subject_id,t.primary_udi_di AS subject_udi FROM testing_events e "
            "JOIN testing_subjects t ON t.id=e.subject_id WHERE e.status='SUCCESS' AND e.message_type='UDI_DI.PATCH' "
            "AND e.raw_event_json LIKE '%current_data_sync%' ORDER BY CAST(e.version AS INTEGER),e.id"):
        sync = json.loads(event['raw_event_json'] or '{}').get('current_data_sync', {})
        if sync.get('status') not in APPLIED or event['scenario_id'] not in SCENARIOS or not event['device_subject_id']:
            continue
        if sync.get('device_subject_id') != event['device_subject_id']:
            continue
        scenario = event['scenario_id']
        value = sync['after_value']
        rows = connection.execute('SELECT * FROM canonical_device_record WHERE device_subject_id=?', (event['device_subject_id'],)).fetchall()
        if len(rows) == 1:
            record = json.loads(rows[0]['record_json'])
            # Preserve a newer local edit too; do not reset it to an older acceptance.
            value = current_value(record, scenario)
        latest[(event['device_subject_id'], scenario)] = {
            'device_subject_id': event['device_subject_id'], 'primary_udi_di': event['subject_udi'],
            'scenario': scenario, 'value': value, 'event_id': event['id']}
    return list(latest.values())


def restore_projection_overrides(connection, overrides):
    for item in overrides:
        rows = connection.execute('SELECT * FROM canonical_device_record WHERE device_subject_id=?', (item['device_subject_id'],)).fetchall()
        if len(rows) != 1:
            raise ValueError('A synchronised device cannot be resolved in the rebuilt projection')
        record = json.loads(rows[0]['record_json'])
        if record.get('primary_udi_di') != item['primary_udi_di']:
            raise ValueError('A synchronised device identity changed during projection rebuild')
        if current_value(record, item['scenario']) != item['value']:
            _write_current(connection, rows[0], record, item['scenario'], item['value'],
                f"Retained current value during source projection rebuild; accepted PATCH event {item['event_id']}; review differing source data")
