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


def generate(case, *, summary_only=False):
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
    report = StoredDeviceComparisonReport(settings).generate(ReportRequest(include_device_details=request.include_device_details, summary_only=summary_only))
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
    assert next(row for row in report['models'] if row['total'])['absent']==1 and report['extract_only']==1
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


@pytest.fixture
def current_case(report_case):
    from scripts.benchmark_xml import synthetic_record
    raw = synthetic_record(0).model_dump(mode='json')
    raw.update(product_family='Synthetic family', product_variant='Synthetic model')
    # An explicitly stored empty optional attribute differs from an unknown field.
    for path in ('device_record.production_identifier', 'device_record.secondary_identifier'):
        raw['fields'].append({'canonical_path': path, 'value': None})
    with sqlite3.connect(report_case[0].testing_state_db_path) as connection:
        connection.execute('UPDATE canonical_device_record SET record_json=?', (json.dumps(raw),))
    return report_case


def edit_current(case, values=None, **record_changes):
    with sqlite3.connect(case[0].testing_state_db_path) as connection:
        raw = json.loads(connection.execute('SELECT record_json FROM canonical_device_record').fetchone()[0])
        for field in raw['fields']:
            if field['canonical_path'] in (values or {}):
                field['value'] = values[field['canonical_path']]
        raw.update(record_changes)
        connection.execute('UPDATE canonical_device_record SET record_json=?', (json.dumps(raw),))


def test_model_summary_is_green_only_for_complete_agreement_and_contains_no_device_rows(current_case):
    current_case[1].include_device_details = True  # Summary always overrides detail export.
    report = generate(current_case, summary_only=True)
    model = report['models'][0]
    assert model['matching'] == model['total'] == 1
    assert model['exceptions'] == model['extract_only'] == 0
    assert model['status'] == 'match'
    assert report['details'] == report['findings'] == []
    assert current_case[3]['device_record']['primary_udi_di'] not in json.dumps(report)
    book = load_workbook(BytesIO(base64.b64decode(report['excel_base64'])))
    assert book.sheetnames == ['Context', 'Models']
    assert book['Models'].max_row == 2
    book.close()


def test_model_summary_counts_affected_devices_once_for_multiple_differences(current_case):
    edit_current(current_case, {'device_record.trade_name': 'Different name', 'device_record.catalogue_number': 'Other reference'})
    model = generate(current_case, summary_only=True)['models'][0]
    assert model['exceptions'] == 1 and model['matching'] == 0 and model['status'] == 'exceptions'


def test_model_summary_missing_data_stays_amber(current_case):
    edit_current(current_case, {'device_record.sterile': None})
    model = generate(current_case, summary_only=True)['models'][0]
    assert model['exceptions'] == 1 and model['matching'] == 0 and model['status'] == 'exceptions'


def test_eudamed_only_device_makes_an_otherwise_matching_model_amber(current_case):
    _, request, extract, _ = current_case
    payload = extract.find('message:payload', NS)
    extra = deepcopy(payload[0])
    extra.find('device:MDRUDIDIData/udi:identifier/common:DICode', NS).text = 'EXTRACT_ONLY'
    payload.append(extra)
    request.extracts = [file('extract.xml', extract)]
    report = generate(current_case, summary_only=True)
    assert len(report['models']) == 1
    model = report['models'][0]
    assert model['matching'] == model['total'] == 1 and model['exceptions'] == 0
    assert model['extract_only'] == 1 and model['status'] == 'exceptions'
    assert sum(row['extract_only'] for row in report['models']) == report['extract_only']


def test_unlinked_eudamed_models_remain_visible_in_summary(current_case):
    _, request, extract, _ = current_case
    extract.find('message:payload/device:Device/device:MDRUDIDIData/udi:identifier/common:DICode', NS).text = 'EXTRACT_ONLY'
    extract.find('message:payload/device:Device/device:MDRUDIDIData/udi:basicUDIIdentifier/common:DICode', NS).text = 'OTHER_PARENT'
    extract.find('message:payload/device:Device/device:MDRBasicUDI/basic:identifier/common:DICode', NS).text = 'OTHER_PARENT'
    request.extracts = [file('extract.xml', extract)]
    report = generate(current_case, summary_only=True)
    assert len(report['models']) == 2
    assert sum(row['total'] for row in report['models']) == 1
    assert sum(row['exceptions'] for row in report['models']) == 0
    assert sum(row['extract_only'] for row in report['models']) == 1
    assert {row['status'] for row in report['models']} == {'not_compared', 'exceptions'}


def test_current_summary_matches_without_any_submission_history(current_case):
    with sqlite3.connect(current_case[0].testing_state_db_path) as connection:
        connection.execute('DROP TABLE testing_events')
        connection.execute('DROP TABLE testing_subjects')
    report = generate(current_case, summary_only=True)
    assert report['models'][0]['status'] == 'match'
    assert 'current stored device data' in report['comparison_basis_label']
    assert 'Device version' not in report['comparison_fields']
    assert 'Market Info version' not in report['comparison_fields']


def test_current_summary_detects_current_change_even_when_accepted_snapshot_matches(current_case):
    assert generate(current_case, summary_only=True)['models'][0]['matching'] == 1
    edit_current(current_case, {'device_record.trade_name': 'Current database edit'})
    model = generate(current_case, summary_only=True)['models'][0]
    assert model['different'] == model['exceptions'] == 1
    assert model['matching'] == 0


def test_old_accepted_changes_do_not_override_matching_current_values(current_case):
    snapshot = deepcopy(current_case[3])
    snapshot['device_record']['trade_name'] = 'Old accepted name'
    update(current_case, latest_successful_state_json=json.dumps(snapshot), latest_successful_post_state_json=None)
    assert generate(current_case, summary_only=True)['models'][0]['status'] == 'match'


@pytest.mark.parametrize('path,value', [
    ('device_record.sterile', 'uncertain'),
    ('device_record.number_of_reuses', '1.5'),
    ('device_record.base_quantity', '-1'),
    ('device_record.basic_udi_identifier', 'NO_ISSUER'),
])
def test_invalid_current_attributes_remain_amber(current_case, path, value):
    edit_current(current_case, {path: value})
    model = generate(current_case, summary_only=True)['models'][0]
    assert model['exceptions'] == 1 and model['matching'] == 0


def test_missing_current_optional_field_is_not_filled_from_accepted_xml(current_case):
    with sqlite3.connect(current_case[0].testing_state_db_path) as connection:
        raw = json.loads(connection.execute('SELECT record_json FROM canonical_device_record').fetchone()[0])
        raw['fields'] = [field for field in raw['fields'] if field['canonical_path'] != 'device_record.production_identifier']
        connection.execute('UPDATE canonical_device_record SET record_json=?', (json.dumps(raw),))
    model = generate(current_case, summary_only=True)['models'][0]
    assert model['unable'] == model['exceptions'] == 1


@pytest.mark.parametrize('countries', [
    [{'sequence': 1, 'country': 'Germany?', 'original_placed_on_market': True}],
    [{'sequence': 1, 'country': 'DE', 'original_placed_on_market': False}],
    [],
])
def test_market_uncertainty_and_placement_differences_prevent_green(current_case, countries):
    edit_current(current_case, market_availability_items=countries)
    model = generate(current_case, summary_only=True)['models'][0]
    assert model['exceptions'] == 1 and model['status'] == 'exceptions'


def test_current_structured_items_require_codes_and_preserve_comments(current_case):
    edit_current(current_case, storage_condition_items=[{'normalized_code': None, 'description': 'Not mapped'}])
    assert generate(current_case, summary_only=True)['models'][0]['unable'] == 1
    edit_current(current_case, storage_condition_items=[{'normalized_code': 'STC001', 'description': 'Stored condition'}])
    assert generate(current_case, summary_only=True)['models'][0]['different'] == 1


def test_current_country_and_language_aliases_use_existing_projection_conventions(current_case):
    edit_current(current_case, {'device_record.number_of_reuses': '00'}, market_availability_items=[
        {'sequence': 1, 'country': 'Germany', 'original_placed_on_market': True}])
    assert generate(current_case, summary_only=True)['models'][0]['status'] == 'match'


def test_schema_reuse_not_applicable_sentinel_is_a_known_current_value(current_case):
    _, request, extract, _ = current_case
    extract.find('message:payload/device:Device/device:MDRUDIDIData/udi:numberOfReuses', NS).text = '-1'
    request.extracts = [file('extract.xml', extract)]
    edit_current(current_case, {'device_record.number_of_reuses': '-1'})
    assert generate(current_case, summary_only=True)['models'][0]['status'] == 'match'
    edit_current(current_case, {'device_record.number_of_reuses': '-2'})
    assert generate(current_case, summary_only=True)['models'][0]['unable'] == 1


@pytest.mark.parametrize('separate_model', [False, True])
def test_devices_awaiting_registration_are_coverage_not_data_exceptions(current_case, separate_model):
    from scripts.benchmark_xml import synthetic_record
    raw = synthetic_record(1, parent='PENDING_BASIC').model_dump(mode='json')
    raw.update(product_family='Pending family' if separate_model else 'Synthetic family',
               product_variant='Pending model' if separate_model else 'Synthetic model')
    with sqlite3.connect(current_case[0].testing_state_db_path) as connection:
        connection.execute('INSERT INTO device_subject VALUES(2,?,?)', (raw['primary_udi_di'], 'PENDING_BASIC'))
        connection.execute('INSERT INTO canonical_device_record(id,device_subject_id,canonical_version,record_json) VALUES(2,2,1,?)', (json.dumps(raw),))
    report = generate(current_case, summary_only=True)
    assert sum(row['compared'] for row in report['models']) == 1
    assert sum(row['matching'] for row in report['models']) == 1
    assert sum(row['exceptions'] for row in report['models']) == 0
    assert sum(row['absent'] for row in report['models']) == 1
    for row in report['models']:
        assert row['total'] == row['compared'] + row['absent'] + row['unresolved']
        assert row['compared'] == row['matching'] + row['exceptions']
    if separate_model:
        pending = next(row for row in report['models'] if row['model'] == 'Pending model')
        assert pending['status'] == 'not_compared' and pending['compared'] == 0
    else:
        assert report['models'][0]['status'] == 'match'
        assert report['models'][0]['total'] == 2
    book = load_workbook(BytesIO(base64.b64decode(report['excel_base64'])))
    headers = [cell.value for cell in book['Models'][1]]
    assert 'Compared' in headers and 'Data exceptions' in headers and 'Not in extract' in headers
    book.close()


@pytest.fixture
def production_case(current_case, tmp_path):
    import shutil
    from pathlib import Path
    generate(current_case, summary_only=True)
    original = current_case[0]
    root = tmp_path / 'production'
    root.mkdir()
    database = root / 'application.sqlite3'
    shutil.copyfile(original.testing_state_db_path, database)
    batch = root / 'import-batches/2026-10-25-001'
    shutil.copytree(original.dev_input_batch_root / batch.name, batch)
    manifest_path = batch / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['environment'] = 'prod'
    for item in manifest['files']:
        if item['role'] != 'eudamed-xml':
            continue
        path = batch / item['path']
        xml = etree.fromstring(path.read_bytes())
        xml.set('version', '3.0.30')
        data = etree.tostring(xml)
        path.write_bytes(data)
        item.update(sha256=hashlib.sha256(data).hexdigest(), size_bytes=len(data))
    manifest_path.write_text(json.dumps(manifest))
    schema = Path(__file__).resolve().parents[2] / 'data/schema_profiles/prod-3.0.30'
    return original.model_copy(update={'environment': 'prod', 'data_root': root,
        'testing_state_db_path': database, 'testing_state_backup_dir': root / 'backups',
        'schema_dir': schema, 'eudamed_message_schema_version': '3.0.30'})


def test_production_summary_routes_are_readonly_and_keep_retired_reports_closed(production_case, monkeypatch):
    settings = production_case
    before = settings.testing_state_db_path.read_bytes()
    inventory = set(settings.data_root.rglob('*'))
    connect = sqlite3.connect
    def readonly(database, *args, **kwargs):
        assert kwargs.get('uri') and str(database).endswith('?mode=ro')
        return connect(database, *args, **kwargs)
    with monkeypatch.context() as patches:
        patches.setattr(sqlite3, 'connect', readonly)
        patches.setattr(routes, 'get_settings', lambda: settings)
        app = FastAPI()
        app.include_router(routes.router)
        with TestClient(app) as client:
            source = client.get('/reporting/device-comparison/source')
            assert source.status_code == 200 and source.json()['environment'] == 'prod'
            assert source.json()['available']
            response = client.post('/reporting/device-comparison', json={'summary_only': True})
            assert response.status_code == 200, response.text
            report = response.json()
            assert report['comparison_basis'] == 'current_device_data'
            assert report['environment'] == 'prod'
            assert report['models'][0]['status'] == 'match'
            assert report['models'][0]['matching'] == 1
            assert report['details'] == report['findings'] == []
            book = load_workbook(BytesIO(base64.b64decode(report['excel_base64'])))
            assert book.sheetnames == ['Context', 'Models']
            book.close()
            assert client.post('/reporting/device-comparison', json={}).status_code == 403
            assert client.post('/reporting/submission-activity', json={}).status_code == 403
        assert settings.testing_state_db_path.read_bytes() == before
        assert set(settings.data_root.rglob('*')) == inventory


def test_production_does_not_fall_back_to_dev_extracts(production_case):
    import shutil
    from app.services.retained_eudamed_extracts import RetainedEudamedExtracts
    shutil.rmtree(production_case.data_root / 'import-batches')
    assert production_case.dev_input_batch_root.exists()
    assert not RetainedEudamedExtracts(production_case).status()['available']
    with pytest.raises(ValueError):
        StoredDeviceComparisonReport(production_case).generate(ReportRequest(summary_only=True))


def test_production_report_rejects_database_outside_its_data_root(production_case, tmp_path):
    outside = production_case.model_copy(update={'testing_state_db_path': tmp_path / 'outside.sqlite3'})
    with pytest.raises(PermissionError):
        StoredDeviceComparisonReport(outside)
    assert not outside.testing_state_db_path.exists()



def test_production_missing_database_is_reported_without_creating_it(production_case, monkeypatch):
    production_case.testing_state_db_path.unlink()
    monkeypatch.setattr(routes, 'get_settings', lambda: production_case)
    app = FastAPI()
    app.include_router(routes.router)
    with TestClient(app) as client:
        assert client.get('/reporting/device-comparison/source').status_code == 409
        assert client.post('/reporting/device-comparison', json={'summary_only': True}).status_code == 409
    assert not production_case.testing_state_db_path.exists()
