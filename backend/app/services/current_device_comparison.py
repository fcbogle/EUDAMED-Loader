"""Read current stored canonical attributes for reconciliation, without accepted-state fallback.

This is a read-only projection. Missing/invalid values remain unknown; it does not
apply XML generation defaults, submission versions or accepted payload values.
"""
import re

from app.services.country_reference import normalize_market_country_code
from app.services.registration_summary import identifier
from app.services.xml_projection import DeviceXmlProjectionBuilder

DIRECT_FIELDS = {
    'reference_number': 'device_record.catalogue_number',
    'trade_name': 'device_record.trade_name',
    'status_code': 'device_record.status',
    'production_identifier': 'device_record.production_identifier',
}
BOOLEAN_FIELDS = {
    'sterile': 'device_record.sterile',
    'sterilization': 'device_record.sterilisation_before_use',
    'contains_latex': 'device_record.contains_latex',
    'reprocessed': 'device_record.reprocessed',
}
INTEGER_FIELDS = {'base_quantity': 'device_record.base_quantity', 'number_of_reuses': 'device_record.number_of_reuses'}


def boolean(value):
    if isinstance(value, bool):
        return value
    token = str(value).strip().lower()
    if token in {'true', 'yes', '1'}:
        return True
    if token in {'false', 'no', '0'}:
        return False
    raise ValueError('Unusable stored boolean')


def current_device_values(record):
    fields = {field['canonical_path']: field['value'] for field in record.get('fields', []) if 'value' in field}
    values, issues = {}, []
    for name, path in DIRECT_FIELDS.items():
        if path in fields:
            values[name] = fields[path]
    for path, code, issuer in (
        ('device_record.identifier', 'device_identifier_code', 'device_identifier_issuing_entity'),
        ('device_record.basic_udi_identifier', 'basic_identifier_code', 'basic_identifier_issuing_entity'),
        ('device_record.secondary_identifier', 'secondary_identifier_code', 'secondary_identifier_issuing_entity'),
    ):
        if path not in fields:
            continue
        value = fields[path]
        if value is None or value == '':
            values[code] = values[issuer] = None
        else:
            entity, di = identifier(value)
            if entity and di:
                values[code], values[issuer] = di, entity
            else:
                issues.append('Stored identifier is incomplete: ' + path)
    for name, path in BOOLEAN_FIELDS.items():
        if path in fields:
            try:
                values[name] = boolean(fields[path])
            except ValueError:
                issues.append('Stored boolean is missing or invalid: ' + path)
    for name, path in INTEGER_FIELDS.items():
        if path not in fields:
            continue
        value = fields[path]
        if value is None or value == '':
            values[name] = None
        else:
            try:
                # Never truncate a fractional value or turn a boolean into a quantity.
                if isinstance(value, bool) or not re.fullmatch(r'[+-]?\d+', str(value).strip()):
                    raise ValueError('Invalid integer')
                number = int(str(value))
                # The schema uses -1 for a reuse limit that is not applicable.
                if number < (-1 if name == 'number_of_reuses' else 1):
                    raise ValueError('Integer outside supported range')
                values[name] = number
            except (ValueError, TypeError):
                issues.append('Stored quantity is invalid: ' + path)
    if 'device_record.language' in fields:
        value = fields['device_record.language']
        if value is None or isinstance(value, str):
            values['language_code'] = DeviceXmlProjectionBuilder._language_code(value) if value else None
        else:
            issues.append('Stored language is invalid')
    if 'basic_device.nomenclature_code' in fields:
        value = fields['basic_device.nomenclature_code']
        if value is None or isinstance(value, str):
            values['nomenclature_codes'] = DeviceXmlProjectionBuilder._split_codes(value) if value else None
        else:
            issues.append('Stored nomenclature code is invalid')
    for name, key in (('storage_conditions', 'storage_condition_items'), ('critical_warnings', 'critical_warning_items')):
        if key not in record:
            continue
        items = record[key]
        if not isinstance(items, list) or any(not isinstance(item, dict) or not item.get('normalized_code') for item in items):
            issues.append('Stored structured items have no usable code: ' + name)
        else:
            values[name] = [{'code': item['normalized_code'], 'comment': item.get('description')} for item in items]
    market = None
    if 'market_availability_items' in record:
        try:
            countries = []
            for item in record['market_availability_items']:
                code = normalize_market_country_code(item.get('country'))
                if not code or 'original_placed_on_market' not in item:
                    raise ValueError('Missing country or original-placement flag')
                countries.append({'country': code, 'original_placed_on_market': boolean(item['original_placed_on_market'])})
            first = fields.get('device_record.market_availability.first_eu_market_country')
            if first:
                first_code = normalize_market_country_code(first)
                if [item['country'] for item in countries if item['original_placed_on_market']] != [first_code]:
                    raise ValueError('First market country conflicts with stored original-placement flags')
            market = {'market_countries': countries}
        except (ValueError, TypeError):
            issues.append('Stored market countries or original-placement flags are missing, questioned or inconsistent')
    return {'device_record': values}, market, issues
