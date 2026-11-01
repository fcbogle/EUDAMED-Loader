"""Compact source-specific correction summaries over retained batch inputs."""
from collections import defaultdict
import json
from pathlib import Path

from lxml import etree
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from zipfile import BadZipFile
from app.services.production_workbook_preparation import _parent_reference, _templates, _exports


def review_sources(batch: Path, exclusions: tuple[str, ...]) -> dict:
    groups = {}
    def difference_detail(rows, row):
        keys = set().union(*(entry.get('fields', {}).keys() for entry in rows))
        changed = {key: row.get('fields', {}).get(key) for key in sorted(keys)
                   if len({json.dumps(entry.get('fields', {}).get(key), sort_keys=True) for entry in rows}) > 1}
        return json.dumps(changed, ensure_ascii=False) if changed else 'Repeated identity; compare the listed source rows before agreeing a correction.'
    def add(source, title, action, row=None, *, severity='Correction required', detail=''):
        key = (source, title)
        group = groups.setdefault(key, {'source': source, 'title': title, 'severity': severity,
            'action': action, 'owner': 'Enterprise Solutions' if source == 'Files' else 'Regulatory Affairs / source-data contact', 'records': []})
        row = row or {}
        origin = row.get('source', {})
        fields = row.get('fields', {})
        catalogue = next((str(value) for name, value in fields.items() if ('catalogue' in name.lower() or 'reference' in name.lower()) and value is not None), '')
        group['records'].append({'file': origin.get('file', ''), 'sheet': origin.get('sheet', ''),
            'row': origin.get('row', origin.get('device_index', '')), 'issuer': (row.get('key') or ('', ''))[0],
            'identifier': (row.get('key') or ('', ''))[1], 'basic_udi_di': (row.get('parent') or ('', ''))[1],
            'catalogue': catalogue, 'detail': detail})
    def result():
        manifest = json.loads((batch / 'manifest.json').read_text())
        receipt = manifest.get('receipt', {})
        reference_name = next((f.get('original_name', 'BasicUDIs.xlsx') for f in manifest['files'] if f['role'] == 'basic-udi'), 'BasicUDIs.xlsx')
        contact = receipt.get('source_contact_name')
        for group in groups.values():
            for record in group['records']:
                if record['file'] == 'BasicUDIs.xlsx':record['file'] = reference_name
            if contact:
                group['owner'] = f"{contact} ({receipt.get('source_contact_email', '')}) — source-data clarification"
        return {'groups': [{**g, 'count': len(g['records'])} for g in groups.values()]}
    parse_errors = (ValueError, OSError, etree.LxmlError, BadZipFile, InvalidFileException, KeyError, TypeError)
    try:
        book = load_workbook(batch / 'basic-udi/BasicUDIs.xlsx', read_only=True, data_only=True)
        try:
            for sheet in book:
                rows = iter(sheet.iter_rows(values_only=True))
                headers = list(next(rows, ()))
                required = {'Issuing Entity', 'Basic UDI-DI code', 'Device Model'}
                if not required <= set(headers):
                    add('BasicUDI', 'BasicUDI headers need correction', 'Supply the required parent-reference columns.', {'source': {'file': 'BasicUDIs.xlsx', 'sheet': sheet.title, 'row': 1}}, detail='Missing columns: ' + ', '.join(sorted(required - set(headers))))
                    continue
                for number, values in enumerate(rows, 2):
                    if not any(value is not None for value in values):continue
                    fields = dict(zip(headers, values))
                    issuer = str(fields.get('Issuing Entity') or '').strip()
                    code = str(fields.get('Basic UDI-DI code') or '').strip()
                    row = {'key': (issuer, code), 'source': {'file': 'BasicUDIs.xlsx', 'sheet': sheet.title, 'row': number}}
                    if not issuer or not code:
                        add('BasicUDI', 'Incomplete Basic UDI-DI identity', 'Supply both the issuing entity and parent identifier; do not infer identifiers.', row)
                    if not str(fields.get('Device Model') or '').strip():
                        add('BasicUDI', 'Missing device model', 'Confirm the model associated with this parent identifier.', row)
        finally:
            book.close()
    except parse_errors as exc:
        add('BasicUDI', 'BasicUDI workbook cannot be read', 'Supply a readable BasicUDI workbook.', {'source': {'file': 'BasicUDIs.xlsx'}}, detail=str(exc))
    try:
        models, parents = _parent_reference(batch / 'basic-udi/BasicUDIs.xlsx')
    except parse_errors as exc:
        if not groups:
            add('BasicUDI', 'BasicUDI workbook needs correction', 'Check required headers and issuer-qualified parent identifiers.',
                {'source': {'file': 'BasicUDIs.xlsx'}}, detail=str(exc))
        return result()
    for key, rows in parents.items():
        if len(rows) > 1:
            for row in rows:
                add('BasicUDI', 'Repeated Basic UDI-DI', 'Confirm the intended parent entry and resolve repeated or conflicting rows.', row, severity='Clarification required', detail=difference_detail(rows, row))
    templates = []
    names = {p.name for p in (batch / 'templates').glob('*.xlsx')}
    for name in sorted(names - set(exclusions)):
        try:
            rows, _, _ = _templates(batch / 'templates', models, parents,
                parent_reference=batch / 'basic-udi/BasicUDIs.xlsx', excluded_workbook_names=tuple(names - {name}))
            templates.extend(rows)
            for row in rows:
                for reason in row['reasons']:
                    cross = 'parent' in reason.lower() or 'BasicUDI' in reason
                    add('Template → BasicUDI' if cross else 'Template', reason,
                        'Check the Template parent link against the BasicUDI workbook; confirm which source needs correction.' if cross else 'Correct or clarify the identified Template cells; preserve identifiers and leading zeroes.', row)
        except parse_errors as exc:
            add('Template', 'Template workbook cannot be checked', 'Check the workbook structure and required headers.',
                {'source': {'file': name}}, detail=str(exc))
    identities = defaultdict(list)
    for row in templates:
        if all(row['key']):identities[tuple(row['key'])].append(row)
    for rows in identities.values():
        if len(rows)>1:
            for row in rows:
                add('Template', 'Repeated Device UDI-DI', 'Compare the identified rows and confirm the correct records; do not remove records by assumption.', row, severity='Clarification required', detail=difference_detail(rows, row))
    try:
        exports, _ = _exports(batch / 'eudamed-xml', {})
        exported = defaultdict(list)
        for row in exports:
            exported[tuple(row['key'])].append(row)
            for reason in row['reasons']:
                add('EUDAMED extracts', reason, 'Check the extract and confirm whether the missing attribute is required or unavailable evidence; do not invent accepted values.', row, severity='Clarification required')
            if tuple(row['key']) not in identities:
                add('Template ↔ EUDAMED', 'Exported device absent from selected Templates', 'Confirm intended coverage and which source set needs updating.', row, severity='Clarification required')
        for rows in exported.values():
            if len(rows)>1:
                for row in rows:add('EUDAMED extracts', 'Repeated exported Device UDI-DI', 'Review overlapping pages or versions and supply one consistent current page set.',row)
    except parse_errors as exc:
        add('EUDAMED extracts', 'XML page set cannot be checked', 'Check that all pages from one complete current manufacturer search were selected.', detail=str(exc))
    return result()


def review_summary(review: dict) -> dict:
    return {'groups': [{**g, 'records': g['records'][:10], 'details_truncated': len(g['records'])>10} for g in review['groups']],
            'issue_types': len(review['groups']), 'affected_occurrences': sum(len(g['records']) for g in review['groups'])}
