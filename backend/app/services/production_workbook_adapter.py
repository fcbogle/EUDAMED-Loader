"""Prepared-workbook adapter to the existing canonical and accepted XML models."""
from __future__ import annotations

from dataclasses import asdict
import json
import re

import lxml.etree as etree

from app.config import Settings
from app.services import canonical_validation as cv
from app.services.basic_udi_reference import BasicUdiReferenceRow
from app.services.canonical_validation import CanonicalValidationService, SourceRow
from app.services.production_workbook_preparation import NS as EXPORT_NS

NS = {**EXPORT_NS, "language": "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/Common/LanguageSpecific/v1",
      "market": "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/MktInfo/MarketInfo/v1"}
from app.services.xml_projection import DeviceXmlRecord
from app.validation_models import CanonicalValidationRecord, MarketAvailabilityItemPreview, StructuredListItemPreview
from app.xml_models import CriticalWarningXmlItem, StorageConditionXmlItem


def text(value: object) -> str | None:
    return str(value).strip() if value is not None and str(value).strip() else None


def restore_xml(value: dict) -> etree._Element:
    node = etree.Element(value['tag'], attrib=value.get('attributes', {}))
    node.text = value.get('text')
    for child in value.get('children', []):
        node.append(restore_xml(child))
    return node


def family_for(source: str, model: str) -> str:
    # Explicit known family names, independent of dated workbook filenames.
    families = (("Echelon", "Echelon"), ("Elan", "Elan"), ("Elite", "Elite"),
                ("Epirus", "Epirus / Esprit"), ("Esprit", "Epirus / Esprit"),
                ("Navigator", "Navigator / Javelin / Linx"), ("Javelin", "Navigator / Javelin / Linx"),
                ("Linx", "Navigator / Javelin / Linx"))
    for token, family in families:
        if token.casefold() in source.casefold() or token.casefold() in model.casefold():
            return family
    return model


def accepted_snapshot(entry: dict, settings: Settings) -> dict:
    root = restore_xml(entry['xml'])
    basic = root.find('device:MDRBasicUDI', NS)
    device = root.find('device:MDRUDIDIData', NS)
    if basic is None or device is None:
        raise ValueError('Export does not contain an MDR parent/device snapshot.')

    def value(node, path, required=False):
        item = node.find(path, NS)
        result = text(item.text) if item is not None else None
        if required and result is None:
            raise ValueError(f"Missing accepted export field: {path}")
        return result

    def boolean(node, path):
        result = value(node, path, True)
        if result not in ('true', 'false'):
            raise ValueError(f"Invalid accepted boolean: {path}")
        return result == 'true'

    def integer(node, path, required=False):
        result = value(node, path, required)
        return int(result) if result is not None else None

    market = device.find('udi:marketInfos', NS)
    if market is None:
        raise ValueError('Missing accepted Market Info snapshot.')
    for label, node in (('parent', basic), ('device', device), ('Market Info', market)):
        if value(node, 'entity:state', True) != 'REGISTERED':
            raise ValueError(f'Accepted {label} is not REGISTERED.')
        version = value(node, 'entity:version', True)
        if not version.isdigit() or int(version) < 1:
            raise ValueError(f'Invalid accepted {label} version.')
    issuer, code = entry['key']
    parent_issuer, parent = entry['parent']
    if (value(device, 'udi:identifier/common:issuingEntityCode', True), value(device, 'udi:identifier/common:DICode', True)) != (issuer, code):
        raise ValueError('Export identifier differs from audit identity.')
    for node, prefix in ((basic, 'basic:identifier'), (device, 'udi:basicUDIIdentifier')):
        if (value(node, prefix+'/common:issuingEntityCode', True), value(node, prefix+'/common:DICode', True)) != (parent_issuer, parent):
            raise ValueError('Accepted parent link is inconsistent.')
    names = device.findall('udi:tradeNames/language:name', NS)
    # Name children are common in the supplied schema; use the qualified tree.
    if not names:
        names = device.findall('udi:tradeNames/common:name', NS)
    name = names[0] if names else None
    trade = value(name, 'language:textValue') if name is not None else None
    language = value(name, 'language:language') if name is not None else None
    countries = [(value(n, 'market:country', True), boolean(n, 'market:originalPlacedOnTheMarket'))
                 for n in market.findall('market:marketInfo', NS)]
    if not countries:
        raise ValueError('Missing accepted market countries.')
    conditions = [StorageConditionXmlItem(code=value(n, 'common:storageHandlingConditionValue', True),
                  comment=value(n, 'common:comments/language:name/language:textValue'))
                  for n in device.findall('udi:storageHandlingConditions/common:condition', NS)]
    warnings = [CriticalWarningXmlItem(code=value(n, 'common:warningValue', True),
                comment=value(n, 'common:comments/language:name/language:textValue'))
                for n in device.findall('udi:criticalWarnings/common:warning', NS)]
    projected = {'identifier', 'status', 'basicUDIIdentifier', 'MDNCodes', 'productionIdentifier', 'referenceNumber', 'secondaryIdentifier', 'sterile', 'sterilization', 'tradeNames', 'storageHandlingConditions', 'criticalWarnings', 'numberOfReuses', 'marketInfos', 'baseQuantity', 'latex', 'reprocessed'}
    unsupported = []
    for node in device:
        qualified = etree.QName(node)
        if qualified.namespace == NS['entity'] or qualified.localname == 'lastUpdated':
            continue
        if qualified.localname not in projected and (text(node.text) or len(node)):
            unsupported.append(f'Accepted field {qualified.localname} needs complete XML projection support.')
    if len(names) > 1:
        unsupported.append('Multiple accepted trade names require complete multilingual XML projection support.')
    if any(len(node.findall('language:name', NS)) > 1 for node in device.findall('.//common:comments', NS)):
        unsupported.append('Multiple accepted comment translations need complete XML projection support.')
    if not device.findall('udi:MDNCodes', NS):
        raise ValueError('Missing accepted nomenclature codes.')
    model = value(basic, 'basic:modelName/common:name', True)
    catalogue = value(device, 'udi:referenceNumber', True)
    record = DeviceXmlRecord(
        product_family=family_for('', model), product_variant=model, submission_operation='PATCH',
        catalogue_number=catalogue, trade_name=trade, primary_udi_di=code, issuing_entity=issuer,
        language_code=language, basic_identifier_code=parent, basic_identifier_issuing_entity=parent_issuer,
        device_identifier_code=code, device_identifier_issuing_entity=issuer,
        risk_class=value(basic, 'basic:riskClass', True), model_name=model,
        manufacturer_srn=value(basic, 'basic:MFActorCode', True),
        authorised_representative_srn=value(basic, 'basic:ARActorCode'),
        human_tissues_cells=boolean(basic, 'basic:humanTissuesCells'),
        animal_tissues_cells=boolean(basic, 'basic:animalTissuesCells'),
        human_product_check=boolean(basic, 'basic:humanProductCheck'),
        medicinal_product_check=boolean(basic, 'basic:medicinalProductCheck'),
        basic_device_type=value(basic, 'basic:type', True), active=boolean(basic, 'common:active'),
        administering_medicine=boolean(basic, 'common:administeringMedicine'), implantable=boolean(basic, 'common:implantable'),
        measuring_function=boolean(basic, 'common:measuringFunction'), reusable=boolean(basic, 'common:reusable'),
        nomenclature_codes=[text(n.text) for n in device.findall('udi:MDNCodes', NS)],
        status_code=value(device, 'udi:status/common:code', True), production_identifier=value(device, 'udi:productionIdentifier'),
        reference_number=catalogue, secondary_identifier_code=value(device, 'udi:secondaryIdentifier/common:DICode'),
        secondary_identifier_issuing_entity=value(device, 'udi:secondaryIdentifier/common:issuingEntityCode'),
        sterile=boolean(device, 'udi:sterile'), sterilization=boolean(device, 'udi:sterilization'),
        source_version_marker=value(device, 'entity:version', True), number_of_reuses=integer(device, 'udi:numberOfReuses', True),
        contains_latex=boolean(device, 'udi:latex'), reprocessed=boolean(device, 'udi:reprocessed'),
        market_countries=countries, base_quantity=integer(device, 'udi:baseQuantity'),
        storage_conditions=conditions, critical_warnings=warnings,
    )
    return {'version': record.source_version_marker, 'parent_version': value(basic, 'entity:version', True),
            'market_info_version': value(market, 'entity:version', True), 'device_record': asdict(record),
            'trade_name': trade, 'base_quantity': record.base_quantity, 'sterile': record.sterile,
            'contains_latex': record.contains_latex, 'status_code': record.status_code,
            'storage_conditions': [n.model_dump() for n in conditions], 'critical_warnings': [n.model_dump() for n in warnings],
            'market_countries': [{'country': c, 'original_placed_on_market': o} for c,o in countries],
            'export_source': entry['source'], 'export_xml': entry['xml'],
            'unsupported_projection': unsupported}


def canonical_record(row: dict, settings: Settings, *, sheet: str, number: int,
                     snapshot: dict | None = None, service: CanonicalValidationService | None = None) -> CanonicalValidationRecord:
    service = service or CanonicalValidationService()
    values = {k.removeprefix('Proposed: '): v for k,v in row.items() if k.startswith('Proposed: ')}
    parent_values = {k.removeprefix('Proposed Parent: '): v for k,v in row.items() if k.startswith('Proposed Parent: ')}
    get = lambda key: text(parent_values.get(key))
    model = get('Device Model') or text(row['Device Type']) or 'Unspecified model'
    countries = tuple(c.strip() for c in (get('Member States where device is or is to be made available on the market:') or '').split(';') if c.strip())
    reference = BasicUdiReferenceRow(
        applicable_regulation=get('Applicable regulation'), issuing_entity=row['Proposed Parent Issuer'],
        device_model=model, basic_udi_di=row['Proposed Basic UDI-DI'] or row.get('Accepted Basic UDI-DI'),
        manufacturer_srn=settings.eudamed_manufacturer_srn_override, manufacturer_srn_source='derived',
        authorised_representative_srn=settings.eudamed_authorised_representative_srn_override, authorised_representative_srn_source='derived',
        device_type=get('Is it a System or Procedure Pack which is a Device in itself?'), special_device_type=get('Special device type'),
        risk_class=get('Risk class'), implantable=get('Implantable'), measuring_function=get('Measuring function'),
        reusable_surgical_instrument=get('Reusable surgical instrument'), active_device=get('Active device'),
        administering_medicinal_product=get('Device intended to administer and/or remove medicinal product'),
        device_model_applicable=get('Device model applicable'), additional_information_url=get('URL for additional information (as electronic instructions for use):'),
        submission_operation='POST' if sheet == 'To Register' else 'PATCH', source_version_marker='1' if sheet == 'To Register' else None,
        first_eu_market_country=get('Member State of the placing on the EU market of the Device:'), available_market_countries=countries)
    values[cv.ISSUING_ENTITY_HEADER] = row['Issuing Entity']
    values[cv.UDI_DI_HEADER] = row['UDI-DI']
    record = service._build_record(workbook_name='production-import.xlsx', product_family=family_for(row.get('Template Sources') or '', model),
                                   row=SourceRow(sheet, number, values), reference_row=reference)
    if snapshot and not values.get(cv.CATALOGUE_HEADERS[0]) and not values.get(cv.CATALOGUE_HEADERS[1]):
        full = snapshot['device_record']
        # XML-only records use exactly the supplied accepted values, not invented template defaults.
        direct = {
            'manufacturer.issuing_entity': full['issuing_entity'], 'manufacturer.manufacturer_srn': full['manufacturer_srn'],
            'basic_device.regulation': 'MDR', 'basic_device.basic_udi_di': full['basic_identifier_code'],
            'basic_device.device_model': full['model_name'], 'basic_device.device_type': full['basic_device_type'],
            'basic_device.risk_class': full['risk_class'], 'basic_device.authorised_representative_srn': full['authorised_representative_srn'],
            'basic_device.nomenclature_code': ';'.join(full['nomenclature_codes']),
            'device_record.basic_udi_identifier': f"{full['basic_identifier_issuing_entity']}:{full['basic_identifier_code']}",
            'device_record.identifier': f"{full['issuing_entity']}:{full['primary_udi_di']}",
            'device_record.primary_udi_di': full['primary_udi_di'], 'device_record.catalogue_number': full['catalogue_number'],
            'device_record.trade_name': full['trade_name'], 'device_record.language': full['language_code'],
            'device_record.production_identifier': full['production_identifier'], 'device_record.status': full['status_code'],
            'device_record.market_availability.market_status': full['status_code'],
            'device_record.number_of_reuses': str(full['number_of_reuses']), 'device_record.base_quantity': str(full['base_quantity']) if full['base_quantity'] is not None else None,
            'basic_device.source_version_marker': snapshot['version'],
        }
        for field, attribute in [('basic_device.human_tissues_cells','human_tissues_cells'),('basic_device.animal_tissues_cells','animal_tissues_cells'),
             ('basic_device.human_product_check','human_product_check'),('basic_device.medicinal_product_check','medicinal_product_check'),
             ('basic_device.active','active'),('basic_device.administering_medicinal_product','administering_medicine'),
             ('basic_device.implantable','implantable'),('basic_device.measuring_function','measuring_function'),
             ('basic_device.reusable_surgical_instrument','reusable'),('device_record.sterile','sterile'),
             ('device_record.sterilisation_before_use','sterilization'),('device_record.sterilization','sterilization'),('device_record.contains_latex','contains_latex'),('device_record.reprocessed','reprocessed'),('device_record.reprocessed_single_use','reprocessed')]:
            direct[field] = str(full[attribute]).lower()
        for field in record.fields:
            if field.canonical_path in direct:
                field.value = text(direct[field.canonical_path]); field.source='derived'; field.source_detail='Supplied EUDAMED export snapshot'
        record.product_variant=full['model_name']; record.product_family=full['product_family']
        record.trade_name=full['trade_name']; record.catalogue_number=full['catalogue_number']
        record.storage_condition_items=[StructuredListItemPreview(sequence=i, normalized_code=n['code'], description=n['comment']) for i,n in enumerate(snapshot['storage_conditions'],1)]
        record.critical_warning_items=[StructuredListItemPreview(sequence=i, normalized_code=n['code'], description=n['comment']) for i,n in enumerate(snapshot['critical_warnings'],1)]
        record.market_availability_items=[MarketAvailabilityItemPreview(sequence=i,country=n['country'],original_placed_on_market=n['original_placed_on_market']) for i,n in enumerate(snapshot['market_countries'],1)]
    record.completeness=service._completeness_snapshot(record.fields)
    record.xml_readiness=service._xml_readiness_snapshot(record.fields)
    record.blockers=[f'{f.business_label} is not populated.' for f in record.fields if f.required and f.value is None]
    record.xml_blockers=[f'{f.business_label} is not populated for XML generation.' for f in record.fields if f.xml_required and f.value is None]
    if snapshot and snapshot['unsupported_projection']:
        record.xml_blockers.extend(snapshot['unsupported_projection'])
        record.xml_readiness.status='incomplete'
    return record
