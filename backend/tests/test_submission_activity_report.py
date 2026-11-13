"""Submission activity uses synthetic SQLite only; no operational constructors."""
import base64
from io import BytesIO
import json
import sqlite3
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from openpyxl import load_workbook
import pytest

from app.routers import ra_reporting as routes
from app.services.submission_activity_report import SubmissionActivityReport


@pytest.fixture
def activity_case(tmp_path):
    path=tmp_path/'activity.sqlite3'
    with sqlite3.connect(path) as c:
        c.executescript('''
        CREATE TABLE import_batch(id INTEGER);INSERT INTO import_batch VALUES(1);
        CREATE TABLE canonical_device_record(device_subject_id INTEGER,source_import_batch_id INTEGER,record_json TEXT);
        CREATE TABLE testing_subjects(id INTEGER,device_subject_id INTEGER,product_family TEXT,product_variant TEXT,catalogue_number TEXT,primary_udi_di TEXT);
        CREATE TABLE generated_packages(id INTEGER,created_at TEXT,flow TEXT,product_family TEXT,product_variant TEXT,package_file_name TEXT,package_sha256 TEXT,manifest_json TEXT,reviewed_at TEXT,review_basis TEXT);
        CREATE TABLE testing_batches(batch_id TEXT,message_type TEXT,product_family TEXT,product_variant TEXT,created_at TEXT,acknowledged_at TEXT);
        CREATE TABLE testing_batch_devices(batch_id TEXT,subject_id INTEGER,generated_event_id INTEGER,acknowledgement_event_id INTEGER,outcome_status TEXT);
        CREATE TABLE testing_events(id INTEGER,subject_id INTEGER,event_index INTEGER,message_type TEXT,status TEXT,version TEXT,batch_id TEXT,correlation_id TEXT,message_id TEXT,tested_at TEXT,transaction_id TEXT,submission_id TEXT,source_file_name TEXT,raw_xml TEXT,raw_event_json TEXT,changed_fields_json TEXT);
        ''')
        for sid,model in ((1,'Linx'),(2,'Echelon'),(3,'Linx')):
            c.execute('INSERT INTO canonical_device_record VALUES(?,1,?)',(sid,json.dumps({'product_family':'Family','product_variant':model})))
            c.execute('INSERT INTO testing_subjects VALUES(?,?,?,?,?,?)',(sid,sid,'Family',model,'=CAT'+str(sid),'D'+str(sid)))
        c.execute('INSERT INTO canonical_device_record VALUES(4,1,?)',(json.dumps({'product_family':'Family','product_variant':'No activity'}),))
        for pid,model,date,reviewed in ((1,'Linx','2026-10-01',True),(2,'Linx','2026-10-03',True),(3,'Echelon','2026-10-04',False)):
            c.execute('INSERT INTO generated_packages VALUES(?,?,?,?,?,?,?,?,?,?)',(pid,date+'T10:00:00Z','bulk_udidi_post','Family',model,'same-name.zip','hash-'+str(pid),'{}',date+'T10:01:00Z' if reviewed else None,'zip_download' if reviewed else None))
        for batch,op,date in (('C1','UDI_DI.POST','2026-10-01'),('C2','UDI_DI.PATCH','2026-10-02'),('CROSS','UDI_DI.POST','2026-10-03')):
            c.execute('INSERT INTO testing_batches VALUES(?,?,?,?,?,?)',(batch,op,'Family','Linx',date+'T09:00:00Z',date+'T12:00:00Z'))
        for batch,sid,event,state in (('C1',1,1,'SUCCESS'),('C1',3,None,None),('C2',1,2,'ERROR'),('CROSS',1,3,'SUCCESS'),('CROSS',2,4,'ERROR')):
            c.execute('INSERT INTO testing_batch_devices VALUES(?,?,NULL,?,?)',(batch,sid,event,state))
        for eid,sid,batch,op,status,date in ((1,1,'C1','UDI_DI.POST','SUCCESS','2026-10-01'),(2,1,'C2','UDI_DI.PATCH','ERROR','2026-10-02'),(3,1,'CROSS','UDI_DI.POST','SUCCESS','2026-10-03'),(4,2,'CROSS','UDI_DI.POST','ERROR','2026-10-03'),(5,1,'ORPHAN','UDI_DI.PATCH','SUCCESS','2026-10-05')):
            c.execute('INSERT INTO testing_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(eid,sid,eid,op,status,'2',batch,batch,'MSG-'+batch,date+'T12:00:00Z',None,None,'response-'+batch+'.xml','<Response>Synthetic</Response>',json.dumps({'error_details':['Synthetic rejection'] if status=='ERROR' else []}),'[]'))
        c.execute("INSERT INTO testing_events(id,subject_id,event_index,message_type,status,version,raw_event_json) VALUES(6,1,6,'PLAYGROUND_EXPORT.SNAPSHOT','IMPORTED','3','{}')")
    return SimpleNamespace(environment='dev',testing_state_db_path=path)


def generate(settings,include=False):
    before=settings.testing_state_db_path.read_bytes()
    report=SubmissionActivityReport(settings).generate(include)
    assert settings.testing_state_db_path.read_bytes()==before
    return report


def model(report,name):return next(row for row in report['models'] if row['model']==name)


def test_latest_model_timestamps_include_same_latest_record_in_history(activity_case):
    report=generate(activity_case)
    linx=model(report,'Linx')
    assert linx['latest_activity']['kind']=='Unlinked response'
    assert linx['latest_activity']['activity_at']=='2026-10-05T12:00:00Z'
    assert linx['latest_zip_downloaded_at']=='2026-10-03T10:01:00Z'
    assert linx['latest_response_at']=='2026-10-05T12:00:00Z'
    history=[row for row in report['activities'] if row['model_key']==linx['key']]
    assert history[0]['id']==linx['latest_activity']['id']
    assert len(history)==6 and linx['zip_records']==2 and linx['message_batches']==3
    assert model(report,'No activity')['latest_activity'] is None


def test_pending_entities_prevent_false_full_success_and_cross_model_counts_are_scoped(activity_case):
    report=generate(activity_case)
    c1=next(row for row in report['activities'] if row['batch_id']=='C1')
    assert (c1['success'],c1['pending'],c1['outcome'])==(1,1,'Partially responded')
    cross=[row for row in report['activities'] if row['batch_id']=='CROSS']
    assert len(cross)==2
    assert next(row for row in cross if row['model_key']==model(report,'Linx')['key'])['outcome']=='Successful'
    assert next(row for row in cross if row['model_key']==model(report,'Echelon')['key'])['outcome']=='Failed'


def test_repeated_zip_names_are_distinct_and_never_matched_to_responses_by_date(activity_case):
    report=generate(activity_case)
    zips=[row for row in report['activities'] if row['id'].startswith('zip:') and row['model_key']==model(report,'Linx')['key']]
    assert len(zips)==2 and zips[0]['reference']==zips[1]['reference']
    assert all(row['responses']==[] and row['response_at'] is None for row in zips)
    assert len({row['package_sha256'] for row in zips})==2
    assert all(row['generated_by'] is None and row['response_imported_by'] is None for row in report['activities'])
    assert all(row['response_imported_at'] is None for row in report['activities'])


def test_missing_and_timezone_less_dates_are_kept_as_unordered_history(activity_case):
    with sqlite3.connect(activity_case.testing_state_db_path) as c:
        c.execute("UPDATE testing_events SET tested_at='2026-10-05 12:00:00' WHERE id=5")
    report=generate(activity_case);linx=model(report,'Linx')
    assert linx['unordered_records']==1
    assert linx['latest_activity']['batch_id']=='CROSS'
    assert any('Timestamp cannot' in note for row in report['activities'] if row['id'].startswith('unlinked:') for note in row['notes'])


def test_multiple_responses_stay_with_exact_batch_and_conflicting_outcomes_are_not_hidden(activity_case):
    with sqlite3.connect(activity_case.testing_state_db_path) as c:
        c.execute("INSERT INTO testing_events SELECT 8,subject_id,8,message_type,'ERROR',version,batch_id,correlation_id,'CONFLICT',tested_at,transaction_id,submission_id,source_file_name,raw_xml,raw_event_json,changed_fields_json FROM testing_events WHERE id=1")
    report=generate(activity_case);row=next(row for row in report['activities'] if row['batch_id']=='C1')
    assert row['unknown']==1 and row['outcome']=='Incomplete / conflicting outcome evidence'
    assert len(row['responses'])==2
    assert not any(row['reference']=='C1' and row['id'].startswith('unlinked:') for row in report['activities'])


def test_exact_correlation_membership_can_explain_a_missing_direct_response_link(activity_case):
    with sqlite3.connect(activity_case.testing_state_db_path) as c:
        c.execute("UPDATE testing_batch_devices SET acknowledgement_event_id=NULL,outcome_status=NULL WHERE batch_id='C2'")
    row=next(row for row in generate(activity_case)['activities'] if row['batch_id']=='C2')
    assert row['error']==1 and row['outcome']=='Failed'
    assert any('exact correlation' in note for note in row['notes'])


def test_excel_summary_history_literal_text_and_entity_details_only_on_request(activity_case):
    book=load_workbook(BytesIO(base64.b64decode(generate(activity_case)['excel_base64'])))
    assert book.sheetnames==['Context','Models','Activity','Response evidence','Record notes'];book.close()
    book=load_workbook(BytesIO(base64.b64decode(generate(activity_case,True)['excel_base64'])))
    sheet=book['Requested entity outcomes']
    assert sheet['C2'].value.startswith('=CAT') and sheet['C2'].data_type=='s'
    assert 'Actual portal upload time' in [cell.value for cell in book['Activity'][1]]
    book.close()


def test_report_api_and_retained_response_download_are_readonly_and_dev_only(activity_case,monkeypatch):
    monkeypatch.setattr(routes,'get_settings',lambda:activity_case)
    app=FastAPI();app.include_router(routes.router,prefix='/api');client=TestClient(app)
    before=activity_case.testing_state_db_path.read_bytes()
    response=client.post('/api/reporting/submission-activity',json={})
    assert response.status_code==200,response.text
    xml=client.get('/api/reporting/submission-activity/responses/1')
    assert xml.status_code==200 and b'Synthetic' in xml.content
    assert 'attachment' in xml.headers['content-disposition']
    assert client.get('/api/reporting/submission-activity/responses/6').status_code==404
    assert client.get('/api/reporting/submission-activity/responses/999').status_code==404
    assert client.post('/api/reporting/submission-activity',json={'extracts':[]}).status_code==422
    assert activity_case.testing_state_db_path.read_bytes()==before
    activity_case.environment='prod';activity_case.testing_state_db_path=None
    assert client.post('/api/reporting/submission-activity',content='invalid').status_code==403
    assert client.get('/api/reporting/submission-activity/responses/1').status_code==403
