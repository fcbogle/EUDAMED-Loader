"""Export-backed comparisons use synthetic XML and temporary SQLite only."""
from copy import deepcopy
import json
import sqlite3

from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.testclient import TestClient
from lxml import etree
from openpyxl import load_workbook
import pytest

from app.config import get_settings
from app.routers import dev_input_batches as routes
from app.services.dev_input_batches import fingerprint
from app.services.playground_reconciliation import PlaygroundReconciliation, write_workbook
from app.services.production_workbook_adapter import accepted_snapshot
from app.services.production_workbook_preparation import NS, _exports
from app.services.xml_projection import DeviceXmlProjectionBuilder
from app.services.xml_rendering import EudamedMessageRenderer
from scripts.benchmark_xml import synthetic_record
from test_dev_input_batches import project, create
from test_production_workbook_preparation import child


@pytest.fixture
def reconciliation(project, monkeypatch):
    settings = get_settings().model_copy(update={"environment": "dev", "dev_input_batch_root": project / "data/dev/import-batches",
        "eudamed_message_schema_version": "3.0.32", "eudamed_manufacturer_srn_override": "GB-MF-000000001",
        "eudamed_suppress_authorised_representative": True, "testing_state_db_path": project / "dev.sqlite3"})
    rendered = etree.fromstring(EudamedMessageRenderer(settings).render_message(DeviceXmlProjectionBuilder().build_device_record(synthetic_record(0))))
    device = rendered.find('message:payload/device:Device', NS)
    device.find('device:MDRBasicUDI/basic:MFActorCode', NS).text = settings.eudamed_manufacturer_srn_override
    for node in (device.find('device:MDRBasicUDI', NS), device.find('device:MDRUDIDIData', NS), device.find('device:MDRUDIDIData/udi:marketInfos', NS)):
        for name, value in (("state", "REGISTERED"), ("version", "2"), ("versionDate", "2026-10-24T10:00:00Z")):
            existing = node.find('entity:' + name, NS)
            if existing is None: child(node, 'entity', name, value)
            else: existing.text = value
    root = etree.Element('{' + NS['message'] + '}PullResponse', nsmap=rendered.nsmap, version='3.0.32')
    child(root, 'message', 'creationDateTime', '2026-10-25T10:00:00Z')
    child(root, 'message', 'payload').append(device)
    for name, value in (("pageNumber", "0"), ("numberOfPages", "1"), ("pageSize", "50")):
        child(root, 'message', name, value)
    (project / 'data/downloads/export.xml').write_bytes(etree.tostring(root, encoding='utf-8', xml_declaration=True))
    batch = create(project)
    entry = _exports(batch / 'eudamed-xml', {})[0][0]
    snapshot = jsonable_encoder(accepted_snapshot(entry, settings))
    with sqlite3.connect(settings.testing_state_db_path) as connection:
        connection.executescript('''
        CREATE TABLE device_subject(id INTEGER PRIMARY KEY,primary_udi_di TEXT,basic_udi_di TEXT);
        CREATE TABLE canonical_device_record(id INTEGER PRIMARY KEY,device_subject_id INTEGER,canonical_version INTEGER,record_json TEXT);
        CREATE TABLE reviewed_post_baselines(id INTEGER PRIMARY KEY);
        CREATE TABLE testing_subjects(id INTEGER PRIMARY KEY,device_subject_id INTEGER,primary_udi_di TEXT,
          latest_successful_post_state_json TEXT,latest_successful_patch_state_json TEXT,latest_successful_state_json TEXT,
          latest_successful_market_info_state_json TEXT,latest_successful_version TEXT,latest_successful_post_version TEXT,
          latest_successful_patch_version TEXT,latest_successful_market_info_version TEXT,latest_observed_market_info_version TEXT);
        CREATE TABLE testing_events(id INTEGER PRIMARY KEY,subject_id INTEGER,message_type TEXT,status TEXT,version TEXT,tested_at TEXT,
          state_after_json TEXT,event_kind TEXT,accepted_state_source TEXT,event_index INTEGER,correlation_id TEXT,message_id TEXT);
        ''')
        connection.execute('INSERT INTO device_subject VALUES(1,?,?)', (entry['key'][1], entry['parent'][1]))
        canonical = {'fields': [{'canonical_path': 'manufacturer.issuing_entity', 'value': entry['key'][0]},
                                {'canonical_path': 'device_record.primary_udi_di', 'value': entry['key'][1]}]}
        connection.execute('INSERT INTO canonical_device_record VALUES(1,1,1,?)', (json.dumps(canonical),))
        connection.execute('''INSERT INTO testing_subjects(id,device_subject_id,primary_udi_di,latest_successful_post_state_json,
          latest_successful_state_json,latest_successful_market_info_state_json,latest_successful_version,latest_successful_post_version,latest_successful_market_info_version)
          VALUES(1,1,?,?,?,?, '2','2','2')''', (entry['key'][1], json.dumps(snapshot), json.dumps(snapshot), json.dumps({'version': '2', 'market_countries': snapshot['market_countries']})))
        connection.execute("INSERT INTO testing_events(id,subject_id,message_type,status,version,tested_at) VALUES(1,1,'UDI_DI.POST','SUCCESS','2','2026-10-24T10:00:00Z')")
    monkeypatch.setattr(routes, 'get_settings', lambda: settings)
    app = FastAPI(); app.include_router(routes.router, prefix='/api')
    return PlaygroundReconciliation(settings), batch, snapshot, TestClient(app)


def update(service, **fields):
    with sqlite3.connect(service.settings.testing_state_db_path) as connection:
        connection.execute('UPDATE testing_subjects SET ' + ','.join(key + '=?' for key in fields) + ' WHERE id=1', list(fields.values()))


def test_matches_and_literal_excel_audit_without_database_changes(reconciliation):
    service, batch, _, client = reconciliation
    before = fingerprint(service.settings.testing_state_db_path)
    response = client.post(f'/api/dev-input-batches/{batch.name}/baseline-assessment')
    assert response.status_code == 200, response.text
    report = response.json()
    assert report['summary']['outcomes'] == {'Matches': 1}
    assert report['database_changed'] is False and report['apply_available'] is False
    assert 'proposed_snapshot' not in report['records'][0]
    prefix = f'/api/dev-input-batches/{batch.name}/baseline-assessment/{report["report_id"]}'
    assert client.get(prefix + '/xlsx').content.startswith(b'PK')
    assert client.get(prefix + '/json').json()['records'][0]['proposed_snapshot']['version'] == '2'
    assert fingerprint(service.settings.testing_state_db_path) == before
    report['records'][0]['catalogue'] = '=HYPERLINK("https://example.com")'
    output = batch / 'literal-test.xlsx'; write_workbook(report, output)
    book = load_workbook(output)
    assert book['Device Review']['C2'].data_type == 's'
    assert book['Device Review']['B2'].data_type == 's'  # Leading zeros/UDI identities remain strings.
    book.close()


def test_unknown_fields_are_separate_from_real_differences_and_templates(reconciliation):
    service, batch, snapshot, _ = reconciliation
    partial = {'version': '2', 'trade_name': 'Previously accepted name'}
    update(service, latest_successful_state_json=json.dumps(partial), latest_successful_post_state_json=None)
    record = service.assess(batch.name)['records'][0]
    fields = {row['field']: row for row in record['fields']}
    assert record['local_snapshot'] == 'Partial'
    assert fields['trade_name']['comparison'] == 'Difference found'
    assert fields['sterile']['comparison'] == 'Missing local evidence'
    assert fields['market_countries']['comparison'] == 'Matches'
    assert not {'post_payload_mode', 'service_id_override', 'patch_version_override'} & fields.keys()
    assert fields['trade_name']['exported'] == snapshot['trade_name']


def test_legacy_version_is_not_automatically_downgraded_or_fabricated(reconciliation):
    service, batch, _, _ = reconciliation
    update(service, latest_successful_version='3', latest_successful_post_version=None)
    with sqlite3.connect(service.settings.testing_state_db_path) as connection:
        connection.execute('DELETE FROM testing_events')
    record = service.assess(batch.name)['records'][0]
    assert record['outcome'] == 'Review required'
    assert record['legacy_version_observation'] == '3'
    assert record['fields'][0]['comparison'] == 'Missing local evidence'
    assert record['local_snapshot'] == 'Missing'


def test_newer_success_and_proven_higher_version_require_review(reconciliation):
    service, batch, _, _ = reconciliation
    update(service, latest_successful_post_version='3')
    with sqlite3.connect(service.settings.testing_state_db_path) as connection:
        connection.execute("UPDATE testing_events SET tested_at='2026-10-26T10:00:00Z'")
    record = service.assess(batch.name)['records'][0]
    assert record['outcome'] == 'Review required'
    assert any('newer than' in warning for warning in record['warnings'])
    assert any('no automatic downgrade' in warning for warning in record['warnings'])


def test_unlinked_subject_requires_explicit_review_and_export_absence_does_not_delete(reconciliation):
    service, batch, _, _ = reconciliation
    update(service, device_subject_id=None)
    with sqlite3.connect(service.settings.testing_state_db_path) as connection:
        connection.execute("INSERT INTO device_subject VALUES(2,'NOT-IN-EXPORT','OTHER-PARENT')")
    report = service.assess(batch.name)
    assert report['summary']['devices'] == 1
    assert report['records'][0]['testing_subject_id'] == 1
    assert report['records'][0]['outcome'] == 'Review required'
    assert any('relational link needs review' in warning for warning in report['records'][0]['warnings'])


def test_dev_only_missing_database_changed_input_and_report_hash_guards(reconciliation, monkeypatch):
    service, batch, _, client = reconciliation
    prod = service.settings.model_copy(update={'environment': 'prod'})
    with pytest.raises(PermissionError): PlaygroundReconciliation(prod)
    monkeypatch.setattr(routes, 'get_settings', lambda: prod)
    assert client.post(f'/api/dev-input-batches/{batch.name}/baseline-assessment').status_code == 403
    absent = service.settings.testing_state_db_path.parent / 'absent.sqlite3'
    with pytest.raises(ValueError, match='never creates'):
        PlaygroundReconciliation(service.settings.model_copy(update={'testing_state_db_path': absent})).assess(batch.name)
    assert not absent.exists()
    report = service.create_report(batch.name)
    path = service.artifact(batch.name, report['report_id'], 'json'); path.write_text('tampered')
    with pytest.raises(ValueError, match='fingerprint'): service.artifact(batch.name, report['report_id'], 'json')
    (batch / 'eudamed-xml/export.xml').write_text('tampered')
    with pytest.raises(ValueError, match='manifest'): service.assess(batch.name)


def test_duplicate_export_identity_is_blocked_even_across_valid_pages(reconciliation):
    service, batch, _, _ = reconciliation
    path = batch / 'eudamed-xml/export.xml'
    tree = etree.parse(str(path))
    payload = tree.find('message:payload', NS)
    payload.append(deepcopy(payload[0]))
    tree.write(str(path), encoding='utf-8', xml_declaration=True)
    manifest_path = batch / 'manifest.json'; manifest = json.loads(manifest_path.read_text())
    for entry in manifest['files']:
        if entry['path'] == 'eudamed-xml/export.xml':
            entry.update(sha256=fingerprint(path), size_bytes=path.stat().st_size)
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match='Duplicate exported device identity'): service.assess(batch.name)


def test_unreadable_database_fails_without_initializing_or_repairing_it(reconciliation):
    service, batch, _, client = reconciliation
    path = service.settings.testing_state_db_path
    path.write_bytes(b'not a SQLite database')
    before = path.read_bytes()
    response = client.post(f'/api/dev-input-batches/{batch.name}/baseline-assessment')
    assert response.status_code == 409
    assert 'cannot be read' in response.json()['detail']
    assert path.read_bytes() == before
    assert not (batch / 'reconciliation').exists()
