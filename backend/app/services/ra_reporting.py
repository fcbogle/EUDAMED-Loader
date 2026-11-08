"""Read-only comparison of stored accepted device data with dated EUDAMED extracts.

Canonical/workbook data supplies identity, model grouping and provenance only.
Comparison never substitutes proposed values for missing accepted-state values.
"""
from __future__ import annotations

import base64
from collections import defaultdict
from contextlib import closing
from datetime import UTC, datetime
from io import BytesIO
import json
import sqlite3

from fastapi.encoders import jsonable_encoder
from openpyxl import Workbook
from pydantic import BaseModel, ConfigDict

from app.services.accepted_state import accepted_device_state, accepted_market_state, json_state
from app.services.playground_reconciliation import normalized, positive_version, timestamp
from app.services.production_workbook_adapter import accepted_snapshot
from app.services.production_workbook_preparation import _cell
from app.services.registration_summary import identifier
from app.services.retained_eudamed_extracts import RetainedEudamedExtracts

# Explicit supported comparison scope. Parent attributes require a separate parent report.
DEVICE_FIELDS = {
    'device_identifier_code': 'Device UDI-DI',
    'device_identifier_issuing_entity': 'Device issuing entity',
    'basic_identifier_code': 'Basic UDI-DI',
    'basic_identifier_issuing_entity': 'Basic UDI-DI issuing entity',
    'reference_number': 'Reference number',
    'trade_name': 'Trade name',
    'language_code': 'Trade name language',
    'status_code': 'Device status',
    'nomenclature_codes': 'Nomenclature codes',
    'production_identifier': 'Production identifier',
    'secondary_identifier_code': 'Secondary identifier',
    'secondary_identifier_issuing_entity': 'Secondary issuing entity',
    'sterile': 'Sterile',
    'sterilization': 'Sterilization required',
    'base_quantity': 'Base quantity',
    'number_of_reuses': 'Number of reuses',
    'contains_latex': 'Contains latex',
    'reprocessed': 'Reprocessed',
    'storage_conditions': 'Storage conditions',
    'critical_warnings': 'Critical warnings',
}
COMPARISON_FIELDS = {**DEVICE_FIELDS, 'device_version': 'Device version',
                     'market_countries': 'Market countries and original placement',
                     'market_info_version': 'Market Info version'}
REQUIRED_FIELDS = {
    'device_identifier_code', 'device_identifier_issuing_entity', 'basic_identifier_code',
    'basic_identifier_issuing_entity', 'reference_number', 'status_code', 'nomenclature_codes',
    'sterile', 'sterilization', 'number_of_reuses', 'contains_latex', 'reprocessed',
    'market_countries',
}


class ReportRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    include_device_details: bool = False


def known_value(state, name):
    if not state:
        return False, None
    full = state.get('device_record')
    if isinstance(full, dict) and name in full:
        return True, full[name]
    return name in state, state.get(name)


def comparable(name, value):
    if name == 'nomenclature_codes' and isinstance(value, list):
        # The XML schema stores a whitespace-delimited code list; do not join away pairs
        # in structured fields such as country/original-placement or warning/comment.
        return sorted(code for item in value for code in str(item).split())
    return normalized(name, value)


def snapshot_identity(subject):
    """Recover an issuer for legacy identity resolution, never comparison values."""
    for column in ('latest_successful_patch_state_json', 'latest_successful_state_json', 'latest_successful_post_state_json'):
        state = json_state(subject[column])
        if not state:
            continue
        _, issuer = known_value(state, 'device_identifier_issuing_entity')
        if not issuer:
            _, issuer = known_value(state, 'issuing_entity')
        _, code = known_value(state, 'device_identifier_code')
        if issuer:
            return identifier(code or subject['primary_udi_di'], issuer)
    return None


class StoredDeviceComparisonReport:
    def __init__(self, settings):
        if settings.environment != 'dev':
            raise PermissionError('Stored Device Data Comparison is currently available only in Dev')
        self.settings = settings
        self.database = settings.testing_state_db_path.resolve()
        if any(self.database.parts[i:i+2] == ('data', 'prod') for i in range(len(self.database.parts)-1)):
            raise PermissionError('Dev reporting cannot use the Production database')

    def generate(self, request):
        if not self.settings.eudamed_manufacturer_srn_override:
            raise ValueError('A configured manufacturer is required for comparison')
        selection = RetainedEudamedExtracts(self.settings).select()
        if not selection['available']:
            raise ValueError(selection['reason'] + ' ' + '; '.join(item['reason'] for item in selection['excluded_sets'][:3]))
        exported, export_files, evidence = (selection[key] for key in ('exported', 'export_files', 'evidence'))
        groups, details, findings = {}, [], defaultdict(set)
        with closing(sqlite3.connect(self.database.as_uri() + '?mode=ro', uri=True)) as connection:
            connection.row_factory = sqlite3.Row
            connection.execute('PRAGMA query_only=ON')
            connection.execute('BEGIN')
            batch = connection.execute('SELECT * FROM import_batch ORDER BY id DESC LIMIT 1').fetchone()
            if batch is None:
                raise ValueError('Import database device records before generating this report')
            rows = connection.execute('''SELECT c.device_subject_id,c.record_json,sw.workbook_name,
                sw.file_hash,sw.loaded_at FROM canonical_device_record c
                LEFT JOIN source_row sr ON sr.id=c.source_row_id
                LEFT JOIN source_workbook sw ON sw.id=sr.source_workbook_id
                WHERE c.source_import_batch_id=?''', (batch['id'],)).fetchall()
            if not rows:
                raise ValueError('The latest import has no database device snapshot to compare')
            records, by_key = [], defaultdict(list)
            for row in rows:
                record = json.loads(row['record_json'])
                fields = {f['canonical_path']: f.get('value') for f in record.get('fields', [])}
                key = identifier(fields.get('device_record.identifier') or record.get('primary_udi_di'), record.get('issuing_entity'))
                records.append((row, record, key))
                by_key[key].append(row['device_subject_id'])
            tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            linked, legacy = defaultdict(list), defaultdict(list)
            if 'testing_subjects' in tables:
                for subject in connection.execute('SELECT * FROM testing_subjects'):
                    if subject['device_subject_id']:
                        linked[subject['device_subject_id']].append(subject)
                    elif snapshot_identity(subject):
                        legacy[snapshot_identity(subject)].append(subject)
            events = defaultdict(list)
            if 'testing_events' in tables:
                for event in connection.execute("SELECT id,subject_id,message_type,status,version,tested_at FROM testing_events WHERE status IN ('SUCCESS','IMPORTED')"):
                    events[event['subject_id']].append(dict(event))
            for row, record, key in records:
                family, model = record.get('product_family') or 'Unmapped', record.get('product_variant') or 'Unmapped'
                model_key = json.dumps([family, model])
                group = groups.setdefault(model_key, {'key': model_key, 'family': family, 'model': model,
                    'total': 0, 'exact': 0, 'different': 0, 'unable': 0, 'absent': 0,
                    'source_linked': 0, 'stored_available': 0, 'extract_matched': 0, 'source_files': set()})
                group['total'] += 1
                if row['workbook_name']:
                    group['source_linked'] += 1
                    group['source_files'].add(row['workbook_name'])
                    source = {'kind': 'Recorded source workbook (import time)', 'name': row['workbook_name'],
                              'sha256': row['file_hash'], 'created_at': row['loaded_at']}
                    if source not in evidence:
                        evidence.append(source)
                options = linked.get(row['device_subject_id'], []) + legacy.get(key, [])
                subject = options[0] if len(options) == 1 else None
                issues, differences, missing, notes = [], [], [], []
                state, market = None, None
                identity_valid = all(key) and len(by_key[key]) == 1
                if not identity_valid:
                    issues.append('Database identity is incomplete or ambiguous')
                if subject is None:
                    issues.append('No unique stored accepted-state identity')
                elif ((subject['primary_udi_di'] and identifier(subject['primary_udi_di'])[1] != key[1])
                      or (snapshot_identity(subject) is not None and snapshot_identity(subject) != key)):
                    issues.append('Stored identity conflicts with the active database identity')
                    subject = None
                if subject is not None and identity_valid:
                    state = accepted_device_state(connection, subject)
                    market = accepted_market_state(connection, subject)
                    # Historical summary flags can lag the event history. Do not show
                    # an older snapshot as the latest accepted device/market values.
                    for event in events[subject['id']]:
                        version = positive_version(event['version'])
                        if event['status'] != 'SUCCESS' or version is None:
                            continue
                        if event['message_type'] in {'DEVICE.POST', 'UDI_DI.POST', 'UDI_DI.PATCH'}:
                            stored_version = positive_version(state.get('version')) if state else None
                            if stored_version is None or int(version) > int(stored_version):
                                state = None
                                issues.append('Latest recorded accepted device version has no matching stored snapshot')
                        elif event['message_type'] == 'MARKET_INFO.PUT':
                            stored_version = positive_version(market.get('version')) if market else None
                            if stored_version is None or int(version) > int(stored_version):
                                market = None
                                issues.append('Latest recorded accepted Market Info version has no matching stored snapshot')
                if state:
                    group['stored_available'] += 1
                entry = exported.get(key)
                outcome = 'unable'
                if identity_valid and entry is None:
                    outcome = 'absent'
                    issues.append('Absent from selected extract — registration status not inferred')
                elif identity_valid and entry is not None:
                    group['extract_matched'] += 1
                    if subject is not None:
                        try:
                            exported_state = jsonable_encoder(accepted_snapshot(entry, self.settings))
                        except ValueError as exc:
                            issues.append('Extract cannot be compared using supported fields: ' + str(exc))
                        else:
                            unsupported_fields = set()
                            for warning in exported_state['unsupported_projection']:
                                issues.append('Outside supported comparison scope: ' + warning)
                                if 'Multiple accepted trade names' in warning:
                                    unsupported_fields.update({'trade_name', 'language_code'})
                                if 'Multiple accepted comment translations' in warning:
                                    unsupported_fields.update({'storage_conditions', 'critical_warnings'})
                            comparisons = []
                            for name, label in DEVICE_FIELDS.items():
                                if name in unsupported_fields:
                                    continue  # Do not call a lossy first-translation projection a difference.
                                known, stored = known_value(state, name)
                                comparisons.append((name, label, known, stored, exported_state['device_record'][name]))
                            comparisons.extend([
                                ('device_version', 'Device version', bool(state and positive_version(state.get('version'))),
                                 state.get('version') if state else None, exported_state['version']),
                                ('market_countries', COMPARISON_FIELDS['market_countries'], bool(market and 'market_countries' in market),
                                 market.get('market_countries') if market else None, exported_state['market_countries']),
                                ('market_info_version', 'Market Info version', bool(market and positive_version(market.get('version'))),
                                 market.get('version') if market else None, exported_state['market_info_version']),
                            ])
                            for name, label, known, stored, extracted in comparisons:
                                if name in REQUIRED_FIELDS and (stored is None
                                        or isinstance(stored, str) and not stored.strip()
                                        or name in {'nomenclature_codes', 'market_countries'} and stored == []):
                                    known = False
                                if not known:
                                    missing.append(label)
                                elif comparable(name, stored) != comparable(name, extracted):
                                    differences.append({'field': label, 'stored': stored, 'extracted': extracted})
                            if not state:
                                issues.append('Latest accepted device values are unavailable or do not match the recorded version')
                            for event in events[subject['id']]:
                                when = timestamp(event['tested_at'])
                                if when and when > timestamp(entry['source']['created_at']):
                                    notes.append('Database accepted activity is newer than this extract')
                                if not when:
                                    notes.append('Some stored accepted activity has no usable timestamp')
                            # Proven changed values stay visible even if other fields are missing.
                            outcome = 'different' if differences else 'unable' if missing or issues else 'exact'
                group[outcome] += 1
                issues, notes = sorted(set(issues)), sorted(set(notes))
                for issue in issues:
                    findings[(model_key, 'Comparison unavailable', issue)].add(row['device_subject_id'])
                for field in missing:
                    findings[(model_key, 'Missing stored data', field)].add(row['device_subject_id'])
                for difference in differences:
                    findings[(model_key, 'Attribute difference', difference['field'])].add(row['device_subject_id'])
                for note in notes:
                    findings[(model_key, 'Evidence dates', note)].add(row['device_subject_id'])
                details.append({'model_key': model_key, 'model': model, 'family': family, 'issuer': key[0],
                    'udi_di': key[1], 'catalogue': record.get('catalogue_number'), 'outcome': outcome,
                    'issues': issues, 'missing_fields': missing, 'notes': notes, 'differences': differences,
                    'state_source': state.get('accepted_state_source') or 'Stored accepted device snapshot' if state else 'Unavailable'})
        for group in groups.values():
            group['source_files'] = sorted(group['source_files'])
        report = {'report_type': 'stored_device_comparison', 'environment': self.settings.environment,
            'manufacturer': self.settings.eudamed_manufacturer_srn_override,
            'generated_at': datetime.now(UTC).isoformat(), 'import_batch_id': batch['id'],
            'extract_source': selection['selected'], 'excluded_extract_sets': selection['excluded_sets'],
            'comparison_fields': list(COMPARISON_FIELDS.values()),
            'models': sorted(groups.values(), key=lambda group: (group['model'], group['family'])),
            'findings': [{'model_key': model, 'category': category, 'finding': field, 'affected': len(ids)}
                         for (model, category, field), ids in sorted(findings.items())],
            'extract_only': len(set(exported) - set(by_key)), 'evidence': evidence, 'export_files': export_files,
            'details': details,
            'limitations': [
                'All compared attributes match means agreement across the listed supported fields, not full XML equality or proof of registration.',
                'Values come from existing accepted-state readers, including accepted export baselines and successful POST/PATCH/Market Info state. Proposed workbook values and unaccepted drafts are never substitutes.',
                'A known difference is reported even when other stored fields are missing. Without known differences, missing fields or unsupported projection prevent an all-match result.',
                'Stored and extracted optional null values agree only when the stored field is explicitly present. Country/placement and warning/comment relationships are preserved; code lists and sets ignore order.',
                'Parent attributes and parent versions, server version dates, unsupported XML fields and raw payload proof are outside this device comparison scope.',
                'These are values from one database snapshot compared with dated extracts. Newer accepted activity is flagged for investigation; no conclusion about current live EUDAMED state is made.',
                'Absence from dated extracts does not prove unregistration. Finding counts overlap; model outcome columns are mutually exclusive.',
                'Source links are provenance, not verification that original files remain available. Registration evidence belongs in a separate report. Reports are not saved server-side; download to retain this result.']}
        report['excel_base64'] = base64.b64encode(workbook(report, request.include_device_details)).decode()
        return report


def workbook(report, include_details=False):
    book = Workbook()
    sheet = book.active
    sheet.title = 'Context'
    for key in ('report_type', 'environment', 'manufacturer', 'generated_at', 'import_batch_id', 'extract_only'):
        sheet.append([key, str(report[key])])
    for key, value in report['extract_source'].items():
        sheet.append(['Extract source: ' + key, _cell(value)])
    for excluded in report['excluded_extract_sets']:
        sheet.append(['Excluded retained set', _cell(excluded)])
    for field in report['comparison_fields']:
        sheet.append(['Compared field', field])
    for limitation in report['limitations']:
        sheet.append(['Scope / limitation', limitation])
    sheets = {
        'Models': (['Model', 'Family', 'Database devices', 'All compared attributes match', 'Attribute differences', 'Insufficient stored data / scope', 'Absent from extract', 'Entries with accepted stored values'],
            [[g[k] for k in ('model', 'family', 'total', 'exact', 'different', 'unable', 'absent', 'stored_available')] for g in report['models']]),
        'Grouped findings': (['Model / family', 'Category', 'Finding', 'Affected entries'], [[f[k] for k in ('model_key', 'category', 'finding', 'affected')] for f in report['findings']]),
        'Comparison sources': (['Kind', 'File', 'SHA-256', 'Recorded time'], [[e.get(k) for k in ('kind', 'name', 'sha256', 'created_at')] for e in report['evidence']]),
    }
    if include_details:
        sheets['Requested device details'] = (['Model', 'Family', 'Issuer', 'UDI-DI', 'Catalogue', 'Outcome', 'Issues', 'Missing stored fields', 'Date notes', 'Differences', 'Stored state source'],
            [[d.get(k) for k in ('model', 'family', 'issuer', 'udi_di', 'catalogue', 'outcome', 'issues', 'missing_fields', 'notes', 'differences', 'state_source')] for d in report['details']])
    for name, (headers, rows) in sheets.items():
        sheet = book.create_sheet(name)
        sheet.append(headers)
        for row in rows:
            sheet.append([_cell(cell) for cell in row])
        sheet.freeze_panes = 'A2'
        sheet.auto_filter.ref = sheet.dimensions
    for sheet in book:
        for row in sheet:
            for cell in row:
                if isinstance(cell.value, str):
                    cell.data_type = 's'
                    cell.number_format = '@'
    output = BytesIO()
    book.save(output)
    book.close()
    return output.getvalue()
