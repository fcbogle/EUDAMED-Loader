"""Production Import Management tests use synthetic sources and temporary databases."""
import base64
from copy import deepcopy
import json
from pathlib import Path
import sqlite3

from fastapi import FastAPI
from fastapi.testclient import TestClient
from lxml import etree
import pytest

from app.routers import managed_import as routes
from app.services.dev_batch_preparation import DevBatchPreparation, ProductionBatchPreparation
from app.services.dev_workbook_import import ProductionManagedImporter
from app.services.import_workflow import ImportWorkflow
from app.services.production_workbook_import import ProductionWorkbookImporter
from app.services.workbook_import import WorkbookImportService
from app.services.testing_state_store import TestingStateStore as StateStore
from test_production_workbook_import import production

PREFIX='/api/input-batches/sessions'

@pytest.fixture
def managed(production,monkeypatch):
    settings,inputs,_=production
    WorkbookImportService();StateStore()
    monkeypatch.setattr(routes,'get_settings',lambda:settings)
    app=FastAPI();app.include_router(routes.router,prefix='/api')
    files=[]
    for role,path in [('templates',inputs['template_dir']/'Template.xlsx'),('basic-udi',inputs['parent_reference']),('eudamed-xml',inputs['xml_dir']/'export.xml')]:
        content=path.read_bytes()
        if role=='eudamed-xml':
            tree=etree.fromstring(content);tree.set('version','3.0.30');content=etree.tostring(tree)
        files.append({'role':role,'name':path.name,'content_base64':base64.b64encode(content).decode()})
    request={'metadata':{'creator':{'name':'Synthetic RA','email':'ra@example.test','team_role':'RA'},'description':'Synthetic Production import'},'files':files}
    return TestClient(app),settings,request


def prepare(managed):
    client,settings,request=managed
    before=settings.testing_state_db_path.read_bytes()
    saved=client.put(PREFIX+'/new',json=request);assert saved.status_code==200,saved.text
    session=saved.json()
    reviewed=client.post(PREFIX+'/'+session['id']+'/review',json={'revision':session['revision']})
    assert reviewed.status_code==200,reviewed.text
    session=reviewed.json();assert session['stage']=='workbook',session['review']
    ready=client.post(PREFIX+'/'+session['id']+'/workbook',json={'revision':session['revision']})
    assert ready.status_code==200,ready.text
    assert settings.testing_state_db_path.read_bytes()==before
    return ready.json()


def confirm(managed,ready,target='prod'):
    return managed[0].post(PREFIX+'/'+ready['id']+'/import',json={'revision':ready['revision'],
        'confirmed_by':'Synthetic RA <ra@example.test>','confirmed':True,'target_environment':target})


def test_production_flow_review_readonly_confirmation_backup_and_production_evidence(managed):
    client,settings,_=managed
    ready=prepare(managed);assert ready['environment']=='prod' and ready['stage']=='import'
    before=settings.testing_state_db_path.read_bytes()
    assert confirm(managed,ready,'dev').status_code==409
    assert client.post(PREFIX+'/'+ready['id']+'/import',json={'revision':ready['revision'],'confirmed_by':'RA','confirmed':True}).status_code==422
    assert settings.testing_state_db_path.read_bytes()==before
    response=confirm(managed,ready);assert response.status_code==200,response.text
    done=response.json();assert done['stage']=='complete' and done['result']['created_count']==2
    backup=done['result']['backup'];assert Path(backup['path']).is_relative_to(settings.testing_state_backup_dir)
    assert backup['integrity_check']=='ok'
    with sqlite3.connect(settings.testing_state_db_path) as connection:
        events=connection.execute('SELECT message_type,accepted_state_source FROM testing_events').fetchall()
        assert events==[('PRODUCTION_EXPORT.SNAPSHOT','production_export')]
        from app.services.accepted_state import accepted_post_state
        connection.row_factory=sqlite3.Row
        subject=connection.execute('SELECT * FROM testing_subjects').fetchone()
        baseline=accepted_post_state(connection,subject)
        assert baseline['accepted_state_source']=='production_export'
        assert baseline['device_record']['product_family']==subject['product_family']
        assert baseline['device_record']['product_variant']==subject['product_variant']
        assert connection.execute("SELECT count(*) FROM device_subject WHERE subject_key LIKE 'PROD|%'").fetchone()[0]==2
        assert connection.execute('PRAGMA foreign_key_check').fetchall()==[]
    after=settings.testing_state_db_path.read_bytes()
    assert confirm(managed,ready).status_code==200
    assert settings.testing_state_db_path.read_bytes()==after
    assert client.get(PREFIX).json()['imports'][0]['status']=='complete'
    assert client.get(PREFIX+'/'+done['id']+'/findings').status_code==200
    assert client.get(PREFIX+'/'+done['id']+'/workbook').status_code==200


def test_existing_production_history_and_current_values_are_retained(managed):
    client,settings,request=managed
    legacy=ProductionWorkbookImporter();assessment=legacy.assess()
    legacy.run_import(assessment_token=assessment['assessment_token'],imported_by='Earlier operator')
    with sqlite3.connect(settings.testing_state_db_path) as c:
        old_events=c.execute('SELECT * FROM testing_events').fetchall()
        old_subjects=c.execute('SELECT * FROM testing_subjects').fetchall()
        old_records=c.execute('SELECT id,record_json FROM canonical_device_record').fetchall()
    listed=client.get(PREFIX).json()['imports'];assert listed[0]['id']=='production-import-1'
    receipt=client.get(PREFIX+'/production-import-1').json();assert receipt['legacy'] and receipt['stage']=='complete'
    ready=prepare(managed);done=confirm(managed,ready);assert done.status_code==200,done.text
    assert done.json()['result']['created_count']==0
    with sqlite3.connect(settings.testing_state_db_path) as c:
        assert c.execute('SELECT * FROM testing_events').fetchall()==old_events
        assert c.execute('SELECT * FROM testing_subjects').fetchall()==old_subjects
        assert c.execute('SELECT id,record_json FROM canonical_device_record').fetchall()==old_records


def test_playground_xml_is_blocked_without_database_changes(managed):
    client,settings,request=managed;request=deepcopy(request)
    xml=etree.fromstring(base64.b64decode(request['files'][2]['content_base64']));xml.set('version','3.0.36.1')
    request['files'][2]['content_base64']=base64.b64encode(etree.tostring(xml)).decode()
    before=settings.testing_state_db_path.read_bytes()
    saved=client.put(PREFIX+'/new',json=request).json()
    response=client.post(PREFIX+'/'+saved['id']+'/review',json={'revision':saved['revision']})
    assert response.status_code==200 and not response.json()['review']['can_create']
    assert settings.testing_state_db_path.read_bytes()==before


def test_old_dev_service_stays_dev_only_and_paths_are_bound(managed,tmp_path):
    _,settings,_=managed
    with pytest.raises(PermissionError):DevBatchPreparation(settings)
    wrong=settings.model_copy(update={'testing_state_db_path':tmp_path/'outside.sqlite3','data_root':tmp_path/'prod'})
    with pytest.raises(PermissionError):ProductionManagedImporter(wrong)
    alias=settings.data_root/'alias.sqlite3';alias.hardlink_to(settings.testing_state_db_path)
    with pytest.raises(PermissionError):ProductionManagedImporter(settings.model_copy(update={'testing_state_db_path':alias}))
    alias.unlink()
    with pytest.raises(PermissionError):ProductionBatchPreparation(settings.model_copy(update={'eudamed_message_schema_version':'3.0.36.1'}))


def test_stale_review_and_rollback_leave_database_unchanged(managed,monkeypatch):
    ready=prepare(managed);before=managed[1].testing_state_db_path.read_bytes()
    def fail(*args):raise ValueError('Synthetic failure')
    monkeypatch.setattr(ProductionManagedImporter,'_insert',fail)
    response=confirm(managed,ready);assert response.status_code==409,response.text
    assert managed[1].testing_state_db_path.read_bytes()==before


def test_wrong_manufacturer_and_changed_source_environment_are_blocked(managed):
    client,settings,request=managed;request=deepcopy(request)
    xml=etree.fromstring(base64.b64decode(request['files'][2]['content_base64']))
    for node in xml.xpath('//*[local-name()="MFActorCode"]'):node.text='WRONG-MANUFACTURER'
    request['files'][2]['content_base64']=base64.b64encode(etree.tostring(xml)).decode()
    before=settings.testing_state_db_path.read_bytes()
    saved=client.put(PREFIX+'/new',json=request).json()
    review=client.post(PREFIX+'/'+saved['id']+'/review',json={'revision':saved['revision']}).json()
    assert not review['review']['can_create']
    assert settings.testing_state_db_path.read_bytes()==before


def test_existing_dev_api_still_refuses_production(managed,monkeypatch):
    from app.routers import dev_input_batches
    monkeypatch.setattr(dev_input_batches,'get_settings',lambda:managed[1])
    app=FastAPI();app.include_router(dev_input_batches.router,prefix='/api')
    before=managed[1].testing_state_db_path.read_bytes()
    assert TestClient(app).get('/api/dev-input-batches/sessions').status_code==403
    assert managed[1].testing_state_db_path.read_bytes()==before


def test_database_change_after_review_requires_fresh_review(managed):
    ready=prepare(managed);settings=managed[1]
    with sqlite3.connect(settings.testing_state_db_path) as c:
        c.execute("INSERT INTO import_batch(source_type,label,imported_at) VALUES('synthetic','Changed externally','2026-11-13')")
    before=settings.testing_state_db_path.read_bytes()
    response=confirm(managed,ready)
    assert response.status_code==409 and 'review' in response.text.lower()
    assert settings.testing_state_db_path.read_bytes()==before


def test_source_batch_cannot_change_environment(managed):
    ready=prepare(managed);settings=managed[1]
    manifest=settings.data_root/'import-batches'/ready['batch_id']/'manifest.json'
    data=json.loads(manifest.read_text());data['environment']='dev';manifest.write_text(json.dumps(data))
    before=settings.testing_state_db_path.read_bytes()
    response=confirm(managed,ready);assert response.status_code==409
    assert settings.testing_state_db_path.read_bytes()==before


def test_production_page_capacity_does_not_relax_dev_limits(managed):
    from app.services.source_batch_receipt import ReceivedFile,decode_files
    client,settings,request=managed;request=deepcopy(request)
    example=request['files'][2]
    request['files'] += [{**example,'name':f'page-{n:03}.xml'} for n in range(1,150)]
    before=settings.testing_state_db_path.read_bytes()
    response=client.put(PREFIX+'/new',json=request)
    assert response.status_code==200,response.text
    assert len(response.json()['files'])==152
    assert settings.testing_state_db_path.read_bytes()==before
    with pytest.raises(ValueError,match='100'):
        decode_files([ReceivedFile.model_validate(item) for item in request['files']])
