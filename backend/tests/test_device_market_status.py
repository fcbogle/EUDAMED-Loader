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


def test_production_generation_is_blocked_before_database_or_baseline_access():
    service = object.__new__(XmlGenerationService)
    service.settings = SimpleNamespace(environment='prod')
    with pytest.raises(ValueError, match='awaits Playground verification'):
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
