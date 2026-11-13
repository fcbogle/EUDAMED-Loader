"""Immutable input receipt remains an internal helper; there is no bypass HTTP endpoint."""
import base64
import json
import sqlite3
import pytest
from pydantic import ValidationError
from app.services.source_batch_receipt import ReceiptRequest,receive_batch
from app.services.source_batch_review import review_sources
from test_dev_batch_preparation import setup
from test_dev_input_batches import project


def payload(project):
    files=[]
    for role,path in [('templates',project/'data/source_excel/Template.xlsx'),('basic-udi',project/'data/basic_udi_reference/BasicUDIs.xlsx'),('eudamed-xml',project/'data/downloads/export.xml')]:
        files.append({'role':role,'name':'Parent reference.xlsx' if role=='basic-udi' else path.name,'content_base64':base64.b64encode(path.read_bytes()).decode()})
    return {'metadata':{'creator':{'name':'Operator','email':'operator@example.test','team_role':'RA'},'description':'Synthetic receipt'},'files':files}


def test_exact_copies_attribution_and_preparation_never_open_database(setup,project,monkeypatch):
    _,service,old,sentinel,_=setup
    def no_database(*a,**k):raise AssertionError('Receipt/preparation must not open a database')
    with monkeypatch.context() as guard:
        guard.setattr(sqlite3,'connect',no_database)
        result=receive_batch(service,ReceiptRequest.model_validate(payload(project)))
        root=old.parent/result['batch_id']
        assert (root/'templates/Template.xlsx').read_bytes()==(project/'data/source_excel/Template.xlsx').read_bytes()
        manifest=json.loads((root/'manifest.json').read_text());reference=next(e for e in manifest['files'] if e['role']=='basic-udi')
        assert reference['path']=='basic-udi/BasicUDIs.xlsx' and reference['original_name']=='Parent reference.xlsx'
        assert result['receipt']['creator']['email']=='operator@example.test'
        checked=service.inspect(result['batch_id']);prepared=service.prepare(result['batch_id'],checked['inspection_token'])
        assert service.artifact(result['batch_id'],prepared['artifact_id'])[1].is_file()
        assert sentinel.read_bytes()==b'operational database must not be opened'


@pytest.mark.parametrize('problem',['path','duplicate','invalid_base64','wrong_format','wrong_actor','acknowledgement','missing_role'])
def test_invalid_input_never_publishes_partial_batch(setup,project,problem):
    _,service,old,_,_=setup;data=payload(project)
    if problem=='path':data['files'][0]['name']='../Template.xlsx'
    elif problem=='duplicate':data['files'].append(data['files'][0])
    elif problem=='invalid_base64':data['files'][0]['content_base64']='bad!'
    elif problem=='wrong_format':data['files'][0]['content_base64']=base64.b64encode(b'bad Excel').decode()
    elif problem=='wrong_actor':data['files'][2]['content_base64']=base64.b64encode(base64.b64decode(data['files'][2]['content_base64']).replace(b'GB-MF-000000001',b'WRONG')).decode()
    elif problem=='acknowledgement':data['files'][2]['content_base64']=base64.b64encode(b'<Acknowledgement/>').decode()
    else:data['files']=data['files'][:2]
    before={p.name for p in old.parent.iterdir()}
    with pytest.raises((ValueError,ValidationError)):receive_batch(service,ReceiptRequest.model_validate(data))
    assert {p.name for p in old.parent.iterdir()}==before


def test_each_receipt_is_distinct(setup,project):
    _,service,*_=setup
    first=receive_batch(service,ReceiptRequest.model_validate(payload(project)))
    second=receive_batch(service,ReceiptRequest.model_validate(payload(project)))
    assert first['batch_id']!=second['batch_id']


def test_full_duplicate_evidence_is_retained_in_source_analysis(setup,project):
    from test_production_workbook_preparation import workbook
    _,service,old,_,_=setup
    workbook(project/'data/source_excel/Template.xlsx',['Issuing Entity e.g. GS1','UDI-DI code','Basic UDI-DI'],[['GS1','00000000000001','PARENT']]*25)
    batch=receive_batch(service,ReceiptRequest.model_validate(payload(project)))
    review=review_sources(old.parent/batch['batch_id'],())
    group=next(g for g in review['groups'] if g['title']=='Repeated Device UDI-DI')
    assert len(group['records'])==25 and group['records'][0]['file']=='Template.xlsx'
