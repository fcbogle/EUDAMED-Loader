"""Stored-data reports use synthetic exports and temporary SQLite only."""
import base64
from copy import deepcopy
from io import BytesIO
import json
import hashlib
from types import SimpleNamespace
import sqlite3

from fastapi import FastAPI
from fastapi.testclient import TestClient
from lxml import etree
from openpyxl import load_workbook
import pytest

from app.routers import ra_reporting as routes
from app.services.ra_reporting import StoredDeviceComparisonReport, ReportRequest
from app.services.production_workbook_preparation import NS
from test_dev_input_batches import project
from test_playground_reconciliation import reconciliation


def file(name, content):
    data = content if isinstance(content, bytes) else etree.tostring(content)
    return SimpleNamespace(name=name, content_base64=base64.b64encode(data).decode())


@pytest.fixture
def report_case(reconciliation):
    assessor, batch, snapshot, _ = reconciliation
    settings = assessor.settings
    with sqlite3.connect(settings.testing_state_db_path) as c:
        c.executescript('''CREATE TABLE import_batch(id INTEGER PRIMARY KEY);
        INSERT INTO import_batch VALUES(1);
        CREATE TABLE source_workbook(id INTEGER PRIMARY KEY,workbook_name TEXT,file_hash TEXT,loaded_at TEXT);
        INSERT INTO source_workbook VALUES(1,'Template.xlsx','source-hash','2026-10-24');
        CREATE TABLE source_row(id INTEGER PRIMARY KEY,source_workbook_id INTEGER);
        INSERT INTO source_row VALUES(1,1);
        ALTER TABLE canonical_device_record ADD COLUMN source_row_id INTEGER DEFAULT 1;
        ALTER TABLE canonical_device_record ADD COLUMN source_import_batch_id INTEGER DEFAULT 1;
        ''')
        raw = json.loads(c.execute('SELECT record_json FROM canonical_device_record').fetchone()[0])
        full = snapshot['device_record']
        raw.update(product_family='Synthetic family',product_variant='Synthetic model',catalogue_number='=CAT',
            primary_udi_di=full['primary_udi_di'],issuing_entity=full['issuing_entity'])
        raw['fields'].extend([{'canonical_path':'device_record.identifier','value':full['issuing_entity']+':'+full['primary_udi_di']},
            {'canonical_path':'device_record.trade_name','value':'Workbook proposed value — not accepted'}])
        c.execute('UPDATE canonical_device_record SET record_json=?',(json.dumps(raw),))
    extract = etree.parse(str(batch/'eudamed-xml/export.xml')).getroot()
    request = SimpleNamespace(extracts=[file('extract.xml',extract)],include_device_details=False)
    return settings, request, extract, snapshot


def generate(case):
    settings, request, *_ = case
    before = settings.testing_state_db_path.read_bytes()
    # Simulate Data Import's retained immutable manifest in this temporary fixture.
    batch=settings.dev_input_batch_root/'2026-10-25-001'
    for path in (batch/'eudamed-xml').iterdir():path.unlink()
    manifest=json.loads((batch/'manifest.json').read_text())
    manifest['files']=[item for item in manifest['files'] if item['role']!='eudamed-xml']
    for item in request.extracts:
        data=base64.b64decode(item.content_base64)
        (batch/'eudamed-xml'/item.name).write_bytes(data)
        manifest['files'].append({'role':'eudamed-xml','path':'eudamed-xml/'+item.name,'sha256':hashlib.sha256(data).hexdigest(),'size_bytes':len(data)})
    (batch/'manifest.json').write_text(json.dumps(manifest))
    report = StoredDeviceComparisonReport(settings).generate(ReportRequest(include_device_details=request.include_device_details))
    assert settings.testing_state_db_path.read_bytes() == before
    return report


def update(case, **values):
    with sqlite3.connect(case[0].testing_state_db_path) as c:
        c.execute('UPDATE testing_subjects SET '+','.join(k+'=?' for k in values)+' WHERE id=1',list(values.values()))


def test_stored_data_match_requires_no_outgoing_or_success_xml(report_case):
    report = generate(report_case)
    assert report['report_type']=='stored_device_comparison'
    assert report['models'][0]['exact']==1
    assert report['models'][0]['stored_available']==1
    assert not report['findings']
    assert report['details'][0]['state_source']=='Stored accepted device snapshot'
    assert 'Trade name' in report['comparison_fields']


def test_known_differences_are_grouped_without_using_proposed_workbook_values(report_case):
    _, request, extract, _ = report_case
    name = extract.find('.//{https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/Common/LanguageSpecific/v1}textValue')
    name.text='Externally changed name'
    request.extracts=[file('extract.xml',extract)]
    report=generate(report_case)
    assert report['models'][0]['different']==1
    finding=next(f for f in report['findings'] if f['finding']=='Trade name')
    assert finding['category']=='Attribute difference' and finding['affected']==1
    assert report['details'][0]['differences'][0]['stored'] != 'Workbook proposed value — not accepted'


def test_partial_snapshot_missing_fields_are_not_differences_or_zero_values(report_case):
    partial={'version':'2','trade_name':report_case[3]['trade_name']}
    update(report_case, latest_successful_state_json=json.dumps(partial),latest_successful_post_state_json=None)
    report=generate(report_case)
    assert report['models'][0]['unable']==1
    assert not report['details'][0]['differences']
    assert 'Sterile' in report['details'][0]['missing_fields']
    assert any(f['category']=='Missing stored data' for f in report['findings'])


def test_known_difference_stays_visible_when_other_stored_fields_are_missing(report_case):
    partial={'version':'2','trade_name':'Different accepted name'}
    update(report_case,latest_successful_state_json=json.dumps(partial),latest_successful_post_state_json=None)
    report=generate(report_case)
    assert report['models'][0]['different']==1
    assert report['details'][0]['missing_fields']
    assert report['details'][0]['differences'][0]['field']=='Trade name'


def test_missing_or_stale_accepted_state_never_falls_back_to_workbook_or_older_post(report_case):
    update(report_case,latest_successful_version='3',latest_successful_patch_version='3')
    report=generate(report_case)
    assert report['models'][0]['exact']==0
    assert report['models'][0]['unable']==1
    assert 'Trade name' in report['details'][0]['missing_fields']


def test_explicit_optional_null_and_false_zero_values_are_known(report_case):
    settings,request,extract,snapshot=report_case
    snapshot['device_record']['secondary_identifier_code']=None
    snapshot['device_record']['secondary_identifier_issuing_entity']=None
    udi=extract.find('message:payload/device:Device/device:MDRUDIDIData',NS)
    secondary=udi.find('udi:secondaryIdentifier',NS)
    if secondary is not None:udi.remove(secondary)
    request.extracts=[file('extract.xml',extract)]
    update(report_case,latest_successful_state_json=json.dumps(snapshot),latest_successful_post_state_json=json.dumps(snapshot))
    report=generate(report_case)
    assert report['models'][0]['exact']==1
    assert not report['details'][0]['missing_fields']


def test_latest_accepted_patch_and_independent_market_state_are_compared(report_case):
    _,request,extract,snapshot=report_case
    patched=deepcopy(snapshot);patched['version']='3';patched['device_record']['base_quantity']=99
    patched['base_quantity']=99
    update(report_case,latest_successful_patch_state_json=json.dumps(patched),latest_successful_patch_version='3',latest_successful_version='3')
    udi=extract.find('message:payload/device:Device/device:MDRUDIDIData',NS)
    udi.find('entity:version',NS).text='3';udi.find('udi:baseQuantity',NS).text='99'
    request.extracts=[file('extract.xml',extract)]
    assert generate(report_case)['models'][0]['exact']==1
    market={'version':'3','market_countries':deepcopy(snapshot['market_countries'])}
    market['market_countries'][0]['original_placed_on_market']=not market['market_countries'][0]['original_placed_on_market']
    update(report_case,latest_successful_market_info_version='3',latest_successful_market_info_state_json=json.dumps(market))
    report=generate(report_case)
    assert report['models'][0]['different']==1
    assert {d['field'] for d in report['details'][0]['differences']}=={'Market Info version','Market countries and original placement'}


def test_accepted_imported_baseline_is_valid_stored_data_without_submission_proof(report_case):
    settings,_,_,snapshot=report_case
    baseline={**snapshot,'accepted_state_source':'playground_export'}
    update(report_case,latest_successful_state_json=json.dumps(baseline),latest_successful_post_state_json=None)
    with sqlite3.connect(settings.testing_state_db_path) as c:
        c.execute('DELETE FROM testing_events')
        c.execute("INSERT INTO testing_events(id,subject_id,message_type,status,event_kind,accepted_state_source,state_after_json,event_index,tested_at) VALUES(1,1,'PLAYGROUND_EXPORT.SNAPSHOT','IMPORTED','BASELINE_IMPORT','playground_export',?,1,'2026-10-24T10:00:00Z')",(json.dumps(baseline),))
    report=generate(report_case)
    assert report['models'][0]['exact']==1
    assert report['details'][0]['state_source']=='playground_export'


def test_newer_database_activity_is_dated_context_not_upload_proof_requirement(report_case):
    settings,*_=report_case
    with sqlite3.connect(settings.testing_state_db_path) as c:
        c.execute("UPDATE testing_events SET tested_at='2026-11-07T10:00:00Z'")
    report=generate(report_case)
    assert report['models'][0]['exact']==1
    assert any(f['category']=='Evidence dates' for f in report['findings'])


def test_absent_extract_only_duplicate_and_incomplete_pages(report_case):
    _,request,extract,_=report_case
    ident=extract.find('message:payload/device:Device/device:MDRUDIDIData/udi:identifier/common:DICode',NS)
    ident.text='OTHER'
    request.extracts=[file('extract.xml',extract)]
    report=generate(report_case)
    assert report['models'][0]['absent']==1 and report['extract_only']==1
    extract.find('message:payload',NS).append(deepcopy(extract.find('message:payload/device:Device',NS)))
    request.extracts=[file('extract.xml',extract)]
    with pytest.raises(ValueError,match='Duplicate exported'):generate(report_case)
    extract.find('message:payload',NS).remove(extract.findall('message:payload/device:Device',NS)[1])
    extract.find('message:numberOfPages',NS).text='2'
    request.extracts=[file('extract.xml',extract)]
    with pytest.raises(ValueError,match='pages'):generate(report_case)


def test_optional_excel_detail_uses_stored_labels_and_literal_identifiers(report_case):
    report=generate(report_case)
    book=load_workbook(BytesIO(base64.b64decode(report['excel_base64'])))
    assert 'Requested device details' not in book.sheetnames
    assert book['Models']['D1'].value=='All compared attributes match'
    book.close()
    report_case[1].include_device_details=True
    book=load_workbook(BytesIO(base64.b64decode(generate(report_case)['excel_base64'])))
    sheet=book['Requested device details']
    assert sheet['E2'].value=='=CAT' and sheet['E2'].data_type=='s'
    assert 'Stored state source' in [cell.value for cell in sheet[1]]
    book.close()


def test_dev_route_and_production_denial_before_body_or_database(report_case,monkeypatch):
    settings,request,*_=report_case
    monkeypatch.setattr(routes,'get_settings',lambda:settings)
    app=FastAPI();app.include_router(routes.router,prefix='/api');client=TestClient(app)
    response=client.post('/api/reporting/device-comparison',json=ReportRequest().model_dump())
    assert response.status_code==200,response.text
    assert response.json()['models'][0]['exact']==1
    assert client.post('/api/reporting/device-comparison',json={'extracts':[]}).status_code==422
    monkeypatch.setattr(routes,'get_settings',lambda:settings.model_copy(update={'environment':'prod','testing_state_db_path':None}))
    assert client.post('/api/reporting/device-comparison',content='invalid').status_code==403


def test_wrong_manufacturer_schema_and_xml_entities_are_rejected(report_case):
    settings,request,extract,_=report_case
    extract.find('.//basic:MFActorCode',NS).text='OTHER-MF'
    request.extracts=[file('extract.xml',extract)]
    with pytest.raises(ValueError,match='manufacturer'):generate(report_case)
    extract.set('version','other')
    request.extracts=[file('extract.xml',extract)]
    with pytest.raises(ValueError,match='schema'):generate(report_case)
    request.extracts=[file('bad.xml',b'<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><x>&x;</x>')]
    with pytest.raises(ValueError,match='DOCTYPE'):generate(report_case)


def test_ambiguous_identity_never_combines_devices_or_their_stored_data(report_case):
    settings,*_=report_case
    with sqlite3.connect(settings.testing_state_db_path) as c:
        row=c.execute('SELECT record_json FROM canonical_device_record').fetchone()[0]
        c.execute('INSERT INTO canonical_device_record(id,device_subject_id,canonical_version,record_json) VALUES(2,2,1,?)',(row,))
    report=generate(report_case)
    assert report['models'][0]['total']==2
    assert report['models'][0]['unable']==2
    assert report['models'][0]['exact']==0


def test_no_active_database_snapshot_is_not_an_empty_successful_report(report_case):
    settings,*_=report_case
    with sqlite3.connect(settings.testing_state_db_path) as c:c.execute('DELETE FROM canonical_device_record')
    with pytest.raises(ValueError,match='no database device snapshot'):generate(report_case)


def test_success_history_newer_than_summary_flags_blocks_old_snapshot(report_case):
    settings,*_=report_case
    with sqlite3.connect(settings.testing_state_db_path) as c:
        c.execute("INSERT INTO testing_events(id,subject_id,message_type,status,version,tested_at) VALUES(2,1,'UDI_DI.PATCH','SUCCESS','3','2026-10-24T12:00:00Z')")
    report=generate(report_case)
    assert report['models'][0]['unable']==1
    assert report['models'][0]['exact']==0
    assert any('Latest recorded accepted device version' in f['finding'] for f in report['findings'])


def test_unaccepted_draft_and_error_do_not_replace_accepted_values(report_case):
    settings,*_=report_case
    with sqlite3.connect(settings.testing_state_db_path) as c:
        c.execute("INSERT INTO testing_events(id,subject_id,message_type,status,version,state_after_json) VALUES(2,1,'UDI_DI.PATCH','GENERATED','3',?)",(json.dumps({'version':'3','trade_name':'Unaccepted draft'}),))
        c.execute("INSERT INTO testing_events(id,subject_id,message_type,status,version) VALUES(3,1,'UDI_DI.PATCH','ERROR','3')")
    assert generate(report_case)['models'][0]['exact']==1


def test_country_flags_and_repeated_warning_relationships_are_not_flattened(report_case):
    _,_,_,snapshot=report_case
    state=deepcopy(snapshot)
    state['device_record']['critical_warnings']=[{'code':'CW010','comment':'A'},{'code':'CW011','comment':'B'}]
    state['critical_warnings']=state['device_record']['critical_warnings']
    update(report_case,latest_successful_state_json=json.dumps(state),latest_successful_post_state_json=json.dumps(state))
    report=generate(report_case)
    assert any(d['field']=='Critical warnings' for d in report['details'][0]['differences'])


def test_required_null_is_missing_data_but_explicit_optional_null_is_compared(report_case):
    snapshot=deepcopy(report_case[3])
    snapshot['device_record']['sterile']=None
    update(report_case,latest_successful_state_json=json.dumps(snapshot),latest_successful_post_state_json=json.dumps(snapshot))
    report=generate(report_case)
    assert report['models'][0]['unable']==1
    assert 'Sterile' in report['details'][0]['missing_fields']
    assert not report['details'][0]['differences']


def test_structured_sets_preserve_pairs_and_nomenclature_uses_schema_list_semantics():
    from app.services.ra_reporting import comparable
    countries=[{'country':'DE','original_placed_on_market':True},{'country':'FR','original_placed_on_market':False}]
    swapped=[{'country':'DE','original_placed_on_market':False},{'country':'FR','original_placed_on_market':True}]
    assert comparable('market_countries',countries)==comparable('market_countries',countries[::-1])
    assert comparable('market_countries',countries)!=comparable('market_countries',swapped)
    warnings=[{'code':'CW010','comment':'A'},{'code':'CW011','comment':'B'}]
    swapped=[{'code':'CW010','comment':'B'},{'code':'CW011','comment':'A'}]
    assert comparable('critical_warnings',warnings)!=comparable('critical_warnings',swapped)
    assert comparable('nomenclature_codes',['A','B'])==comparable('nomenclature_codes',['B A'])


def test_unsupported_multilingual_projection_is_not_a_false_trade_name_difference(report_case):
    _,request,extract,_=report_case
    names=extract.find('.//udi:tradeNames',NS)
    original=deepcopy(names[0])
    names[0].find('{https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/Common/LanguageSpecific/v1}textValue').text='Another translation'
    names.append(original)
    request.extracts=[file('extract.xml',extract)]
    report=generate(report_case)
    assert report['models'][0]['unable']==1
    assert not report['details'][0]['differences']
    assert any('Multiple accepted trade names' in issue for issue in report['details'][0]['issues'])
