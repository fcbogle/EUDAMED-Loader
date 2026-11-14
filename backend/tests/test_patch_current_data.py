"""Acknowledged PATCH synchronisation uses synthetic fixtures and temporary SQLite."""
from copy import deepcopy
from dataclasses import replace
from uuid import uuid4
import json
import sqlite3

from lxml import etree
import pytest

from app.services.patch_current_data import SCENARIOS, capture_current_data, current_value, sync_successful_patch, _write_current
from app.services.xml_generation import XmlGenerationService
from app.services.testing_success_xml import TestingSuccessXmlService as SuccessService
from app.services.workbook_import import WorkbookImportService
from app.xml_models import CriticalWarningXmlItem, StorageConditionXmlItem
from test_device_market_status import playground_device
from test_production_workbook_import import production, acknowledgement


CASES = [
    ('trade_name_edit', 'Changed synthetic trade name'),
    ('base_quantity_edit', 7),
    ('status_code_edit', 'NO_LONGER_PLACED_ON_THE_MARKET'),
    ('warning_add', [{'code': 'CW011', 'comment': None}]),
    ('storage_condition_edit', [{'code': 'SHC006', 'comment': "Manufacturer's accepted lower limit"}]),
]


def read_current(settings, identity):
    with sqlite3.connect(settings.testing_state_db_path) as c:
        c.row_factory = sqlite3.Row
        row = c.execute('SELECT c.* FROM canonical_device_record c JOIN device_subject d ON d.id=c.device_subject_id WHERE d.catalogue_number=?', (identity['catalogue_number'],)).fetchone()
        return dict(row), json.loads(row['record_json'])


def prepare(playground_device, scenario='trade_name_edit', desired='Changed synthetic trade name', *, capture=True):
    settings, identity = playground_device
    service = XmlGenerationService(require_import=True)
    record = service.selector.find_xml_ready_record(**identity)
    base = service._accepted_post_record(service.projection_builder.build_device_record(record))
    resolution = service.testing_state_store.latest_successful_patch_state(**identity)
    base = service.projection_builder.build_patch_record_from_state(base, resolution.state)
    before = service._patch_state_snapshot_payload(base)
    attribute = SCENARIOS[scenario][0]
    rendered_value = desired
    if attribute == 'storage_conditions':
        rendered_value = [StorageConditionXmlItem(**item) for item in desired]
    if attribute == 'critical_warnings':
        rendered_value = [CriticalWarningXmlItem(**item) for item in desired]
    after_record = replace(base, **{attribute: rendered_value}, source_version_marker='3', patch_version_override='3')
    after = service._patch_state_snapshot_payload(after_record)
    correlation, message = str(uuid4()), str(uuid4())
    service.testing_state_store.record_generated_patch_context(**identity, primary_udi_di=base.primary_udi_di,
        basic_udi_di=base.basic_identifier_code, patch_version='3', scenario_id=scenario, scenario_label=scenario,
        base_message_type='PATCH', base_version='2', accepted_state_source='playground_export', changed_fields=[],
        state_before=before, latest_successful_state=after, correlation_id=correlation, message_id=message,
        current_data_before=capture_current_data(record.model_dump(mode='json'), scenario) if capture else None)
    xml = service.renderer.render_message(after_record, correlation_id=correlation, message_id=message).decode()
    ack = acknowledgement(xml, '3', code=base.primary_udi_di)
    return settings, identity, scenario, desired, ack, service


def upload(case):
    return SuccessService().record_success_xml(xml_bytes=case[4], source_file_name='synthetic-success.xml')


@pytest.mark.parametrize('scenario,desired', CASES)
def test_acknowledged_attribute_updates_record_index_and_audit_only(playground_device, scenario, desired):
    case = prepare(playground_device, scenario, desired)
    settings, identity = case[:2]
    with sqlite3.connect(settings.testing_state_db_path) as c:
        sources = c.execute('SELECT id,raw_payload_json FROM source_row ORDER BY id').fetchall()
        index_sources = c.execute('SELECT canonical_device_record_id,canonical_path,source_headers_json FROM canonical_field_value ORDER BY id').fetchall()
    row, before = read_current(settings, identity)
    result = upload(case)
    assert result.current_data_sync[0]['status'] == 'applied'
    updated, after = read_current(settings, identity)
    assert current_value(after, scenario) == desired
    assert updated['canonical_version'] == row['canonical_version'] + 1
    for other in SCENARIOS:
        if other != scenario:
            assert current_value(after, other) == current_value(before, other)
    with sqlite3.connect(settings.testing_state_db_path) as c:
        assert sources == c.execute('SELECT id,raw_payload_json FROM source_row ORDER BY id').fetchall()
        assert index_sources == c.execute('SELECT canonical_device_record_id,canonical_path,source_headers_json FROM canonical_field_value ORDER BY id').fetchall()
        value, note = c.execute('SELECT value_json,review_note FROM canonical_field_value WHERE canonical_device_record_id=? AND canonical_path=?',
            (updated['id'], SCENARIOS[scenario][1])).fetchone()
        field = next(f for f in after['fields'] if f['canonical_path'] == SCENARIOS[scenario][1])
        assert json.loads(value) == field['value']
        assert 'success event' in note
        event = c.execute("SELECT raw_event_json,raw_xml FROM testing_events WHERE status='SUCCESS' ORDER BY id DESC LIMIT 1").fetchone()
        audit = json.loads(event[0])['current_data_sync']
        assert audit['after_value'] == desired and audit['before_field']
        assert event[1]


def test_preview_and_failure_do_not_update_current_data(playground_device):
    case = prepare(playground_device)
    before = read_current(case[0], case[1])
    root = etree.fromstring(case[4])
    root.xpath('//*[local-name()="responseCode"]')[0].text = 'ERROR'
    result = SuccessService().record_success_xml(xml_bytes=etree.tostring(root), source_file_name='synthetic-error.xml')
    assert result.error_entity_count == 1
    assert not result.current_data_sync
    assert read_current(case[0], case[1]) == before


def test_duplicate_success_is_idempotent(playground_device):
    case = prepare(playground_device)
    upload(case)
    before = read_current(case[0], case[1])
    result = upload(case)
    assert result.duplicate_event
    assert result.current_data_sync[0]['status'] == 'already_processed'
    assert read_current(case[0], case[1]) == before


def test_newer_local_edit_is_retained_while_acceptance_is_recorded(playground_device):
    case = prepare(playground_device)
    settings, identity = case[:2]
    row, record = read_current(settings, identity)
    with sqlite3.connect(settings.testing_state_db_path) as c:
        c.row_factory = sqlite3.Row
        _write_current(c, row, record, 'trade_name_edit', 'A newer local edit', 'Synthetic local edit')
    result = upload(case)
    assert result.successful_entity_count == 1
    assert result.current_data_sync[0]['status'] == 'conflict'
    assert 'needs review' in result.summary_message
    assert current_value(read_current(settings, identity)[1], 'trade_name_edit') == 'A newer local edit'
    with sqlite3.connect(settings.testing_state_db_path) as c:
        state = json.loads(c.execute("SELECT latest_successful_state_json FROM testing_subjects WHERE catalogue_number=?", (identity['catalogue_number'],)).fetchone()[0])
        assert state['version'] == '3' and state['trade_name'] == case[3]


def test_legacy_generated_context_can_sync_only_matching_before_values(playground_device):
    case = prepare(playground_device, 'status_code_edit', 'NO_LONGER_PLACED_ON_THE_MARKET', capture=False)
    assert upload(case).current_data_sync[0]['status'] == 'applied'


def test_unrelated_correlations_do_not_write_current_values(playground_device):
    case = prepare(playground_device)
    before = read_current(case[0], case[1])
    root = etree.fromstring(case[4]);root.xpath('//*[local-name()="correlationID"]')[0].text = str(uuid4())
    root.xpath('//*[local-name()="messageID"]')[0].text = str(uuid4())
    SuccessService().record_success_xml(xml_bytes=etree.tostring(root), source_file_name='synthetic-unmatched.xml')
    assert read_current(case[0], case[1]) == before


def test_current_projection_rebuild_retains_acknowledged_and_newer_local_values(playground_device, monkeypatch):
    case = prepare(playground_device)
    settings, identity = case[:2]
    importer = WorkbookImportService()
    source_bundle = importer.canonical_validation_bundle_from_sqlite()
    upload(case)
    monkeypatch.setattr(importer, '_validation_bundle', lambda: source_bundle)
    importer.rebuild_canonical_projection()
    assert current_value(read_current(settings, identity)[1], 'trade_name_edit') == case[3]
    row, record = read_current(settings, identity)
    with sqlite3.connect(settings.testing_state_db_path) as c:
        c.row_factory = sqlite3.Row
        _write_current(c, row, record, 'trade_name_edit', 'New local change after acceptance', 'Synthetic later edit')
    importer.rebuild_canonical_projection()
    assert current_value(read_current(settings, identity)[1], 'trade_name_edit') == 'New local change after acceptance'


def test_sync_failure_rolls_back_both_current_representations_and_keeps_success(playground_device, monkeypatch):
    from app.services import patch_current_data
    case = prepare(playground_device)
    before = read_current(case[0], case[1])
    write = patch_current_data._write_current
    def fail_after_write(*args):
        write(*args)
        raise ValueError('Synthetic projection failure')
    monkeypatch.setattr(patch_current_data, '_write_current', fail_after_write)
    result = upload(case)
    assert result.successful_entity_count == 1
    assert result.current_data_sync[0]['status'] == 'conflict'
    assert read_current(case[0], case[1]) == before


def test_older_response_never_rolls_current_values_back(playground_device):
    case = prepare(playground_device)
    settings, identity = case[:2]
    # A newer accepted export has already established a version floor.
    with sqlite3.connect(settings.testing_state_db_path) as c:
        state = json.loads(c.execute("SELECT latest_successful_state_json FROM testing_subjects WHERE catalogue_number=?", (identity['catalogue_number'],)).fetchone()[0])
        state['version'] = '4'
        c.execute("UPDATE testing_subjects SET latest_successful_version='4',latest_successful_state_json=? WHERE catalogue_number=?", (json.dumps(state), identity['catalogue_number']))
    before = read_current(settings, identity)
    result = upload(case)
    assert result.current_data_sync[0]['status'] == 'historical'
    assert read_current(settings, identity) == before


def test_off_market_comparison_retains_country_evidence_but_treats_it_as_not_applicable(playground_device):
    from app.services.current_device_comparison import current_device_values
    case = prepare(playground_device, 'status_code_edit', 'NO_LONGER_PLACED_ON_THE_MARKET')
    original = read_current(case[0], case[1])[1]
    assert original['market_availability_items']
    upload(case)
    record = read_current(case[0], case[1])[1]
    assert record['market_availability_items'] == original['market_availability_items']
    device, market, issues = current_device_values(record)
    assert device['device_record']['status_code'] == 'NO_LONGER_PLACED_ON_THE_MARKET'
    assert market == {'market_countries': []}
    assert not any('market countries' in issue for issue in issues)


def test_already_matching_current_value_is_recorded_without_rewriting_projection(playground_device):
    settings, identity = playground_device
    desired = current_value(read_current(settings, identity)[1], 'trade_name_edit')
    case = prepare(playground_device, 'trade_name_edit', desired)
    before = read_current(settings, identity)
    assert upload(case).current_data_sync[0]['status'] == 'already_current'
    assert read_current(settings, identity) == before


def test_inconsistent_device_identity_blocks_write_but_retains_success(playground_device):
    case = prepare(playground_device)
    settings, identity = case[:2]
    row, record = read_current(settings, identity)
    record['primary_udi_di'] = 'DIFFERENT-SYNTHETIC-DEVICE'
    with sqlite3.connect(settings.testing_state_db_path) as c:
        c.execute('UPDATE canonical_device_record SET record_json=? WHERE id=?', (json.dumps(record), row['id']))
    before = read_current(settings, identity)
    result = upload(case)
    assert result.successful_entity_count == 1
    assert result.current_data_sync[0]['status'] == 'conflict'
    assert 'identities do not match' in result.current_data_sync[0]['reason']
    assert read_current(settings, identity) == before
