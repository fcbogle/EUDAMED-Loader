"""Dev import review vocabulary shared by source review and workbook admission."""
POLICY_VERSION = 'minimal-import-v3-confirmed-countries'
CATEGORIES = {
    'files': ('Required files missing or unreadable', 'block', 'Select readable files for all three source types.'),
    'structure': ('Required structure or identifiers missing', 'block', 'Correct the indicated headers, identifiers or essential accepted-state metadata.'),
    'duplicates': ('Duplicate Device UDI-DIs in Templates', 'block', 'Correct every repeated Device UDI-DI in the selected Template workbooks.'),
    'identity': ('Device or catalogue identity requires clarification', 'block', 'Confirm or correct the exact device, Basic UDI-DI or catalogue identities before continuing.'),
    'environment': ('Wrong manufacturer or environment in XMLs', 'block', 'Select extracts for the configured Dev manufacturer and schema.'),
    'exports': ('Incomplete or conflicting XML export set', 'block', 'Select one complete, consistent set of export pages.'),
    'extract_only': ('Registered devices missing from supplied Templates', 'warn', 'Confirm whether these devices should be included in the current Templates. Keep their EUDAMED extract evidence; do not infer that they are unregistered.'),
    'applied_corrections': ('Source correction already applied', 'info', 'The corrected source values agree with the current database. Historical source values are retained for audit. No action required.'),
    'information': ('Additional source information', 'info', 'The new Template explicitly records parent links already held in the database. No action required.'),
    'differences': ('Differences between source files', 'warn', 'Review the previous and incoming source values. This import retains existing device values and accepted history.'),
    'countries': ('Unconfirmed market countries', 'block', "Confirm the country values containing '?'. Do not remove the question mark without confirming the value. Affected records cannot be imported."),
    'optional': ('Missing optional information', 'warn', 'Complete this information when available; it does not prevent import.'),
}


def reason_blocks(reason):
    return reason != 'Proposed parent market countries missing' and not reason.startswith('Formula has no cached value')


def category(title, detail=''):
    text=(title+' '+detail).lower()
    if 'market country contains' in text:return 'countries'
    if title == 'Repeated Device UDI-DI':return 'duplicates'
    if 'manufacturer' in text or 'schema' in text or 'environment' in text:return 'environment'
    if 'cannot be read' in text or 'cannot be checked' in text or 'not a valid .xlsx' in text:
        if 'xml' not in text:return 'files'
    if 'page' in text or 'repeated exported' in text:return 'exports'
    if 'repeated basic' in text and 'Repeated identity; compare' in detail:return 'differences'
    if 'conflict' in text or 'ambiguous' in text or 'repeated basic' in text:return 'identity'
    if 'absent from selected templates' in text:return 'extract_only'
    if not reason_blocks(title):return 'optional'
    return 'structure'


class Findings:
    def __init__(self):self.groups={}

    def add(self, code, source, records):
        title,severity,action=CATEGORIES[code]
        group=self.groups.setdefault(code,dict(code=code,source=source,title=title,severity=severity,action=action,records=[]))
        if group['source']!=source:group['source']='Multiple sources'
        for record in records:
            # Source parsing and batch inspection can report the same XML error.
            # Keep distinct source rows, but show each country finding once.
            if code == 'countries':
                key = lambda item: tuple(item.get(field) or '' for field in ('file', 'row', 'identifier', 'detail'))
                if any(key(existing) == key(record) for existing in group['records']):
                    continue
            group['records'].append({**record, 'source': source})

    def add_source_differences(self, records):
        # Keep every before/after value in the saved report/export, even when a
        # verified addition is presented separately from remaining warnings.
        for record in records:
            verified = set(record.get('informational_fields', []))
            applied = set(record.get('applied_correction_fields', []))
            information = [field for field in record['fields'] if field['field'] in verified]
            corrections = [field for field in record['fields'] if field['field'] in applied]
            warnings = [field for field in record['fields'] if field['field'] not in verified | applied]
            if information:
                self.add('information', 'Template / stored parent links', [{**record, 'fields': information}])
            if corrections:
                self.add('applied_corrections', 'Template / current device values', [{**record, 'fields': corrections,
                    'detail': 'Corrected source agrees with the current database; previous source value retained for audit. No action required.'}])
            if warnings:
                self.add('differences', 'Template / existing database', [{**record, 'fields': warnings}])

    def result(self):
        groups=[]
        for group in self.groups.values():
            records=group['records']
            # A duplicate finding counts repeated identities, while retaining every source row.
            if group['severity'] == 'info':
                identities = lambda items: {(r.get('issuer'), r.get('udi_di')) for r in items}
                count = len(identities(records))
                models = {}
                for record in records:
                    key = (record.get('product_family') or '', record.get('product_variant') or 'Unspecified model')
                    models.setdefault(key, []).append(record)
                model_counts = [{'product_family':key[0], 'product_variant':key[1], 'device_count':len(identities(items))}
                                for key, items in sorted(models.items())]
                groups.append({**group, 'count':count, 'models':model_counts})
            else:
                count=len({(r.get('issuer'),r.get('identifier')) for r in records}) if group['code']=='duplicates' else len(records)
                groups.append({**group,'count':count})
        blocked=any(g['severity']=='block' for g in groups)
        return {'groups':groups,'can_create':not blocked,'policy_version':POLICY_VERSION,
            'message':'Source corrections required' if blocked else 'Ready to continue — warnings found' if any(g['severity']=='warn' for g in groups) else 'Ready to continue — additional source information' if groups else 'Ready to continue'}
