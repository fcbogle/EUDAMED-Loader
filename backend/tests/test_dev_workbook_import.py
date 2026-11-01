"""Only isolated synthetic Dev databases may be assessed/confirmed in these tests."""
from pathlib import Path
from unittest.mock import patch
import json
import shutil
import sqlite3

import lxml.etree as etree
import pytest
from app.services.dev_workbook_import import DevWorkbookImporter
from app.services.dev_batch_preparation import DevBatchPreparation
from app.services.dev_input_batches import create_dev_batch
from app.services.workbook_import import WorkbookImportService
from app.services.testing_state_store import TestingStateStore as Store
from app.services.production_workbook_preparation import NS
from test_production_workbook_import import production


@pytest.fixture
def dev_import(production,tmp_path,monkeypatch):
    prod,inputs,_=production
    root=tmp_path/'dev-project'
    (root/'data/source_excel').mkdir(parents=True);(root/'data/basic_udi_reference').mkdir()
    shutil.copy2(inputs['template_dir']/'Template.xlsx',root/'data/source_excel/Template.xlsx')
    shutil.copy2(inputs['parent_reference'],root/'data/basic_udi_reference/BasicUDIs.xlsx')
    downloads=root/'downloads';downloads.mkdir()
    tree=etree.parse(str(inputs['xml_dir']/'export.xml'));tree.getroot().set('version','3.0.32');tree.write(str(downloads/'export.xml'),encoding='utf-8',xml_declaration=True)
    (root/'.env.dev').write_text('EUDAMED_ENVIRONMENT=dev\nEUDAMED_MANUFACTURER_SRN_OVERRIDE=GB-MF-000000001\n')
    settings=prod.model_copy(update={'environment':'dev','eudamed_message_schema_version':'3.0.32', 'dev_input_batch_root':root/'data/dev/import-batches','testing_state_db_path':root/'data/testing/testing-state.sqlite3','testing_state_backup_dir':root/'data/testing/backups'})
    settings.testing_state_db_path.parent.mkdir()
    monkeypatch.setattr('app.services.workbook_import.get_settings',lambda:settings)
    monkeypatch.setattr('app.services.testing_state_store.get_settings',lambda:settings)
    WorkbookImportService();Store()
    batch=create_dev_batch(project_root=root,xml_dir=downloads,batch_id='2026-10-31-001')
    prep=DevBatchPreparation(settings)
    prepared=prep.prepare(batch.name,prep.inspect(batch.name)['inspection_token'])
    return DevWorkbookImporter(settings),prep,batch,prepared,root,settings


def assess(fixture):
    importer,_,batch,artifact,*_=fixture
    return importer.assess(batch.name,artifact['artifact_id'])


def confirm(fixture,assessment):
    importer,_,batch,artifact,*_=fixture
    return importer.confirm(batch.name,artifact['artifact_id'],assessment['assessment_id'],'Synthetic reviewer <reviewer@example.test>',True)


def test_assessment_readonly_import_backup_history_and_repeat(dev_import):
    imp,prep,batch,artifact,_,settings=dev_import
    before=settings.testing_state_db_path.read_bytes()
    report=assess(dev_import)
    assert report['new_count']==2 and report['can_import']
    assert settings.testing_state_db_path.read_bytes()==before
    result=confirm(dev_import,report)
    assert result['created_count']==2
    backup=Path(result['backup']['path']);assert backup.is_file() and result['backup']['integrity_check']=='ok'
    with sqlite3.connect(backup) as copied:
        copied.row_factory=sqlite3.Row
        assert imp._marker(copied)==report['database_marker']
    with imp._connect() as c:
        assert c.execute('SELECT count(*) FROM device_subject').fetchone()[0]==2
        assert tuple(c.execute('SELECT message_type,status FROM testing_events').fetchone())==('PLAYGROUND_EXPORT.SNAPSHOT','IMPORTED')
        assert c.execute('SELECT count(*) FROM reviewed_post_baselines').fetchone()[0]==0
        ids=[tuple(row) for row in c.execute('SELECT * FROM testing_events')]
    again=confirm(dev_import,report);assert again['already_imported']
    new_report=assess(dev_import);assert new_report['new_count']==0 and not new_report['differences']
    assert confirm(dev_import,new_report)['already_imported']
    with imp._connect() as c:assert [tuple(row) for row in c.execute('SELECT * FROM testing_events')]==ids
    resumed=imp.resume(batch.name);assert resumed['artifacts'][0]['artifact_id']==artifact['artifact_id'] and len(resumed['imports'])==1


def test_stale_database_files_and_missing_confirmation_cannot_import(dev_import):
    imp,_,batch,artifact,_,settings=dev_import
    report=assess(dev_import)
    with pytest.raises(ValueError,match='confirmation'):imp.confirm(batch.name,artifact['artifact_id'],report['assessment_id'],'reviewer',False)
    with sqlite3.connect(settings.testing_state_db_path) as c:c.execute("INSERT INTO import_batch(source_type,label,imported_at) VALUES('test','state changed','now')")
    with pytest.raises(ValueError,match='Database changed'):confirm(dev_import,report)
    report=assess(dev_import)
    workbook=batch/'prepared'/artifact['artifact_id']/artifact['workbook_name'];workbook.write_bytes(b'changed')
    with pytest.raises(ValueError,match='integrity'):confirm(dev_import,report)


def test_failure_rolls_back_every_write_and_preserves_backup(dev_import,monkeypatch):
    imp,_,batch,_,_,settings=dev_import
    report=assess(dev_import)
    with imp._connect() as c:before=[tuple(row) for row in c.execute('SELECT * FROM import_batch')]
    monkeypatch.setattr(imp,'_insert',lambda *args:(_ for _ in ()).throw(RuntimeError('injected failure')))
    with pytest.raises(RuntimeError,match='injected'):confirm(dev_import,report)
    with imp._connect() as c:
        assert [tuple(row) for row in c.execute('SELECT * FROM import_batch')]==before
        assert c.execute('SELECT count(*) FROM device_subject').fetchone()[0]==0
    assert len(list(imp.backups.glob('*.sqlite3')))==1
    assert not list((batch/'imports').glob('*.json'))


def test_production_path_and_profile_rejected(dev_import):
    imp,_,_,_,_,settings=dev_import
    with pytest.raises(PermissionError):DevWorkbookImporter(settings.model_copy(update={'environment':'prod'}))
    with pytest.raises(PermissionError):DevWorkbookImporter(settings.model_copy(update={'testing_state_db_path':settings.testing_state_db_path.parent.parent/'prod/application.sqlite3'}))


def test_changed_existing_source_is_reported_without_modifying_history(dev_import):
    from openpyxl import load_workbook
    imp,prep,batch,artifact,root,settings=dev_import
    confirm(dev_import,assess(dev_import))
    with imp._connect() as c:history=[tuple(r) for r in c.execute('SELECT * FROM testing_events')]
    path=root/'data/source_excel/Template.xlsx';book=load_workbook(path);book.active.cell(2,4,'CHANGED-CATALOGUE');book.save(path);book.close()
    newer=create_dev_batch(project_root=root,xml_dir=root/'downloads',batch_id='2026-11-01-001')
    workbook=prep.prepare(newer.name,prep.inspect(newer.name)['inspection_token'])
    result=imp.assess(newer.name,workbook['artifact_id'])
    assert result['can_import'] and len(result['differences'])==1
    imp.confirm(newer.name,workbook['artifact_id'],result['assessment_id'],'reviewer',True)
    with imp._connect() as c:assert [tuple(r) for r in c.execute('SELECT * FROM testing_events')]==history


def test_additive_import_retains_omitted_devices_and_all_accepted_history(dev_import):
    from openpyxl import load_workbook
    imp,prep,batch,artifact,root,settings=dev_import
    confirm(dev_import,assess(dev_import))
    with imp._connect() as c:
        subjects=[tuple(r) for r in c.execute('SELECT * FROM testing_subjects')]
        history=[tuple(r) for r in c.execute('SELECT * FROM testing_events')]
        canonical={r['device_subject_id']:r['record_json'] for r in c.execute('SELECT * FROM canonical_device_record')}
    file=root/'data/source_excel/Template.xlsx';book=load_workbook(file);sheet=book.active;sheet.cell(2,2,'99000000000002');sheet.cell(2,4,'NEW-TWO');book.save(file);book.close()
    newer=create_dev_batch(project_root=root,xml_dir=root/'downloads',batch_id='2026-11-02-001')
    artifact=prep.prepare(newer.name,prep.inspect(newer.name)['inspection_token'])
    report=imp.assess(newer.name,artifact['artifact_id'])
    assert report['can_import'] and report['new_count']==1 and report['omitted_retained_count']==1
    result=imp.confirm(newer.name,artifact['artifact_id'],report['assessment_id'],'Reviewer',True)
    with imp._connect() as c:
        assert c.execute('SELECT count(*) FROM device_subject').fetchone()[0]==3
        assert [tuple(r) for r in c.execute('SELECT * FROM testing_subjects')]==subjects
        assert [tuple(r) for r in c.execute('SELECT * FROM testing_events')]==history
        assert all(c.execute('SELECT record_json FROM canonical_device_record WHERE device_subject_id=?',(key,)).fetchone()[0]==value for key,value in canonical.items())
        assert c.execute('SELECT count(*) FROM canonical_device_record WHERE source_import_batch_id=?',(result['import_batch_id'],)).fetchone()[0]==3


def test_backup_failure_prevents_all_writes(dev_import,monkeypatch):
    imp,*_=dev_import;report=assess(dev_import)
    before=imp.database.read_bytes()
    monkeypatch.setattr(imp,'_backup',lambda *args:(_ for _ in ()).throw(ValueError('backup failed')))
    with pytest.raises(ValueError,match='backup failed'):confirm(dev_import,report)
    assert imp.database.read_bytes()==before


def test_expired_and_changed_configuration_assessments_rejected(dev_import,monkeypatch):
    imp,_,batch,_,_,_=dev_import;report=assess(dev_import)
    path=batch/'assessments'/(report['assessment_id']+'.json')
    expired=json.loads(path.read_text());expired['expires_at']='2000-01-01T00:00:00+00:00';path.write_text(json.dumps(expired))
    with pytest.raises(ValueError,match='expired'):confirm(dev_import,report)
    report=assess(dev_import)
    previous=imp._configuration();monkeypatch.setattr(imp,'_configuration',lambda:previous+['changed'])
    with pytest.raises(ValueError,match='configuration'):confirm(dev_import,report)



def test_workbook_change_during_confirmation_rolls_back(dev_import,monkeypatch):
    imp,_,batch,artifact,_,_=dev_import
    report=assess(dev_import);original=imp._backup
    def changed_after_backup(run):
        backup=original(run)
        (batch/'prepared'/artifact['artifact_id']/artifact['workbook_name']).write_bytes(b'changed after review')
        return backup
    monkeypatch.setattr(imp,'_backup',changed_after_backup)
    with pytest.raises(ValueError,match='integrity'):confirm(dev_import,report)
    with imp._connect() as c:
        assert c.execute('SELECT count(*) FROM import_batch').fetchone()[0]==0
        assert c.execute('SELECT count(*) FROM device_subject').fetchone()[0]==0


def test_new_catalogue_collision_blocks_import_without_changing_existing_devices(dev_import):
    from openpyxl import load_workbook
    imp,prep,_,_,root,_=dev_import
    confirm(dev_import,assess(dev_import))
    with imp._connect(write=True) as c:
        row=c.execute("SELECT * FROM canonical_device_record WHERE json_extract(record_json,'$.catalogue_number')='NEW-ONE'").fetchone()
        record=json.loads(row['record_json']);record['xml_readiness']['status']='complete'
        c.execute('UPDATE canonical_device_record SET record_json=?,xml_ready=1 WHERE id=?',(json.dumps(record),row['id']));c.commit()
    file=root/'data/source_excel/Template.xlsx';book=load_workbook(file);book.active.append(['GS1','99000000000002','BASICSHARED','NEW-ONE']);book.save(file);book.close()
    batch=create_dev_batch(project_root=root,xml_dir=root/'downloads',batch_id='2026-11-03-001')
    artifact=prep.prepare(batch.name,prep.inspect(batch.name)['inspection_token'])
    report=imp.assess(batch.name,artifact['artifact_id'])
    assert report['new_count']==1 and not report['can_import']
    assert len(report['catalogue_conflicts'])==1
    issue=report['catalogue_conflicts'][0]
    assert issue['catalogue']=='NEW-ONE'
    assert {entry['udi_di'] for entry in issue['identifiers']}=={'99000000000001','99000000000002'}
    with imp._connect() as c:before=[tuple(row) for row in c.execute('SELECT * FROM canonical_device_record')]
    with pytest.raises(ValueError):imp.confirm(batch.name,artifact['artifact_id'],report['assessment_id'],'Reviewer',True)
    with imp._connect() as c:assert [tuple(row) for row in c.execute('SELECT * FROM canonical_device_record')]==before
