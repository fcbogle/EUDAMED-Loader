"""Official profile regressions use synthetic XML and temporary sources only."""
from dataclasses import replace
from hashlib import sha256
from pathlib import Path
import json
from lxml import etree
import pytest
from app.config import get_settings
from app.services.country_reference import MARKET_COUNTRY_REFERENCE
from app.services.production_workbook_preparation import NS
from app.services.source_batch_receipt import ReceivedFile, validate_received_content
from app.services.xml_projection import DeviceXmlProjectionBuilder, MarketInfoXmlRecord
from app.services.xml_rendering import EudamedMessageRenderer
from scripts.benchmark_xml import synthetic_record
from test_dev_input_batches import project
from test_retained_eudamed_extracts import change_xml
from test_ra_reporting import report_case
from test_playground_reconciliation import reconciliation

ROOT = Path(__file__).resolve().parents[2]
SERVICE_NS = '{https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Service/v1}'

@pytest.fixture(params=[('dev', '3.0.36.1', 'dev-3.0.36.1-official'), ('prod', '3.0.30', 'prod-3.0.30')])
def official_profile(request):
    environment, version, profile = request.param
    settings = get_settings().model_copy(update={'environment': environment,
        'eudamed_message_schema_version': version, 'schema_dir': ROOT / 'data/schema_profiles' / profile,
        'eudamed_manufacturer_srn_override': 'GB-MF-000000001',
        'eudamed_authorised_representative_srn_override': None, 'eudamed_suppress_authorised_representative': True})
    return settings, etree.XMLSchema(etree.parse(str(settings.schema_dir / 'service/Message.xsd')))

@pytest.mark.parametrize('flow', ['device_post', 'child_post', 'patch', 'market_info'])
@pytest.mark.parametrize('count', [1, 3])
def test_single_and_bulk_messages_use_correct_official_schema(official_profile, flow, count):
    settings, schema = official_profile
    renderer = EudamedMessageRenderer(settings)
    messages = []
    for index in range(count):
        record = DeviceXmlProjectionBuilder().build_device_record(synthetic_record(index))
        record = replace(record, manufacturer_srn='GB-MF-000000001', authorised_representative_srn=None)
        if flow == 'market_info':
            market = MarketInfoXmlRecord(record.product_family, record.product_variant, record.catalogue_number,
                record.primary_udi_di, '2', record.manufacturer_srn, record.device_identifier_code,
                record.device_identifier_issuing_entity, [('DE', True), ('FR', False)])
            message = renderer.render_market_info_message(market)
        else:
            if flow == 'child_post':
                record = replace(record, post_payload_mode='udidi_only', service_id_override='UDI_DI')
            elif flow == 'patch':
                record = replace(record, submission_operation='PATCH', patch_version_override='2')
            message = renderer.render_message(record)
        schema.assertValid(etree.fromstring(message))
        messages.append(message.decode())
    root = etree.fromstring(renderer.render_batch_from_strings(messages))
    assert root.get('version') == settings.eudamed_message_schema_version
    assert len(root.find('message:payload', NS)) == count
    schema.assertValid(root)
    expected = {'device_post': ('DEVICE', 'POST'), 'child_post': ('UDI_DI', 'POST'),
                'patch': ('UDI_DI', 'PATCH'), 'market_info': ('MARKET_INFO', 'PUT')}[flow]
    service = root.find('message:recipient/message:service', NS)
    assert (service.findtext(SERVICE_NS+'serviceID'), service.findtext(SERVICE_NS+'serviceOperation')) == expected

@pytest.mark.parametrize('version', ['3.0.32', '3.0.30', '3.0.36.2', None])
def test_receipt_rejects_old_unknown_or_missing_versions(project, version):
    path = project / 'data/downloads/export.xml'
    root = etree.parse(str(path)).getroot()
    if version is None: del root.attrib['version']
    else: root.set('version', version)
    path.write_bytes(etree.tostring(root))
    item = ReceivedFile(role='eudamed-xml', name=path.name, content_base64='')
    with pytest.raises(ValueError, match='schema/manufacturer'):
        validate_received_content(path, item, 'GB-MF-000000001')

def test_current_receipt_passes_and_wrong_manufacturer_still_fails(project):
    path = project / 'data/downloads/export.xml'
    item = ReceivedFile(role='eudamed-xml', name=path.name, content_base64='')
    validate_received_content(path, item, 'GB-MF-000000001')
    with pytest.raises(ValueError, match='schema/manufacturer'):
        validate_received_content(path, item, 'GB-MF-000000002')

def test_retained_reporting_rejects_old_schema_without_rewriting_evidence(report_case):
    from app.services.retained_eudamed_extracts import RetainedEudamedExtracts
    settings, *_ = report_case
    batch = settings.dev_input_batch_root / '2026-10-25-001'
    change_xml(batch, lambda root: root.set('version', '3.0.32'))
    before = {p: p.read_bytes() for p in batch.rglob('*') if p.is_file()}
    result = RetainedEudamedExtracts(settings).status()
    assert not result['available'] and 'schema' in result['excluded_sets'][0]['reason']
    assert all(p.read_bytes() == data for p, data in before.items())

def test_official_package_matches_recorded_hashes():
    manifest = json.loads((ROOT / 'data/schema_profiles/manifest.json').read_text())['playground_3_0_36_1']
    assert sha256((ROOT / manifest['archive_path']).read_bytes()).hexdigest() == manifest['download_sha256']
    for name, digest in manifest['file_sha256'].items():
        assert sha256((ROOT / manifest['path'] / name).read_bytes()).hexdigest() == digest

def test_supported_market_countries_remain_valid(official_profile):
    settings, schema = official_profile
    market = MarketInfoXmlRecord('Synthetic', 'Synthetic', 'SYN-00000', '99000000000000', '2',
        'GB-MF-000000001', '99000000000000', 'GS1',
        [(entry.code, entry.code == 'DE') for entry in MARKET_COUNTRY_REFERENCE])
    schema.assertValid(etree.fromstring(EudamedMessageRenderer(settings).render_market_info_message(market)))

@pytest.mark.parametrize('value,valid', [(-2, False), (-1, True), (32768, True), (999999, True), (1000000, False)])
def test_dev_reuse_count_obeys_official_shared_type(value, valid):
    settings = get_settings()
    assert settings.eudamed_message_schema_version == '3.0.36.1'
    schema = etree.XMLSchema(etree.parse(str(settings.schema_dir / 'service/Message.xsd')))
    record = replace(DeviceXmlProjectionBuilder().build_device_record(synthetic_record(0)), number_of_reuses=value)
    assert schema.validate(etree.fromstring(EudamedMessageRenderer(settings).render_message(record))) == valid
