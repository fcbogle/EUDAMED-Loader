from __future__ import annotations

import hashlib
from io import BytesIO
import json
import sqlite3
from zipfile import ZipFile

from lxml import etree
import pytest

from app.config import get_settings
from scripts.benchmark_xml import make_service, operation


@pytest.fixture
def factory(tmp_path, monkeypatch):
    monkeypatch.setenv('EUDAMED_TESTING_STATE_DB_PATH', str(tmp_path / 'testing.sqlite3'))
    monkeypatch.setenv('EUDAMED_TESTING_STATE_BACKUP_DIR', str(tmp_path / 'backups'))
    get_settings.cache_clear()
    yield lambda flow, count=3: make_service(tmp_path, flow, count, population=12)
    get_settings.cache_clear()


def audit_counts(service):
    with service.testing_state_store._connect() as connection:
        return tuple(connection.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
                     for table in ('testing_events', 'testing_batches', 'testing_batch_devices', 'generated_packages', 'reviewed_post_baselines'))


@pytest.mark.parametrize('flow', ['single_post', 'basic_post', 'udidi_post', 'patch'])
def test_request_prepares_once_and_audits_exact_validated_archive(factory, monkeypatch, flow):
    service, records = factory(flow, 1 if flow == 'single_post' else 3)
    count = len(records)
    loads = []
    loader = service.canonical_projection_service.latest_bundle
    def load(**kwargs):
        loads.append(True)
        return loader(**kwargs)
    monkeypatch.setattr(service.canonical_projection_service, 'latest_bundle', load)
    monkeypatch.setattr(service.selector.projection_service, 'latest_bundle', load)
    validated = []
    validate = service.xml_validation_service.validate_message
    def capture(xml):
        result = validate(xml)
        assert result.valid, result.errors
        validated.append(xml)
        return result
    monkeypatch.setattr(service.xml_validation_service, 'validate_message', capture)
    before = audit_counts(service)
    operation(service, flow, 'preview', count)
    assert len(loads) == 1
    assert audit_counts(service) == before
    validated.clear()
    _, archive = operation(service, flow, 'zip', count)
    assert len(loads) == 2  # No cross-request cache, even when reusing the service.
    with ZipFile(BytesIO(archive)) as package:
        manifest = json.loads(package.read('manifest.json'))
        members = [package.read(name) for name in package.namelist() if name.endswith('.xml')]
        assert all(member in validated for member in members)
        if flow != 'single_post':
            assert manifest['included_record_count'] == count
            assert {row['catalogue_number'] for row in manifest['records']} == {r.catalogue_number for r in records}
        root = etree.fromstring(members[0])
        ns = {'m': 'https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Message/v1'}
        correlation = root.findtext('m:correlationID', namespaces=ns)
        message = root.findtext('m:messageID', namespaces=ns)
    with service.testing_state_store._connect() as connection:
        events = connection.execute("SELECT correlation_id, message_id FROM testing_events WHERE status='GENERATED'").fetchall()
        assert [tuple(row) for row in events] == [(correlation, message)] * count
        receipt = connection.execute('SELECT package_sha256, review_basis FROM generated_packages').fetchone()
        assert tuple(receipt) == (hashlib.sha256(archive).hexdigest(), 'zip_download')
    # POST validates one final envelope. PATCH retains two per-device validations plus the batch.
    assert len(validated) == (2 * count + 1 if flow == 'patch' else 1)


@pytest.mark.parametrize('flow', ['single_post', 'basic_post', 'udidi_post', 'patch'])
@pytest.mark.parametrize('failure', ['archive', 'context', 'receipt'])
def test_failed_download_rolls_back_all_generation_history(factory, monkeypatch, flow, failure):
    service, records = factory(flow, 1 if flow == 'single_post' else 3)
    before = audit_counts(service)
    def fail(*args, **kwargs):
        raise OSError('Synthetic persistence/package failure')
    if failure == 'archive':
        monkeypatch.setattr(service.package_builder, 'build_archive', fail)
    elif failure == 'receipt':
        monkeypatch.setattr(service.testing_state_store, 'record_generated_package', fail)
    else:
        name = 'record_generated_patch_context' if flow == 'patch' else 'record_generated_post_context'
        original = getattr(service.testing_state_store, name)
        def write_then_fail(**kwargs):
            original(**kwargs)
            fail()
        monkeypatch.setattr(service.testing_state_store, name, write_then_fail)
    with pytest.raises(OSError, match='Synthetic'):
        operation(service, flow, 'zip', len(records))
    assert audit_counts(service) == before
    assert service.selector._request.get() is None
    assert service.testing_state_store._generation.get() is None


def test_download_uses_one_commit_for_all_devices_and_receipt(factory, monkeypatch):
    service, records = factory('patch')
    statements = []
    connect = sqlite3.connect
    def traced(*args, **kwargs):
        connection = connect(*args, **kwargs)
        connection.set_trace_callback(statements.append)
        return connection
    monkeypatch.setattr(sqlite3, 'connect', traced)
    operation(service, 'patch', 'zip', len(records))
    assert statements.count('BEGIN') == 1
    assert statements.count('COMMIT') == 1
    assert sum('SELECT * FROM testing_subjects WHERE' in sql for sql in statements) == 1


def test_acceptance_change_during_preparation_cannot_commit_stale_package(factory, monkeypatch):
    service, records = factory('patch')
    with sqlite3.connect(service.testing_state_store.db_path) as connection:
        connection.execute('PRAGMA journal_mode=WAL')
    before = audit_counts(service)
    render = service.renderer.render_batch_from_strings
    def concurrent_acceptance(*args, **kwargs):
        with sqlite3.connect(service.testing_state_store.db_path) as connection:
            connection.execute("UPDATE testing_subjects SET latest_successful_version='4', latest_successful_patch_version='4'")
        return render(*args, **kwargs)
    monkeypatch.setattr(service.renderer, 'render_batch_from_strings', concurrent_acceptance)
    with pytest.raises(ValueError, match='Refresh and retry'):
        operation(service, 'patch', 'zip', len(records))
    assert audit_counts(service) == before


def test_next_request_reloads_source_and_registration_state(factory):
    service, records = factory('udidi_post')
    first = operation(service, 'udidi_post', 'preview', len(records))
    with service.testing_state_store._connect() as connection:
        payload = json.loads(connection.execute('SELECT payload FROM benchmark_bundle').fetchone()[0])
        for field in payload['records'][1]['fields']:
            if field['canonical_path'] == 'device_record.trade_name':
                field['value'] = 'Changed between requests'
        connection.execute('UPDATE benchmark_bundle SET payload=?', (json.dumps(payload),))
        record = records[0]
        subject = service.testing_state_store._ensure_testing_subject(
            connection, product_family=record.product_family, product_variant=record.product_variant,
            catalogue_number=record.catalogue_number, primary_udi_di=record.primary_udi_di, basic_udi_di='BASICSHARED')
        connection.execute("INSERT INTO testing_events(subject_id,event_index,message_type,status,event_kind,version,raw_event_json) VALUES (?,0,'UDI_DI.POST','SUCCESS','success_ack','1','{}')", (subject,))
    second = operation(service, 'udidi_post', 'preview', len(records))
    assert first.included_record_count == 3
    assert second.included_record_count == 2
    assert records[0].catalogue_number not in {row.catalogue_number for row in second.included_records}
    assert 'Changed between requests' in second.selected_chunk_xml
    assert 'Changed between requests' not in first.selected_chunk_xml


def test_bulk_patch_keeps_individual_versions_countries_and_exclusions(factory):
    service, records = factory('patch')
    with service.testing_state_store._connect() as connection:
        for index, version in enumerate(('2', '4', '7')):
            state = json.dumps({'version': version, 'trade_name': f'Accepted name {index}', 'base_quantity': 1})
            country = 'IE' if index == 0 else 'FR'
            market = json.dumps({'version': '3', 'market_countries': [{'country': country, 'original_placed_on_market': True}]})
            connection.execute('''UPDATE testing_subjects SET latest_successful_version=?, latest_successful_patch_version=?,
                latest_successful_patch_state_json=?, latest_successful_market_info_version='3', latest_successful_market_info_state_json=?
                WHERE catalogue_number=?''', (version, version, state, market, records[index].catalogue_number))
        # The third child's newer acceptance has no matching snapshot and must stay excluded.
        connection.execute("UPDATE testing_subjects SET latest_successful_version='8', latest_successful_patch_version='8' WHERE catalogue_number=?", (records[2].catalogue_number,))
    _, archive = operation(service, 'patch', 'zip', len(records))
    with ZipFile(BytesIO(archive)) as package:
        manifest = json.loads(package.read('manifest.json'))
        assert [row['derived_version'] for row in manifest['records']] == ['3', '5']
        assert manifest['excluded_records'][0]['catalogue_number'] == records[2].catalogue_number
        assert manifest['excluded_records'][0]['reason_code'] == 'accepted_baseline_unavailable'
        root = etree.fromstring(package.read(manifest['chunks'][0]['file_name']))
        devices = root.xpath('//*[local-name()="UDIDIData"]')
        assert [device.xpath('./*[local-name()="version"]/text()')[0] for device in devices] == ['3', '5']
        assert [device.xpath('.//*[local-name()="country"]/text()')[0] for device in devices] == ['IE', 'FR']
        assert b'Accepted name 0' in etree.tostring(devices[0])
        assert b'Accepted name 1' in etree.tostring(devices[1])
    with service.testing_state_store._connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM testing_events WHERE status='GENERATED'").fetchone()[0] == 2


def test_chunk_validation_failure_creates_no_generation_history(factory, monkeypatch):
    service, records = factory('patch')
    before = audit_counts(service)
    original = service.xml_validation_service.validate_message
    calls = 0
    def fail_batch(xml):
        nonlocal calls
        calls += 1
        if calls == 2 * len(records) + 1:
            raise RuntimeError('Synthetic final validation failure')
        return original(xml)
    monkeypatch.setattr(service.xml_validation_service, 'validate_message', fail_batch)
    with pytest.raises(RuntimeError, match='final validation'):
        operation(service, 'patch', 'zip', len(records))
    assert audit_counts(service) == before


@pytest.mark.parametrize('flow,preview_path,download_path', [
    ('single_post', 'preview-next-post-registration', 'download-post-package'),
    ('basic_post', 'preview-bulk-post', 'download-bulk-post'),
    ('udidi_post', 'preview-bulk-udidi-post', 'download-bulk-udidi-post'),
    ('patch', 'preview-bulk-patch', 'download-bulk-patch'),
])
def test_http_preview_and_download_keep_existing_response_contract(factory, monkeypatch, flow, preview_path, download_path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.routers import xml_generation as router_module

    service, records = factory(flow, 1 if flow == 'single_post' else 3)
    monkeypatch.setattr(router_module, '_xml_service', lambda: service)
    app = FastAPI()
    app.include_router(router_module.router, prefix='/api')
    payload = dict(product_family='Synthetic', product_variant='Synthetic', record_count=len(records))
    if flow == 'single_post':
        payload.pop('record_count')
        payload['catalogue_number'] = records[0].catalogue_number
    if flow == 'patch':
        payload.update(basic_udi_di='BASICSHARED', scenario_id='base_quantity_edit', scenario_inputs={'new_base_quantity': 2})
    with TestClient(app) as client:
        response = client.post(f'/api/xml/{preview_path}', json=payload)
        assert response.status_code == 200, response.text
        result = response.json()
        assert result['post_validation' if flow == 'single_post' else 'selected_chunk_validation']['valid']
        response = client.post(f'/api/xml/{download_path}', json=payload)
        assert response.status_code == 200, response.text
        assert response.headers['content-type'] == 'application/zip'
        assert '.zip' in response.headers['content-disposition']
        with ZipFile(BytesIO(response.content)) as archive:
            assert 'manifest.json' in archive.namelist()


@pytest.mark.parametrize('count', [1, 3])
def test_bulk_candidates_include_device_post_seed_in_selection_and_patch_archive(factory, count):
    from app.services.operation_assessment import OperationAssessmentService
    from app.services.testing_read_model import TestingReadModelService

    service, records = factory('patch', count)
    seed = records[0].catalogue_number
    with service.testing_state_store._connect() as connection:
        connection.execute("""UPDATE testing_events SET message_type='DEVICE.POST'
            WHERE subject_id=(SELECT id FROM testing_subjects WHERE catalogue_number=?)""", (seed,))
    scope = dict(product_family='Synthetic', product_variant='Synthetic', basic_udi_di='BASICSHARED')
    expected = {record.catalogue_number for record in records}
    groups = service.testing_state_store.posted_parent_groups(
        product_family='Synthetic', product_variant='Synthetic')
    assert groups == [dict(basic_udi_di='BASICSHARED', posted_child_count=count,
                           sample_catalogue_numbers=[record.catalogue_number for record in records])]
    assert {row['catalogue_number'] for row in service.testing_state_store.posted_entries(**scope)} == expected
    entries = TestingReadModelService().bulk_patch_posted_entries(**scope)
    assert {row['catalogue_number'] for row in entries} == expected
    assert all(row['current_state']['version'] == '1' for row in entries)
    assessment = OperationAssessmentService()
    assessment.xml_service = service
    assessment.testing_state_store = service.testing_state_store
    assert assessment.assess_bulk_patch(**scope).eligible_record_count == count
    assert assessment.assess_bulk_market_info(**scope).eligible_record_count == count
    preview = operation(service, 'patch', 'preview', count)
    assert {row.catalogue_number for row in preview.included_records} == expected
    _, archive = operation(service, 'patch', 'zip', count)
    with ZipFile(BytesIO(archive)) as package:
        manifest = json.loads(package.read('manifest.json'))
        assert {row['catalogue_number'] for row in manifest['records']} == expected
        assert all(row['derived_version'] == '2' for row in manifest['records'])


@pytest.mark.parametrize('message_type,status', [
    ('DEVICE.POST', 'GENERATED'), ('DEVICE.POST', 'ERROR'), ('BASIC_UDI.POST', 'SUCCESS'),
])
def test_bulk_candidates_still_require_successful_device_registration(factory, message_type, status):
    from app.services.testing_read_model import TestingReadModelService

    service, _ = factory('patch', 1)
    with service.testing_state_store._connect() as connection:
        # Even a legacy post_success flag cannot substitute for device success evidence.
        connection.execute('UPDATE testing_events SET message_type=?, status=?', (message_type, status))
    scope = dict(product_family='Synthetic', product_variant='Synthetic', basic_udi_di='BASICSHARED')
    assert service.testing_state_store.posted_entries(**scope) == []
    assert service.testing_state_store.posted_parent_groups(
        product_family='Synthetic', product_variant='Synthetic') == []
    assert TestingReadModelService().bulk_patch_posted_entries(**scope) == []
