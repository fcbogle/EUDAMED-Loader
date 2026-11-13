"""Automatic extract selection reads temporary Data Import manifests only."""
from copy import deepcopy
import hashlib
import json
import shutil
import sqlite3

from fastapi import FastAPI
from fastapi.testclient import TestClient
from lxml import etree
import pytest

from app.routers import ra_reporting as routes
from app.services.retained_eudamed_extracts import RetainedEudamedExtracts
from test_dev_input_batches import project
from test_playground_reconciliation import reconciliation
from test_ra_reporting import report_case
from app.services.production_workbook_preparation import NS


def change_xml(batch, change):
    manifest=json.loads((batch/'manifest.json').read_text())
    for item in manifest['files']:
        if item['role']!='eudamed-xml':continue
        path=batch/item['path'];root=etree.fromstring(path.read_bytes());change(root)
        data=etree.tostring(root);path.write_bytes(data)
        item.update(sha256=hashlib.sha256(data).hexdigest(),size_bytes=len(data))
    (batch/'manifest.json').write_text(json.dumps(manifest))


def clone(case, name, date):
    root=case[0].dev_input_batch_root
    batch=root/name
    shutil.copytree(root/'2026-10-25-001',batch)
    manifest=json.loads((batch/'manifest.json').read_text());manifest['batch_id']=name
    (batch/'manifest.json').write_text(json.dumps(manifest))
    change_xml(batch,lambda xml:setattr(xml.find('message:creationDateTime',NS),'text',date))
    return batch


def test_selection_uses_export_date_not_directory_name_and_never_opens_database(report_case,monkeypatch):
    settings,*_=report_case
    clone(report_case,'2026-11-08-001','2026-10-20T10:00:00Z')
    before=settings.testing_state_db_path.read_bytes()
    with monkeypatch.context() as check:
        check.setattr(sqlite3,'connect',lambda *args,**kwargs:(_ for _ in ()).throw(AssertionError('Source selection must not open SQLite')))
        result=RetainedEudamedExtracts(settings).select()
    assert result['selected']['batch_id']=='2026-10-25-001'
    assert result['selected']['complete_pages']
    assert settings.testing_state_db_path.read_bytes()==before


def test_latest_suitable_set_selected_and_newer_incomplete_set_explained(report_case):
    settings,*_=report_case
    clone(report_case,'2026-11-01-001','2026-11-01T10:00:00Z')
    incomplete=clone(report_case,'2026-11-08-001','2026-11-08T10:00:00Z')
    change_xml(incomplete,lambda xml:setattr(xml.find('message:numberOfPages',NS),'text','2'))
    result=RetainedEudamedExtracts(settings).select()
    assert result['selected']['batch_id']=='2026-11-01-001'
    assert result['excluded_sets'][0]['batch_id']=='2026-11-08-001'
    assert 'pages' in result['excluded_sets'][0]['reason']
    assert result['selected']['set_sha256']


def test_identical_copies_are_one_observation_but_conflicting_same_date_sets_block(report_case):
    settings,*_=report_case
    copied=clone(report_case,'2026-11-08-001','2026-10-25T10:00:00Z')
    # Exact original bytes, including prefixes and XML declaration, retain the same digest.
    original=settings.dev_input_batch_root/'2026-10-25-001'
    manifest=json.loads((copied/'manifest.json').read_text())
    original_manifest=json.loads((original/'manifest.json').read_text())
    for item in original_manifest['files']:
        if item['role']=='eudamed-xml':
            (copied/item['path']).write_bytes((original/item['path']).read_bytes())
            manifest['files']=[old for old in manifest['files'] if old['role']!='eudamed-xml']+[item]
    (copied/'manifest.json').write_text(json.dumps(manifest))
    result=RetainedEudamedExtracts(settings).select()
    assert result['available'] and len(result['selected']['retained_batches'])==2
    change_xml(copied,lambda xml:setattr(xml.find('.//udi:referenceNumber',NS),'text','Conflicting reference'))
    result=RetainedEudamedExtracts(settings).select()
    assert not result['available'] and 'Conflicting' in result['reason']


@pytest.mark.parametrize('change',['missing','changed','redirected','unlisted'])
def test_unusable_sources_are_unavailable_not_empty_reports(report_case,change):
    settings,*_=report_case
    batch=settings.dev_input_batch_root/'2026-10-25-001'
    xml=next((batch/'eudamed-xml').glob('*.xml'))
    if change=='missing':xml.unlink()
    elif change=='changed':xml.write_bytes(xml.read_bytes()+b' ')
    elif change=='redirected':
        elsewhere=batch.parent/'elsewhere.xml';xml.rename(elsewhere);xml.symlink_to(elsewhere)
    else:(batch/'eudamed-xml/unlisted.xml').write_bytes(xml.read_bytes())
    result=RetainedEudamedExtracts(settings).status()
    assert result['available'] is False and result['selected'] is None
    assert result['excluded_sets']
    assert 'Data Import' in result['reason']


def test_no_merging_pages_between_retained_batches(report_case):
    settings,*_=report_case
    first=settings.dev_input_batch_root/'2026-10-25-001'
    second=clone(report_case,'2026-11-01-001','2026-11-01T10:00:00Z')
    for batch,page in ((first,'0'),(second,'1')):
        def modify(xml):
            xml.find('message:numberOfPages',NS).text='2'
            xml.find('message:pageNumber',NS).text=page
        change_xml(batch,modify)
    result=RetainedEudamedExtracts(settings).select()
    assert not result['available'] and len(result['excluded_sets'])==2


def test_source_endpoint_is_readonly_and_upload_fields_are_rejected(report_case,monkeypatch):
    settings,*_=report_case
    monkeypatch.setattr(routes,'get_settings',lambda:settings)
    app=FastAPI();app.include_router(routes.router,prefix='/api');client=TestClient(app)
    response=client.get('/api/reporting/device-comparison/source')
    assert response.status_code==200 and response.json()['available']
    assert response.headers['cache-control']=='no-store'
    assert 'exported' not in response.json()
    assert client.post('/api/reporting/device-comparison',json={'extracts':[]}).status_code==422
    report=client.post('/api/reporting/device-comparison',json={'include_device_details':False})
    assert report.status_code==200,report.text
    assert report.json()['extract_source']['batch_id']=='2026-10-25-001'
    monkeypatch.setattr(routes,'get_settings',lambda:settings.model_copy(update={'environment':'prod','testing_state_db_path':None}))
    assert client.get('/api/reporting/device-comparison/source').status_code==403


def test_unpublished_review_folders_are_not_selected_and_empty_storage_is_explained(report_case):
    settings,*_=report_case
    root=settings.dev_input_batch_root
    (root/'source-reviews').mkdir()
    shutil.rmtree(root/'2026-10-25-001')
    result=RetainedEudamedExtracts(settings).status()
    assert not result['available'] and 'Data Import' in result['reason']


def test_unrelated_template_corrections_do_not_change_xml_selection(report_case):
    settings,*_=report_case
    batch=settings.dev_input_batch_root/'2026-10-25-001'
    next((batch/'templates').iterdir()).write_text('Template awaiting source correction')
    assert RetainedEudamedExtracts(settings).status()['available']


def test_malformed_manifest_is_explained_as_unavailable(report_case):
    settings,*_=report_case
    (settings.dev_input_batch_root/'2026-10-25-001/manifest.json').write_text('[]')
    result=RetainedEudamedExtracts(settings).status()
    assert not result['available']
    assert result['excluded_sets'][0]['reason']=='Retained set manifest is malformed'
