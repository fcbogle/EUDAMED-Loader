"""Verified parent additions are information; conflicts and unknowns stay visible."""
from copy import deepcopy
import json
import pytest
from app.services.dev_workbook_import import DevWorkbookImporter
from app.services.import_review_policy import Findings

@pytest.fixture
def case():
    previous = {'basic_udi_di':'PARENT','record_json':json.dumps({'fields':[
        {'canonical_path':'basic_device.basic_udi_di','value':'PARENT'},
        {'canonical_path':'device_record.basic_udi_identifier','value':'GS1:PARENT'}]})}
    row = {'key':('GS1','00000000000001'), 'values':{'Proposed Basic UDI-DI':'PARENT','Proposed Parent Issuer':'GS1'}}
    fields = [{'field':'Basic UDI-DI','before':None,'after':'PARENT'}]
    return fields, previous, row

@pytest.mark.parametrize('before',[None,'','  '])
def test_only_verified_newly_explicit_parent_link_is_information(case,before):
    fields, previous, row = case;fields[0]['before']=before
    assert DevWorkbookImporter._informational_fields(fields,previous,row)==['Basic UDI-DI']

@pytest.mark.parametrize('problem',['stored_parent','canonical_parent','canonical_issuer','incoming_parent','incoming_issuer','old_value','other_field','empty_value','no_canonical'])
def test_unverified_additions_or_changed_values_are_not_information(case,problem):
    fields, previous, row=case
    canonical=json.loads(previous['record_json'])
    if problem=='stored_parent':previous['basic_udi_di']='OTHER'
    elif problem=='canonical_parent':canonical['fields'][0]['value']='OTHER'
    elif problem=='canonical_issuer':canonical['fields'][1]['value']='HIBC:PARENT'
    elif problem=='incoming_parent':row['values']['Proposed Basic UDI-DI']='OTHER'
    elif problem=='incoming_issuer':row['values']['Proposed Parent Issuer']='HIBC'
    elif problem=='old_value':fields[0]['before']='OLD'
    elif problem=='other_field':fields[0]['field']='Trade Name'
    elif problem=='empty_value':fields[0]['after']=''
    else:canonical['fields']=[]
    previous['record_json']=json.dumps(canonical)
    assert DevWorkbookImporter._informational_fields(fields,previous,row)==[]


def record(udi='00000000000001',model='Linx',issuer='GS1'):
    return {'issuer':issuer,'udi_di':udi,'catalogue':'CODE','product_family':'Family','product_variant':model,
            'basic_udi_di':'PARENT','informational_fields':['Basic UDI-DI'],
            'fields':[{'field':'Basic UDI-DI','before':None,'after':'PARENT'}]}


def test_information_counts_distinct_issuer_qualified_devices_and_all_models():
    findings=Findings()
    findings.add_source_differences([record(),record(),record(issuer='HIBC'),record('00000000000002','Elite Blade')])
    result=findings.result();group=result['groups'][0]
    assert result['message']=='Ready to continue — additional source information' and result['can_create']
    assert group['severity']=='info' and group['count']==3
    assert group['models']==[{'product_family':'Family','product_variant':'Elite Blade','device_count':1},
                             {'product_family':'Family','product_variant':'Linx','device_count':2}]
    assert len(group['records'])==4  # Full source occurrences remain auditable.


def test_mixed_information_and_difference_preserve_warning_values():
    item=record();item['fields'].append({'field':'Catalogue','before':'OLD','after':'NEW'})
    findings=Findings();findings.add_source_differences([item]);result=findings.result()
    assert result['can_create'] and result['message']=='Ready to continue — warnings found'
    info,warning=result['groups']
    assert info['severity']=='info' and [f['field'] for f in info['records'][0]['fields']]==['Basic UDI-DI']
    assert warning['severity']=='warn' and warning['records'][0]['fields']==[item['fields'][1]]
    findings.add('identity','Database',[{'identifier':'ambiguous'}]);assert not findings.result()['can_create']
    assert findings.result()['message']=='Source corrections required'


def test_unverified_missing_field_remains_warning():
    item=record();item['informational_fields']=[]
    findings=Findings();findings.add_source_differences([item]);result=findings.result()
    assert result['groups'][0]['severity']=='warn'


@pytest.fixture
def catalogue_case():
    from types import SimpleNamespace
    from app.services.canonical_validation import CATALOGUE_HEADERS
    header=CATALOGUE_HEADERS[0]
    stored={'primary_udi_di':'00000000000001','issuing_entity':'GS1','catalogue_number':'NEW',
            'fields':[{'canonical_path':'device_record.catalogue_number','value':'NEW'}]}
    previous={'primary_udi_di':'00000000000001','product_family':'Family','product_variant':'Model',
              'catalogue_number':'NEW','source_catalogue_number':'NEW','catalogue_value_json':json.dumps('NEW'),
              'record_json':json.dumps(stored)}
    row={'key':('GS1','00000000000001'),'record':SimpleNamespace(product_family='Family',product_variant='Model',catalogue_number='NEW')}
    return [{'field':header,'before':'OLD','after':'NEW'}],previous,row


@pytest.mark.parametrize('prefix',['','Proposed: '])
def test_applied_catalogue_correction_requires_current_projection_agreement(catalogue_case,prefix):
    fields,previous,row=catalogue_case;fields[0]['field']=prefix+fields[0]['field']
    assert DevWorkbookImporter._applied_correction_fields(fields,previous,row)==[fields[0]['field']]


@pytest.mark.parametrize('problem',['device_catalogue','source_catalogue','canonical_root','canonical_field',
    'field_table','missing_field_table','invalid_field_table','issuer','canonical_device','stored_device','incoming_catalogue',
    'family','model','missing_before','unchanged','unknown_field'])
def test_uncertain_or_unapplied_catalogue_changes_stay_warnings(catalogue_case,problem):
    fields,previous,row=catalogue_case;stored=json.loads(previous['record_json'])
    if problem=='device_catalogue':previous['catalogue_number']='OLD'
    elif problem=='source_catalogue':previous['source_catalogue_number']='OLD'
    elif problem=='canonical_root':stored['catalogue_number']='OLD'
    elif problem=='canonical_field':stored['fields'][0]['value']='OLD'
    elif problem=='field_table':previous['catalogue_value_json']=json.dumps('OLD')
    elif problem=='missing_field_table':previous['catalogue_value_json']=None
    elif problem=='invalid_field_table':previous['catalogue_value_json']='not JSON'
    elif problem=='issuer':stored['issuing_entity']='HIBC'
    elif problem=='canonical_device':stored['primary_udi_di']='00000000000002'
    elif problem=='stored_device':previous['primary_udi_di']='00000000000002'
    elif problem=='incoming_catalogue':row['record'].catalogue_number='OTHER'
    elif problem=='family':row['record'].product_family='Other'
    elif problem=='model':row['record'].product_variant='Other'
    elif problem=='missing_before':fields[0]['before']=None
    elif problem=='unchanged':fields[0]['before']='NEW'
    else:fields[0]['field']='Trade name'
    previous['record_json']=json.dumps(stored)
    assert DevWorkbookImporter._applied_correction_fields(fields,previous,row)==[]


def test_applied_corrections_are_separate_green_information_with_before_after_retained(catalogue_case):
    fields,_,_=catalogue_case;item=record();item['fields']+=fields
    item['applied_correction_fields']=[fields[0]['field']]
    findings=Findings();findings.add_source_differences([item]);result=findings.result()
    assert result['can_create'] and all(g['severity']=='info' for g in result['groups'])
    applied=next(g for g in result['groups'] if g['code']=='applied_corrections')
    assert applied['title']=='Source correction already applied' and applied['count']==1
    assert applied['records'][0]['fields']==fields
    assert 'No action required' in applied['action']
