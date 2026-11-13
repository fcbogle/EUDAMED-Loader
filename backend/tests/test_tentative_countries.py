"""Question-mark countries are rejected without rewriting source or accepted history."""
import base64
from copy import deepcopy
import json
import sqlite3
from pathlib import Path

import pytest
from lxml import etree
from openpyxl import load_workbook
from app.services.country_reference import (normalize_market_country_code, tentative_market_fields,
    apply_market_country_readiness, UNCONFIRMED_COUNTRY_REASON)
from app.services.import_review_policy import Findings,reason_blocks,category,POLICY_VERSION
from app.services.xml_projection import DeviceXmlProjectionBuilder
from app.services.workbook_import import WorkbookImportService
from scripts.benchmark_xml import synthetic_record
from app.validation_models import MarketAvailabilityItemPreview
from test_import_workflow import workflow,checked
from test_dev_workbook_import import dev_import,production
from test_source_review_drafts import request
from test_production_workbook_preparation import inputs,prepare_workbook,read_rows,workbook


@pytest.mark.parametrize('value',['France?','FR?','?Germany','Germany; France?','France ?'])
def test_questioned_country_is_never_normalized_or_guessed(value):
    with pytest.raises(ValueError,match='Confirm the country'):
        normalize_market_country_code(value)


def test_confirmed_aliases_and_unrelated_question_marks_are_unchanged():
    assert normalize_market_country_code('France')=='FR'
    assert normalize_market_country_code('GR')=='EL'
    fields={'Trade name':'Why?','URL':'https://example.test/?q=1','First EU market country':'Germany?'}
    assert tentative_market_fields(fields)==[('First EU market country','Germany?')]
    assert reason_blocks(UNCONFIRMED_COUNTRY_REASON)
    assert category(UNCONFIRMED_COUNTRY_REASON)=='countries'
    assert not reason_blocks('Proposed parent market countries missing')
    assert reason_blocks('Proposed parent market countries missing or tentative') # Old ambiguous artifact must be re-reviewed.


@pytest.mark.parametrize('location',['reference_first','reference_list','template','xml'])
def test_questioned_country_is_a_source_showstopper_before_import(workflow,location):
    client,service,fixture=workflow;payload=request(fixture).model_dump(mode='json');root=fixture[4]
    if location.startswith('reference'):
        path=root/'data/basic_udi_reference/BasicUDIs.xlsx'
        workbook(path,['Issuing Entity','Basic UDI-DI code','Device Model','Risk class',
                       'Member State of the placing on the EU market of the Device:',
                       'Member States where device is or is to be made available on the market:'],
                 [['GS1','BASICSHARED','Synthetic model','Class IIa','Germany?' if location=='reference_first' else 'Germany',
                   'France?' if location=='reference_list' else 'Germany; France']])
        payload['files'][1]['content_base64']=base64.b64encode(path.read_bytes()).decode()
    elif location=='template':
        path=root/'data/source_excel/Template.xlsx';book=load_workbook(path)
        book.active.cell(1,5,'Member state where first placed on the EU market e.g. Germany');book.active.cell(2,5,'Germany?')
        book.save(path);book.close();payload['files'][0]['content_base64']=base64.b64encode(path.read_bytes()).decode()
    else:
        tree=etree.fromstring(base64.b64decode(payload['files'][2]['content_base64']))
        tree.xpath('//*[local-name()="country"]')[0].text='FR?'
        payload['files'][2]['content_base64']=base64.b64encode(etree.tostring(tree)).decode()
    before=fixture[-1].testing_state_db_path.read_bytes()
    reviewed=checked(client,client.put('/api/dev-input-batches/sessions/new',json=payload))
    assert not reviewed['review']['can_create'] and reviewed['stage']=='review'
    group=next(g for g in reviewed['review']['groups'] if g['code']=='countries')
    assert group['severity']=='block' and '?' in group['action'] and group['count']==1
    assert not reviewed.get('batch_id') and fixture[-1].testing_state_db_path.read_bytes()==before
    assert client.post('/api/dev-input-batches/sessions/'+reviewed['id']+'/workbook',json={'revision':reviewed['revision']}).status_code==409


def test_country_findings_deduplicate_checks_but_keep_distinct_source_rows():
    findings = Findings()
    record = {'file': 'Template.xlsx', 'row': 2, 'identifier': '123', 'detail': 'France?'}
    findings.add('countries', 'Source review', [record])
    findings.add('countries', 'Batch inspection', [record, {**record, 'row': 3, 'identifier': '456'}])
    assert findings.result()['groups'][0]['count'] == 2


def test_preparation_preserves_tentative_country_as_blocking_reason(inputs):
    workbook(inputs['parent_reference'],['Issuing Entity','Basic UDI-DI code','Device Model',
        'Member States where device is or is to be made available on the market:'],[['GS1','PARENT','Model','France?']])
    original=inputs['parent_reference'].read_bytes()
    result=prepare_workbook(**inputs)
    rows=read_rows(result['workbook'],'To Register')+read_rows(result['workbook'],'Registered')
    assert all(UNCONFIRMED_COUNTRY_REASON in row['Review Reasons'] for row in rows)
    assert inputs['parent_reference'].read_bytes()==original


@pytest.mark.parametrize('location',['first_country','market_items'])
def test_runtime_readiness_and_projection_block_tentative_values_without_mutating_values(location):
    record=synthetic_record(0)
    if location=='market_items':record.market_availability_items=[MarketAvailabilityItemPreview(sequence=1,country='France?',original_placed_on_market=False)]
    else:
        field=record.fields[0].model_copy(update={'canonical_path':'device_record.market_availability.first_eu_market_country','value':'Germany?'})
        record.fields.append(field)
    before=deepcopy([f.model_dump() for f in record.fields]);items=deepcopy(record.market_availability_items)
    assert apply_market_country_readiness(record) and record.xml_readiness.status=='incomplete'
    count=len(record.xml_blockers);apply_market_country_readiness(record);assert len(record.xml_blockers)==count
    assert [f.model_dump() for f in record.fields]==before and record.market_availability_items==items
    with pytest.raises(ValueError,match='Confirm the country'):
        DeviceXmlProjectionBuilder().build_device_record(record)
    with pytest.raises(ValueError,match='Confirm the country'):
        DeviceXmlProjectionBuilder().build_market_info_record(record)


def test_stored_old_ready_flag_is_overlaid_readonly_and_completed_import_stays_completed(workflow,monkeypatch):
    client,service,fixture=workflow;prefix='/api/dev-input-batches/sessions'
    reviewed=checked(client,client.put(prefix+'/new',json=request(fixture).model_dump(mode='json')))
    ready=client.post(prefix+'/'+reviewed['id']+'/workbook',json={'revision':reviewed['revision']}).json()
    response=client.post(prefix+'/'+ready['id']+'/import',json={'revision':ready['revision'],'confirmed_by':'Synthetic RA','confirmed':True})
    assert response.status_code==200,response.text
    completed=response.json();database=fixture[-1].testing_state_db_path
    with sqlite3.connect(database) as c:
        row=c.execute('SELECT id,record_json FROM canonical_device_record ORDER BY id DESC LIMIT 1').fetchone()
        record=json.loads(row[1]);record['market_availability_items']=[{'sequence':1,'country':'France?','original_placed_on_market':False}]
        c.execute('UPDATE canonical_device_record SET record_json=? WHERE id=?',(json.dumps(record),row[0]))
    reader=WorkbookImportService();before=database.read_bytes()
    bundle=reader.canonical_validation_bundle_from_sqlite(import_batch_id=completed['result']['import_batch_id'])
    assert bundle.xml_blocked_records==1 and bundle.xml_ready_records==0
    assert bundle.records[0].xml_readiness.status=='incomplete'
    assert database.read_bytes()==before
    # Simulate a later policy/token version: a receipt is still completion, not permission to reimport.
    monkeypatch.setattr('app.services.import_workflow.POLICY_VERSION','future-policy')
    monkeypatch.setattr('app.services.dev_batch_preparation.POLICY_VERSION','future-policy')
    reopened=service.get(ready['id'])
    assert reopened['stage']=='complete' and reopened['result']['import_batch_id']==completed['result']['import_batch_id']
    assert database.read_bytes()==before
