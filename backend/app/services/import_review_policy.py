"""Dev import review vocabulary shared by source review and workbook admission."""
POLICY_VERSION = 'minimal-import-v2'
CATEGORIES = {
    'files': ('Required files missing or unreadable', 'block', 'Select readable files for all three source types.'),
    'structure': ('Required structure or identifiers missing', 'block', 'Correct the indicated headers, identifiers or essential accepted-state metadata.'),
    'duplicates': ('Duplicate Device UDI-DIs in Templates', 'block', 'Correct every repeated Device UDI-DI in the selected Template workbooks.'),
    'identity': ('Device or catalogue identity requires clarification', 'block', 'Confirm or correct the exact device, Basic UDI-DI or catalogue identities before continuing.'),
    'environment': ('Wrong manufacturer or environment in XMLs', 'block', 'Select extracts for the configured Dev manufacturer and schema.'),
    'exports': ('Incomplete or conflicting XML export set', 'block', 'Select one complete, consistent set of export pages.'),
    'differences': ('Differences between source files', 'warn', 'Review if useful. Existing accepted database values are retained.'),
    'optional': ('Missing optional information', 'warn', 'Complete this information when available; it does not prevent import.'),
}


def reason_blocks(reason):
    return not reason.startswith(('Proposed parent market countries missing or tentative',
        'Formula has no cached value'))


def category(title, detail=''):
    text=(title+' '+detail).lower()
    if title == 'Repeated Device UDI-DI':return 'duplicates'
    if 'manufacturer' in text or 'schema' in text or 'environment' in text:return 'environment'
    if 'cannot be read' in text or 'cannot be checked' in text or 'not a valid .xlsx' in text:
        if 'xml' not in text:return 'files'
    if 'page' in text or 'repeated exported' in text:return 'exports'
    if 'repeated basic' in text and 'Repeated identity; compare' in detail:return 'differences'
    if 'conflict' in text or 'ambiguous' in text or 'repeated basic' in text:return 'identity'
    if 'absent from selected templates' in text:return 'differences'
    if not reason_blocks(title):return 'optional'
    return 'structure'


class Findings:
    def __init__(self):self.groups={}

    def add(self, code, source, records):
        title,severity,action=CATEGORIES[code]
        group=self.groups.setdefault(code,dict(code=code,source=source,title=title,severity=severity,action=action,records=[]))
        if group['source']!=source:group['source']='Multiple sources'
        group['records'].extend({**record,'source':source} for record in records)

    def result(self):
        groups=[]
        for group in self.groups.values():
            records=group['records']
            # A duplicate finding counts repeated identities, while retaining every source row.
            count=len({(r.get('issuer'),r.get('identifier')) for r in records}) if group['code']=='duplicates' else len(records)
            groups.append({**group,'count':count})
        blocked=any(g['severity']=='block' for g in groups)
        return {'groups':groups,'can_create':not blocked,'policy_version':POLICY_VERSION,
            'message':'Source corrections required' if blocked else 'Ready to continue — warnings found' if groups else 'Ready to continue'}
