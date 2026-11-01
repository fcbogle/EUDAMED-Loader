"""Operator flow through the replacement API, with synthetic files and temporary DBs."""
import base64
import json
import sqlite3
from copy import deepcopy
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers import dev_input_batches as routes
from app.services.import_workflow import ImportWorkflow
from app.services.source_review_drafts import DraftRequest
from app.services.import_review_policy import CATEGORIES
from test_dev_workbook_import import dev_import, production
from test_source_review_drafts import request


@pytest.fixture
def workflow(dev_import,monkeypatch):
    settings=dev_import[-1];monkeypatch.setattr(routes,'get_settings',lambda:settings)
    app=FastAPI();app.include_router(routes.router,prefix='/api')
    return TestClient(app),ImportWorkflow(settings),dev_import


def checked(client,response):
    saved=response.json();assert response.status_code==200,response.text
    result=client.post('/api/dev-input-batches/sessions/'+saved['id']+'/review',json={'revision':saved['revision']})
    assert result.status_code==200,result.text
    return result.json()


def test_three_actions_complete_without_downloading_workbook_and_resume(workflow):
    client,service,fixture=workflow;before=fixture[-1].testing_state_db_path.read_bytes();payload=request(fixture).model_dump(mode='json')
    prefix='/api/dev-input-batches/sessions'
    reviewed=checked(client,client.put(prefix+'/new',json=payload))
    assert reviewed['stage']=='workbook' and reviewed['review']['message']=='Ready to continue'
    assert fixture[-1].testing_state_db_path.read_bytes()==before
    result=client.post(prefix+'/'+reviewed['id']+'/workbook',json={'revision':reviewed['revision']})
    assert result.status_code==200,result.text
    ready=result.json();assert ready['stage']=='import' and ready['summary']['new_count']==1
    assert ImportWorkflow(fixture[-1]).get(ready['id'])['stage']=='import'
    assert fixture[-1].testing_state_db_path.read_bytes()==before
    # Download is deliberately never requested before import.
    imported=client.post(prefix+'/'+ready['id']+'/import',json={'revision':ready['revision'],'confirmed_by':'Synthetic RA <ra@example.test>','confirmed':True})
    assert imported.status_code==200,imported.text
    result=imported.json();assert result['stage']=='complete' and result['result']['created_count']==1
    assert ImportWorkflow(fixture[-1]).get(ready['id'])['stage']=='complete'
    repeat=client.post(prefix+'/'+ready['id']+'/import',json={'revision':ready['revision'],'confirmed_by':'Synthetic RA','confirmed':True})
    assert repeat.status_code==200 and repeat.json()['result']['created_count']==1
    download=client.get(prefix+'/'+ready['id']+'/workbook');assert download.status_code==200 and download.content.startswith(b'PK')
    path=service.batches._batch(result['batch_id'])
    evidence=json.loads(next((path/'prepared').glob('*/*.audit.json')).read_text())
    assert evidence['dev_input_batch']['source_review']['draft_id']==ready['id']


def test_partial_autosave_restarts_and_replacements_retain_unchanged_sources(workflow):
    client,service,fixture=workflow;prefix='/api/dev-input-batches/sessions'
    partial=client.put(prefix+'/new',json={'metadata':{},'files':[]})
    assert partial.status_code==200,partial.text
    saved=partial.json();assert saved['stage']=='review'
    assert service.get(saved['id'])['metadata']['source_date'] is None
    payload=request(fixture).model_dump(mode='json');payload['expected_revision']=saved['revision']
    complete=client.put(prefix+'/'+saved['id'],json=payload).json()
    original={e['path']:e['size_bytes'] for e in complete['files']}
    update={'metadata':complete['metadata'],'expected_revision':complete['revision'],'files':[payload['files'][0]]}
    updated=client.put(prefix+'/'+complete['id'],json=update);assert updated.status_code==200,updated.text
    assert {e['path']:e['size_bytes'] for e in updated.json()['files']}==original
    assert client.put(prefix+'/'+complete['id'],json=update).status_code==409


@pytest.mark.parametrize("across_files",[False,True])
def test_duplicates_with_identical_rows_block_before_batch_creation(workflow,across_files):
    from openpyxl import load_workbook
    client,service,fixture=workflow;payload=request(fixture).model_dump(mode='json')
    path=fixture[4]/'data/source_excel/Template.xlsx';book=load_workbook(path);sheet=book.active;sheet.append([c.value for c in sheet[2]]);book.save(path);book.close()
    payload['files'][0]['content_base64']=base64.b64encode(path.read_bytes()).decode()
    if across_files:
        book=load_workbook(path);book.active.delete_rows(3);book.save(path);book.close()
        payload['files'][0]['content_base64']=base64.b64encode(path.read_bytes()).decode()
        payload['files'].append({**payload['files'][0],'name':'SecondTemplate.xlsx'})
    reviewed=checked(client,client.put('/api/dev-input-batches/sessions/new',json=payload))
    assert reviewed['stage']=='review' and reviewed['review']['message']=='Source corrections required'
    group=next(g for g in reviewed['review']['groups'] if g['code']=='duplicates')
    assert group['severity']=='block' and group['count']==1
    assert {r['row'] for r in group['records']}==({2} if across_files else {2,3})
    if across_files:assert {r['file'] for r in group['records']}=={'Template.xlsx','SecondTemplate.xlsx'}
    assert client.post('/api/dev-input-batches/sessions/'+reviewed['id']+'/workbook',json={'revision':reviewed['revision']}).status_code==409
    assert not service.drafts.describe(reviewed['id'])['batch_id']


def test_ordinary_source_differences_and_unknown_dates_are_warnings(workflow):
    client,service,fixture=workflow
    # Existing fixture Template contains one different device from the export: a normal difference.
    payload=request(fixture).model_dump(mode='json')
    payload['metadata']['source_date']=None;payload['metadata']['export_date']=None
    # Select the same reference and XML, but no matching Template identity.
    from openpyxl import load_workbook
    path=fixture[4]/'data/source_excel/Template.xlsx';book=load_workbook(path);book.active.cell(2,2,'99000000000003');book.active.cell(2,4,'DIFFERENT-CATALOGUE');book.save(path);book.close()
    payload['files'][0]['content_base64']=base64.b64encode(path.read_bytes()).decode()
    reviewed=checked(client,client.put('/api/dev-input-batches/sessions/new',json=payload))
    assert reviewed['stage']=='workbook' and reviewed['review']['message']=='Ready to continue — warnings found'
    assert all(g['severity']=='warn' for g in reviewed['review']['groups'])
    assert {g['code'] for g in reviewed['review']['groups']}=={'differences','optional'}
    ready=client.post('/api/dev-input-batches/sessions/'+reviewed['id']+'/workbook',json={'revision':reviewed['revision']})
    assert ready.status_code==200,ready.text


@pytest.mark.parametrize('problem',['missing','unreadable','wrong_actor','wrong_schema','missing_page','identity'])
def test_showstoppers_are_persisted_in_limited_vocabulary(workflow,problem):
    client,_,fixture=workflow;payload=request(fixture).model_dump(mode='json')
    if problem=='missing':payload['files']=payload['files'][:2]
    elif problem=='unreadable':payload['files'][0]['content_base64']=base64.b64encode(b'bad Excel').decode()
    else:
        from lxml import etree
        tree=etree.fromstring(base64.b64decode(payload['files'][2]['content_base64']))
        if problem=='wrong_schema':tree.set('version','3.0.30')
        elif problem=='wrong_actor':
            for node in tree.xpath('//*[local-name()="MFActorCode"]'):node.text='WRONG'
        elif problem=='missing_page':
            tree.xpath('//*[local-name()="numberOfPages"]')[0].text='2'
        else:tree.xpath('//*[local-name()="MDRUDIDIData"]/*[local-name()="identifier"]/*[local-name()="DICode"]')[0].text=''
        payload['files'][2]['content_base64']=base64.b64encode(etree.tostring(tree)).decode()
    reviewed=checked(client,client.put('/api/dev-input-batches/sessions/new',json=payload))
    assert not reviewed['review']['can_create'] and reviewed['stage']=='review'
    assert all(g['code'] in CATEGORIES for g in reviewed['review']['groups'])
    assert len(reviewed['review']['groups'])<=8


def test_stale_database_confirmation_and_production_are_rejected(workflow,monkeypatch):
    client,_,fixture=workflow;prefix='/api/dev-input-batches/sessions'
    reviewed=checked(client,client.put(prefix+'/new',json=request(fixture).model_dump(mode='json')))
    ready=client.post(prefix+'/'+reviewed['id']+'/workbook',json={'revision':reviewed['revision']}).json()
    assert client.post(prefix+'/'+ready['id']+'/import',json={'revision':ready['revision'],'confirmed_by':'RA','confirmed':False}).status_code==409
    with sqlite3.connect(fixture[-1].testing_state_db_path) as c:c.execute("INSERT INTO import_batch(source_type,label,imported_at) VALUES('test','changed','now')")
    assert client.post(prefix+'/'+ready['id']+'/import',json={'revision':ready['revision'],'confirmed_by':'RA','confirmed':True}).status_code==409
    settings=fixture[-1];monkeypatch.setattr(routes,'get_settings',lambda:settings.model_copy(update={'environment':'prod'}))
    assert client.get(prefix).status_code==403 and client.put(prefix+'/new',json={}).status_code==403


def test_superseded_endpoints_are_removed_and_old_files_remain_available(workflow):
    client,service,fixture=workflow;batch=fixture[2].name
    paths={route.path for route in client.app.routes}
    assert '/api/dev-input-batches' not in paths
    for retired in ('/source-reviews/new','/{batch_id}/inspect','/{batch_id}/prepare','/{batch_id}/resume','/{batch_id}/prepared/{artifact_id}/assess-import','/{batch_id}/prepared/{artifact_id}/confirm-import'):
        assert '/api/dev-input-batches'+retired not in paths
    old=service.get(batch);assert old['stage']=='review' and old['files']
    assert client.get('/api/dev-input-batches/sessions').json()['imports']
    # Copy the old batch on first autosave; never rewrite its immutable manifest.
    before=(fixture[2]/'manifest.json').read_bytes()
    saved=client.put('/api/dev-input-batches/sessions/'+batch,json={'metadata':old['metadata'],'files':[]})
    assert saved.status_code==200 and saved.json()['id']!=batch
    assert (fixture[2]/'manifest.json').read_bytes()==before


def test_upload_request_is_bounded_before_decoding(workflow,monkeypatch):
    client,_,fixture=workflow;monkeypatch.setattr(routes,'MAX_REQUEST_BYTES',100)
    assert client.put('/api/dev-input-batches/sessions/new',json=request(fixture).model_dump(mode='json')).status_code==413


def test_long_findings_are_grouped_and_download_retains_all_rows_as_literal_text(workflow):
    from openpyxl import load_workbook
    from io import BytesIO
    client,_,fixture=workflow;payload=request(fixture).model_dump(mode='json')
    path=fixture[4]/'data/source_excel/Template.xlsx';book=load_workbook(path);sheet=book.active
    for _ in range(30):sheet.append([cell.value for cell in sheet[2]])
    book.save(path);book.close();payload['files'][0]['content_base64']=base64.b64encode(path.read_bytes()).decode()
    reviewed=checked(client,client.put('/api/dev-input-batches/sessions/new',json=payload))
    group=next(g for g in reviewed['review']['groups'] if g['code']=='duplicates')
    assert group['count']==1 and len(group['records'])==10 and group['truncated']
    download=client.get('/api/dev-input-batches/sessions/'+reviewed['id']+'/findings')
    assert download.status_code==200
    book=load_workbook(BytesIO(download.content));sheet=book.active
    assert sheet.max_row==32 and all(sheet.cell(row,7).value=='99000000000000' for row in range(2,33))
    assert all(cell.data_type!='f' for row in sheet for cell in row)
    book.close()


def test_catalogue_repeated_in_sources_and_database_is_one_blocking_issue(workflow):
    from openpyxl import load_workbook
    client,service,fixture=workflow
    prefix='/api/dev-input-batches/sessions'
    payload=request(fixture).model_dump(mode='json')
    reviewed=checked(client,client.put(prefix+'/new',json=payload))
    ready=client.post(prefix+'/'+reviewed['id']+'/workbook',json={'revision':reviewed['revision']}).json()
    result=client.post(prefix+'/'+ready['id']+'/import',json={'revision':ready['revision'],'confirmed_by':'Synthetic RA','confirmed':True})
    assert result.status_code==200
    path=fixture[4]/'data/source_excel/Template.xlsx';book=load_workbook(path);book.active.append(['GS1','99000000000009','BASICSHARED','SYN-000000']);book.save(path);book.close()
    payload['files'][0]['content_base64']=base64.b64encode(path.read_bytes()).decode()
    before=fixture[-1].testing_state_db_path.read_bytes()
    reviewed=checked(client,client.put(prefix+'/new',json=payload))
    assert reviewed['stage']=='review' and reviewed['review']['message']=='Source corrections required'
    group=next(g for g in reviewed['review']['groups'] if g['code']=='identity')
    assert group['severity']=='block' and group['count']==1 and len(group['records'])==1
    assert {item['udi_di'] for item in group['records'][0]['identifiers']}=={'99000000000000','99000000000009'}
    assert client.post(prefix+'/'+reviewed['id']+'/workbook',json={'revision':reviewed['revision']}).status_code==409
    assert fixture[-1].testing_state_db_path.read_bytes()==before


def test_prior_warning_policy_cannot_authorize_import_after_upgrade(workflow):
    client,service,fixture=workflow;prefix='/api/dev-input-batches/sessions'
    reviewed=checked(client,client.put(prefix+'/new',json=request(fixture).model_dump(mode='json')))
    ready=client.post(prefix+'/'+reviewed['id']+'/workbook',json={'revision':reviewed['revision']}).json()
    path,state=service.drafts._load(ready['id'])
    report_path=path/'reviews'/(state['review_id']+'.json');report=json.loads(report_path.read_text());report['policy_version']='minimal-import-v1';report_path.write_text(json.dumps(report))
    approval_path=service.batches._batch(ready['batch_id'])/'source-review.json';approval=json.loads(approval_path.read_text());approval['policy_version']='minimal-import-v1';approval_path.write_text(json.dumps(approval))
    old=service.get(ready['id']);assert old['stage']=='review' and old['review'] is None
    before=fixture[-1].testing_state_db_path.read_bytes()
    assert client.post(prefix+'/'+ready['id']+'/import',json={'revision':ready['revision'],'confirmed_by':'Synthetic RA','confirmed':True}).status_code==409
    assert client.post(prefix+'/'+ready['id']+'/workbook',json={'revision':ready['revision']}).status_code==409
    assert fixture[-1].testing_state_db_path.read_bytes()==before
