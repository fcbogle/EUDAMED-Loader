"""Withdrawal PATCH checks use synthetic records, schemas and temporary SQLite only."""
from dataclasses import asdict, replace
from pathlib import Path
from types import SimpleNamespace
import json
import sqlite3

from lxml import etree
import pytest

from app.config import get_settings
from app.services.xml_projection import DeviceXmlProjectionBuilder
from app.services.xml_rendering import EudamedMessageRenderer
from app.services.xml_validation import XmlValidationService
from app.services.xml_generation import XmlGenerationService
from app.services.production_workbook_import import ProductionWorkbookImporter
from scripts.benchmark_xml import synthetic_record
from test_production_workbook_import import production


@pytest.fixture
def baseline():
    builder = DeviceXmlProjectionBuilder()
    return builder.build_equivalent_first_patch(builder.build_device_record(synthetic_record(0)))


@pytest.mark.parametrize('schema_version,package', [('3.0.30', 'prod-3.0.30'), ('3.0.36.1', 'dev-3.0.36.1-official')])
def test_withdrawal_preserves_device_attributes_and_omits_market_info(baseline, schema_version, package):
    original = asdict(baseline)
    changed = DeviceXmlProjectionBuilder.build_status_code_edit_patch(baseline,
        new_status_code='NO_LONGER_PLACED_ON_THE_MARKET', patch_version='3')
    assert asdict(baseline) == original
    expected = {**original, 'status_code': 'NO_LONGER_PLACED_ON_THE_MARKET',
        'source_version_marker': '3', 'patch_version_override': '3',
        'market_countries': [], 'include_market_infos_in_patch': False}
    assert asdict(changed) == expected
    settings = get_settings().model_copy(update={'eudamed_message_schema_version': schema_version,
        'schema_dir': Path(__file__).resolve().parents[2] / 'data/schema_profiles' / package})
    xml = EudamedMessageRenderer(settings).render_message(changed)
    root = etree.fromstring(xml)
    assert not root.xpath('//*[local-name()="marketInfos"]')
    assert root.xpath('//*[local-name()="status"]/*[local-name()="code"]/text()') == ['NO_LONGER_PLACED_ON_THE_MARKET']
    validator = XmlValidationService()
    validator.schema_path = settings.schema_dir / 'service/Message.xsd'
    assert validator.validate_message(xml).valid
    # Even a later caller carrying old country links must not put them in this PATCH.
    stale = replace(changed, market_countries=baseline.market_countries, include_market_infos_in_patch=True)
    assert not etree.fromstring(EudamedMessageRenderer(settings).render_message(stale)).xpath('//*[local-name()="marketInfos"]')


@pytest.mark.parametrize('before,after', [
    ('ON_THE_MARKET', 'ON_THE_MARKET'), ('ON_THE_MARKET', 'NOT_INTENDED_FOR_EU_MARKET'),
    ('NO_LONGER_PLACED_ON_THE_MARKET', 'ON_THE_MARKET'),
    ('NOT_INTENDED_FOR_EU_MARKET', 'NO_LONGER_PLACED_ON_THE_MARKET'),
    ('', 'NO_LONGER_PLACED_ON_THE_MARKET'),
])
def test_unsupported_transitions_are_rejected(baseline, before, after):
    with pytest.raises(ValueError, match='supports only'):
        DeviceXmlProjectionBuilder.build_status_code_edit_patch(replace(baseline, status_code=before),
            new_status_code=after, patch_version='3')


def test_unknown_environment_is_blocked_before_database_or_baseline_access():
    service = object.__new__(XmlGenerationService)
    service.settings = SimpleNamespace(environment='unknown')
    with pytest.raises(ValueError, match='confirmed Dev or Production'):
        service._build_generated_patch_preview(product_family='Synthetic', product_variant='Synthetic',
            catalogue_number='SYN', scenario_id='status_code_edit', patch_version='3',
            scenario_inputs={'new_status_code': 'NO_LONGER_PLACED_ON_THE_MARKET'})


@pytest.fixture
def playground_device(production):
    settings, _, _ = production
    importer = ProductionWorkbookImporter()
    importer.run_import(assessment_token=importer.assess()['assessment_token'])
    # Reuse only synthetic fixture data, marking the baseline as a Playground observation.
    with sqlite3.connect(settings.testing_state_db_path) as connection:
        rows = connection.execute("SELECT id,subject_id,state_after_json FROM testing_events WHERE event_kind='BASELINE_IMPORT'").fetchall()
        for event, subject, raw in rows:
            state = json.loads(raw)
            state['accepted_state_source'] = 'playground_export'
            connection.execute("UPDATE testing_events SET message_type='PLAYGROUND_EXPORT.SNAPSHOT',accepted_state_source='playground_export',state_after_json=? WHERE id=?", (json.dumps(state), event))
            connection.execute('UPDATE testing_subjects SET latest_successful_state_json=? WHERE id=?', (json.dumps(state), subject))
    settings.environment = 'dev'
    settings.eudamed_message_schema_version = '3.0.36.1'
    settings.schema_dir = settings.schema_dir.parent / 'dev-3.0.36.1-official'
    return settings, dict(product_family='Synthetic model', product_variant='Synthetic model', catalogue_number='SYN-00000')


def test_export_backed_preview_uses_next_version_and_does_not_accept_the_draft(playground_device):
    settings, identity = playground_device
    service = XmlGenerationService(require_import=True)
    before = settings.testing_state_db_path.read_bytes()
    result = service.preview_generated_patch_scenario(**identity, scenario_id='status_code_edit', patch_version='3',
        scenario_inputs={'new_status_code': 'NO_LONGER_PLACED_ON_THE_MARKET'})
    assert result.context.base_version == '2'
    assert result.derived_patch_validation.valid
    assert 'NO_LONGER_PLACED_ON_THE_MARKET' in result.derived_patch_xml
    assert not etree.fromstring(result.derived_patch_xml.encode()).xpath('//*[local-name()="marketInfos"]')
    assert settings.testing_state_db_path.read_bytes() == before
    with pytest.raises(ValueError):
        service.preview_generated_patch_scenario(**identity, scenario_id='status_code_edit', patch_version='2',
            scenario_inputs={'new_status_code': 'NO_LONGER_PLACED_ON_THE_MARKET'})


def test_withdrawal_requires_the_accepted_status_not_a_workbook_default(playground_device):
    settings, identity = playground_device
    with sqlite3.connect(settings.testing_state_db_path) as connection:
        raw = connection.execute("SELECT latest_successful_state_json FROM testing_subjects WHERE catalogue_number='SYN-00000'").fetchone()[0]
        state = json.loads(raw)
        state['status_code'] = None
        connection.execute("UPDATE testing_subjects SET latest_successful_state_json=? WHERE catalogue_number='SYN-00000'", (json.dumps(state),))
    service = XmlGenerationService(require_import=True)
    with pytest.raises(ValueError, match='requires accepted evidence'):
        service.preview_generated_patch_scenario(**identity, scenario_id='status_code_edit', patch_version='3',
            scenario_inputs={'new_status_code': 'NO_LONGER_PLACED_ON_THE_MARKET'})


def test_followup_patch_does_not_restore_country_links_after_withdrawal(baseline):
    from app.xml_models import PatchStateSnapshot
    state = PatchStateSnapshot(version='3', status_code='NO_LONGER_PLACED_ON_THE_MARKET',
        storage_conditions=[], critical_warnings=[])
    following = DeviceXmlProjectionBuilder.build_patch_record_from_state(baseline, state)
    assert following.status_code == 'NO_LONGER_PLACED_ON_THE_MARKET'
    assert following.market_countries == []
    assert not following.include_market_infos_in_patch


@pytest.fixture
def bulk_playground_devices(production):
    from copy import deepcopy
    from test_production_workbook_preparation import NS
    settings, paths, prepare = production
    path = paths['xml_dir'] / 'export.xml'
    root = etree.fromstring(path.read_bytes())
    payload = root.find('message:payload', NS)
    original = payload.find('device:Device', NS)
    for index, version, status in [(10, '4', 'ON_THE_MARKET'), (11, '2', 'NO_LONGER_PLACED_ON_THE_MARKET')]:
        device = deepcopy(original)
        udi = device.find('device:MDRUDIDIData', NS)
        udi.find('udi:identifier/common:DICode', NS).text = f'{99000000000000 + index:014d}'
        udi.find('udi:referenceNumber', NS).text = f'SYN-{index:05d}'
        udi.find('entity:version', NS).text = version
        udi.find('udi:status/common:code', NS).text = status
        payload.append(device)
    path.write_bytes(etree.tostring(root))
    prepare()
    settings, _ = playground_device.__wrapped__(production)
    return settings, dict(product_family='Synthetic model', product_variant='Synthetic model',
        basic_udi_di='BASICSHARED', record_count=3,
        selected_catalogue_numbers=['SYN-00000', 'SYN-00010', 'SYN-00011'],
        scenario_id='status_code_edit', scenario_inputs={'new_status_code':'NO_LONGER_PLACED_ON_THE_MARKET'})


@pytest.mark.parametrize("environment", ["dev", "prod"])
def test_bulk_withdrawal_uses_individual_versions_and_excludes_off_market(bulk_playground_devices, environment):
    settings, args = bulk_playground_devices
    if environment == "prod":
        use_production_profile(settings)
    service = XmlGenerationService(require_import=True)
    before = settings.testing_state_db_path.read_bytes()
    result = service.preview_bulk_patch(**args)
    assert result.included_record_count == 2
    assert {(r.catalogue_number, r.base_version, r.derived_version) for r in result.included_records} == {
        ('SYN-00000', '2', '3'), ('SYN-00010', '4', '5')}
    assert len(result.excluded_records) == 1
    assert result.excluded_records[0].catalogue_number == 'SYN-00011'
    assert 'requires accepted evidence' in result.excluded_records[0].reason_message
    assert result.selected_chunk_validation.valid, result.selected_chunk_validation.errors
    root = etree.fromstring(result.selected_chunk_xml.encode())
    assert root.xpath('//*[local-name()="status"]/*[local-name()="code"]/text()') == ['NO_LONGER_PLACED_ON_THE_MARKET'] * 2
    assert not root.xpath('//*[local-name()="marketInfos"]')
    assert settings.testing_state_db_path.read_bytes() == before


@pytest.mark.parametrize("environment", ["dev", "prod"])
@pytest.mark.parametrize("second_succeeds", [False, True])
def test_bulk_withdrawal_success_updates_only_acknowledged_devices(bulk_playground_devices, second_succeeds, environment):
    from io import BytesIO
    from zipfile import ZipFile
    from test_production_workbook_import import acknowledgement
    from app.services.testing_success_xml import TestingSuccessXmlService
    settings, args = bulk_playground_devices
    if environment == "prod":
        use_production_profile(settings)
    service = XmlGenerationService(require_import=True)
    with sqlite3.connect(settings.testing_state_db_path) as c:
        source_rows = c.execute('SELECT id,raw_payload_json FROM source_row ORDER BY id').fetchall()
    _, package = service.download_bulk_patch(**args)
    with ZipFile(BytesIO(package)) as archive:
        xml = archive.read(next(n for n in archive.namelist() if n.endswith('.xml'))).decode()
    root = etree.fromstring(acknowledgement(xml, '3'))
    ns = {'m': etree.QName(root).namespace}
    response = root.find('m:responseEntity', ns)
    from copy import deepcopy
    second = deepcopy(response)
    second.find('m:entityCode', ns).text = '99000000000010'
    second.find('m:entityVersion', ns).text = '5'
    second.find('m:responseCode', ns).text = 'SUCCESS' if second_succeeds else 'PROCESSED_WITH_ERRORS'
    root.append(second)
    ack = etree.tostring(root)
    result = TestingSuccessXmlService().record_success_xml(xml_bytes=ack, source_file_name='bulk-withdrawal-response.xml')
    assert [s['status'] for s in result.current_data_sync] == ['applied'] * (2 if second_succeeds else 1)
    with sqlite3.connect(settings.testing_state_db_path) as c:
        assert source_rows == c.execute('SELECT id,raw_payload_json FROM source_row ORDER BY id').fetchall()
        for catalogue, version, status in [('SYN-00000','3','NO_LONGER_PLACED_ON_THE_MARKET'), ('SYN-00010', '5' if second_succeeds else '4', 'NO_LONGER_PLACED_ON_THE_MARKET' if second_succeeds else 'ON_THE_MARKET')]:
            accepted, raw = c.execute('SELECT s.latest_successful_version,c.record_json FROM testing_subjects s JOIN canonical_device_record c ON c.device_subject_id=s.device_subject_id WHERE s.catalogue_number=?',(catalogue,)).fetchone()
            fields = {f['canonical_path']:f['value'] for f in json.loads(raw)['fields']}
            assert accepted == version
            assert fields['device_record.status'] == status
    duplicate = TestingSuccessXmlService().record_success_xml(xml_bytes=ack, source_file_name='bulk-withdrawal-response.xml')
    assert all(s['status'] == 'already_processed' for s in duplicate.current_data_sync)


def test_bulk_withdrawal_requires_confirmed_environment_before_database_access():
    service = object.__new__(XmlGenerationService)
    service.settings = SimpleNamespace(environment='unknown')
    with pytest.raises(ValueError, match='confirmed Dev or Production'):
        service._prepare_bulk_patch(product_family='Synthetic', product_variant='Synthetic', basic_udi_di='BASIC',
            record_count=2, scenario_id='status_code_edit')


def test_bulk_withdrawal_rejects_an_unsupported_target(bulk_playground_devices):
    settings, args = bulk_playground_devices
    args['scenario_inputs'] = {'new_status_code':'NOT_INTENDED_FOR_EU_MARKET'}
    before = settings.testing_state_db_path.read_bytes()
    with pytest.raises(ValueError, match='No eligible records'):
        XmlGenerationService(require_import=True).preview_bulk_patch(**args)
    assert settings.testing_state_db_path.read_bytes() == before


def use_production_profile(settings):
    """Switch only the synthetic fixture to its original Production baseline profile."""
    settings.environment = 'prod'
    settings.eudamed_message_schema_version = '3.0.30'
    settings.schema_dir = settings.schema_dir.parent / 'prod-3.0.30'
    with sqlite3.connect(settings.testing_state_db_path) as c:
        c.execute("UPDATE testing_events SET accepted_state_source='production_export',message_type='PRODUCTION_EXPORT.SNAPSHOT',state_after_json=replace(state_after_json,'playground_export','production_export') WHERE accepted_state_source='playground_export'")
        c.execute("UPDATE testing_subjects SET latest_successful_state_json=replace(latest_successful_state_json,'playground_export','production_export')")


def test_production_single_withdrawal_preview_uses_accepted_baseline_without_writes(production):
    settings, _, _ = production
    importer = ProductionWorkbookImporter()
    importer.run_import(assessment_token=importer.assess()['assessment_token'])
    before = settings.testing_state_db_path.read_bytes()
    result = XmlGenerationService(require_import=True).preview_generated_patch_scenario(
        product_family='Synthetic model', product_variant='Synthetic model',
        catalogue_number='SYN-00000', scenario_id='status_code_edit', patch_version='3',
        scenario_inputs={'new_status_code':'NO_LONGER_PLACED_ON_THE_MARKET'})
    assert result.context.base_version == '2'
    assert result.derived_patch_validation.valid
    assert 'NO_LONGER_PLACED_ON_THE_MARKET' in result.derived_patch_xml
    assert not etree.fromstring(result.derived_patch_xml.encode()).xpath('//*[local-name()="marketInfos"]')
    assert settings.testing_state_db_path.read_bytes() == before


@pytest.mark.parametrize('environment', ['dev', 'prod'])
@pytest.mark.parametrize('bulk', [False, True])
def test_base_quantity_patch_is_blocked_before_storage_access(environment, bulk):
    service = object.__new__(XmlGenerationService)
    service.settings = SimpleNamespace(environment=environment)
    args = dict(product_family='Synthetic', product_variant='Synthetic',
        scenario_id='base_quantity_edit', scenario_inputs={'new_base_quantity':2})
    with pytest.raises(ValueError, match='ERR-DTX-UDI-031-033.02'):
        if bulk:
            service._prepare_bulk_patch(**args, basic_udi_di='BASIC', record_count=2)
        else:
            service._build_generated_patch_preview(**args, catalogue_number='SYN', patch_version='3')
