"""Atomic Dev baseline imports use synthetic exports and temporary SQLite only."""
from contextlib import closing
import json
import sqlite3
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services.accepted_state import accepted_device_state, accepted_market_state, accepted_post_state
from app.services.playground_baseline_import import PlaygroundBaselineImporter
from app.services.dev_input_batches import fingerprint
from test_playground_reconciliation import reconciliation
from test_dev_input_batches import project


@pytest.fixture
def importer(reconciliation):
    assessor, batch, snapshot, _ = reconciliation
    database = batch.parents[2] / 'testing/testing-state.sqlite3'
    database.parent.mkdir()
    assessor.settings.testing_state_db_path.rename(database)
    settings = assessor.settings.model_copy(update={'testing_state_db_path': database})
    with sqlite3.connect(database) as connection:
        for table, columns in {
            'testing_subjects': ['product_family TEXT', 'product_variant TEXT', 'catalogue_number TEXT', 'basic_udi_di TEXT',
                'registration_status TEXT', 'latest_successful_event_id INTEGER', 'latest_successful_message_type TEXT',
                'latest_tested_at TEXT', 'post_success INTEGER DEFAULT 1', 'baseline_patch_success INTEGER DEFAULT 0'],
            'testing_events': ['source_file_name TEXT','state_before_json TEXT','product_family TEXT','product_variant TEXT',
                'catalogue_number TEXT','primary_udi_di TEXT','basic_udi_di TEXT','raw_event_json TEXT'],
        }.items():
            for column in columns: connection.execute(f'ALTER TABLE {table} ADD COLUMN {column}')
        connection.execute("UPDATE testing_subjects SET product_family='Synthetic',product_variant='Synthetic model',catalogue_number=?,basic_udi_di=?",
                           (snapshot['device_record']['catalogue_number'],snapshot['device_record']['basic_identifier_code']))
    return PlaygroundBaselineImporter(settings), batch, snapshot


def apply(importer):
    service, batch, _ = importer
    proposal = service.prepare(batch.name)
    return service.apply(batch.name, expected_digest=proposal['database_snapshot_sha256'], approved_by='Synthetic owner approval')


def subject(connection):
    return connection.execute('SELECT * FROM testing_subjects WHERE id=1').fetchone()


def test_alignment_backup_history_preservation_and_idempotency(importer):
    service, batch, exported = importer
    old = {**exported, 'base_quantity': 9, 'trade_name': 'Old accepted name'}
    with sqlite3.connect(service.database) as connection:
        connection.execute('UPDATE testing_subjects SET latest_successful_state_json=?,latest_successful_patch_state_json=?,latest_successful_patch_version=?', (json.dumps(old),json.dumps(old),'2'))
        history = connection.execute('SELECT * FROM testing_events').fetchall()
    result = apply(importer)
    assert result['devices'] == 1 and Path(result['backup']['path']).is_file()
    with closing(sqlite3.connect(service.database)) as connection:
        connection.row_factory=sqlite3.Row
        row=subject(connection)
        assert accepted_device_state(connection,row)['base_quantity'] == exported['base_quantity']
        assert accepted_post_state(connection,row)['trade_name'] == exported['trade_name']
        assert accepted_market_state(connection,row)['market_countries'] == exported['market_countries']
        assert json.loads(row['latest_successful_patch_state_json'])['base_quantity'] == 9
        assert [tuple(r) for r in connection.execute("SELECT * FROM testing_events WHERE status='SUCCESS'")] == history
        assert connection.execute('SELECT count(*) FROM reviewed_post_baselines').fetchone()[0] == 0
        event=connection.execute("SELECT * FROM testing_events WHERE status='IMPORTED'").fetchone()
        assert event['message_type']=='PLAYGROUND_EXPORT.SNAPSHOT'
        assert json.loads(event['state_before_json'])['latest_successful_patch_version']=='2'
    with sqlite3.connect(Path(result['backup']['path']).as_uri()+'?mode=ro',uri=True) as connection:
        assert connection.execute("SELECT count(*) FROM testing_events WHERE status='IMPORTED'").fetchone()[0] == 0
    before=fingerprint(service.database)
    assert apply(importer)['already_applied']
    assert fingerprint(service.database)==before
    report=service.assessor.assess(batch.name)
    assert report['summary']['outcomes']=={'Matches':1}


def test_legacy_generic_version_and_unique_unlinked_subject_are_audited(importer):
    service, batch, _ = importer
    with sqlite3.connect(service.database) as connection:
        connection.execute('DELETE FROM testing_events')
        connection.execute("UPDATE testing_subjects SET device_subject_id=NULL,latest_successful_version='3',latest_successful_post_version=NULL")
    apply(importer)
    with closing(sqlite3.connect(service.database)) as connection:
        connection.row_factory=sqlite3.Row
        assert subject(connection)['device_subject_id']==1
        assert subject(connection)['latest_successful_version']=='2'
        before=json.loads(connection.execute("SELECT state_before_json FROM testing_events WHERE status='IMPORTED'").fetchone()[0])
        assert before['latest_successful_version']=='3' and before['device_subject_id'] is None


def test_rollback_does_not_leave_half_applied_state(importer, monkeypatch):
    service,batch,_=importer
    original=service._record
    def interrupted(*args):
        original(*args)
        raise RuntimeError('Synthetic interruption after first write')
    monkeypatch.setattr(service,'_record',interrupted)
    before=fingerprint(service.database)
    with pytest.raises(RuntimeError,match='Synthetic interruption'): apply(importer)
    assert fingerprint(service.database)==before
    assert len(list(service.backups.glob('*.sqlite3')))==1


def test_stale_report_later_success_and_invalid_database_targets_block(importer):
    service,batch,_=importer
    proposal=service.prepare(batch.name)
    with sqlite3.connect(service.database) as connection:
        connection.execute("UPDATE testing_subjects SET latest_successful_message_type='changed'")
    with pytest.raises(ValueError,match='Assessment changed'):
        service.apply(batch.name,expected_digest=proposal['database_snapshot_sha256'],approved_by='Owner')
    with sqlite3.connect(service.database) as connection:
        connection.execute("UPDATE testing_events SET tested_at='2026-10-26T10:00:00Z'")
    with pytest.raises(ValueError,match='newer than'): service.prepare(batch.name)
    with pytest.raises(PermissionError): PlaygroundBaselineImporter(service.settings.model_copy(update={'environment':'prod'}))
    with pytest.raises(PermissionError): PlaygroundBaselineImporter(service.settings.model_copy(update={'testing_state_db_path':service.database.parent/'other.sqlite3'}))


def test_future_acknowledgements_supersede_baseline_without_losing_unchanged_fields(importer):
    service,batch,exported=importer
    apply(importer)
    from app.services.testing_success_xml import TestingSuccessXmlService, AcknowledgementPayload
    from app.services.testing_state_store import TestingStateStore
    handler=TestingSuccessXmlService.__new__(TestingSuccessXmlService)
    handler.store=SimpleNamespace(_optional_string=TestingStateStore._optional_string)
    def ack(version,kind='UDI_DI.PATCH'):
        return AcknowledgementPayload(kind,'Device UDI-DI PATCH',exported['device_record']['primary_udi_di'],version,
            '2026-10-26T10:00:00Z','next-context','ack-id','SUCCESS',(), 'synthetic-ack.xml','')
    with closing(sqlite3.connect(service.database)) as connection:
        connection.row_factory=sqlite3.Row
        # Equal-version historical acknowledgement cannot replace exported values.
        handler._reconcile_subject_success_state(connection,1,ack('2'),event_id=90)
        assert accepted_device_state(connection,subject(connection))['accepted_state_source']=='playground_export'
        connection.execute("INSERT INTO testing_events(id,subject_id,event_index,message_type,status,version,correlation_id,state_after_json) VALUES(3,1,3,'UDI_DI.PATCH','GENERATED','3','next-context',?)",
                           (json.dumps({'version':'3','trade_name':'New tested name','base_quantity':3}),))
        handler._reconcile_subject_success_state(connection,1,ack('3'),event_id=91)
        current=accepted_device_state(connection,subject(connection))
        assert current['version']=='3' and current['trade_name']=='New tested name'
        assert current['device_record']['base_quantity']==3
        assert current['device_record']['risk_class']==exported['device_record']['risk_class']
        assert current['accepted_state_source']=='sqlite_latest_successful_patch'
        # Later uncorrelated success has no matching field snapshot: block generation.
        handler._reconcile_subject_success_state(connection,1,ack('4'),event_id=92)
        assert accepted_device_state(connection,subject(connection)) is None


def test_failed_backup_prevents_any_operational_update(importer,monkeypatch):
    service,_,_=importer
    before=fingerprint(service.database)
    def failed_backup(_): raise ValueError('Synthetic backup verification failure')
    monkeypatch.setattr(service,'_backup',failed_backup)
    with pytest.raises(ValueError,match='backup verification'):apply(importer)
    assert fingerprint(service.database)==before


def test_market_updates_use_exported_version_floor_and_then_advance(importer):
    service,_,exported=importer
    apply(importer)
    from app.services.testing_success_xml import TestingSuccessXmlService,AcknowledgementPayload
    from app.services.testing_state_store import TestingStateStore
    handler=TestingSuccessXmlService.__new__(TestingSuccessXmlService)
    handler.store=SimpleNamespace(_optional_string=TestingStateStore._optional_string)
    def ack(version):
        return AcknowledgementPayload('MARKET_INFO.PUT','Market Info PUT',exported['device_record']['primary_udi_di'],version,
            '2026-10-26T10:00:00Z','market-next','market-ack','SUCCESS',(),'synthetic.xml','')
    with closing(sqlite3.connect(service.database)) as connection:
        connection.row_factory=sqlite3.Row
        handler._reconcile_subject_success_state(connection,1,ack('1'),event_id=90)
        assert accepted_market_state(connection,subject(connection))['version']=='2'
        countries=[{'country':'IE','original_placed_on_market':True}]
        payload={'latest_successful_market_info_state':{'version':'3','market_countries':countries}}
        connection.execute("INSERT INTO testing_events(id,subject_id,event_index,message_type,status,version,correlation_id,raw_event_json) VALUES(3,1,3,'MARKET_INFO.PUT','GENERATED','3','market-next',?)",(json.dumps(payload),))
        handler._reconcile_subject_success_state(connection,1,ack('3'),event_id=91)
        assert accepted_market_state(connection,subject(connection))['version']=='3'
        assert accepted_market_state(connection,subject(connection))['market_countries']==countries
        assert accepted_device_state(connection,subject(connection))['version']=='2'
