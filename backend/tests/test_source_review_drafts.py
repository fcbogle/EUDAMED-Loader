"""Persistent correction/resume workflow with only synthetic files and temporary databases."""
import base64
import json
import sqlite3
from pathlib import Path

import pytest
from app.services.source_review_drafts import SourceReviewDrafts, DraftRequest
from app.services.dev_input_batches import fingerprint
from test_dev_workbook_import import dev_import, production
from test_production_workbook_preparation import workbook


def request(fixture):
    _,_,_,_,root,_=fixture
    # The export and Template must cover the same device for a clean source review.
    workbook(root/'data/source_excel/Template.xlsx',
        ['Issuing Entity e.g. GS1','UDI-DI code','Basic UDI-DI','Reference/ Catalogue number e.g . Taken from Product code in second page of DoC'],
        [['GS1','99000000000000','BASICSHARED','SYN-000000']],sheet='Synthetic model')
    files=[]
    for role,path in [('templates',root/'data/source_excel/Template.xlsx'),('basic-udi',root/'data/basic_udi_reference/BasicUDIs.xlsx'),('eudamed-xml',root/'downloads/export.xml')]:
        files.append({'role':role,'name':path.name,'content_base64':base64.b64encode(path.read_bytes()).decode()})
    return DraftRequest.model_validate({'metadata':{'creator':{'name':'Operator','email':'operator@example.test','team_role':'RA'},
        'description':'Synthetic correction review','source_date':'2026-10-30','export_date':'2026-10-30','complete_scope_confirmed':True},'files':files})


def test_draft_survives_restart_replacements_preserve_unaffected_files_and_history(dev_import):
    settings=dev_import[-1];req=request(dev_import)
    drafts=SourceReviewDrafts(settings)
    before=settings.testing_state_db_path.read_bytes()
    initial=drafts.save(req);identifier=initial['draft_id']
    resumed=SourceReviewDrafts(settings).describe(identifier)
    assert resumed['metadata']['creator']['email']=='operator@example.test'
    assert len(resumed['files'])==3 and resumed['status']=='Awaiting review'
    replacement=req.files[0].model_copy()
    update=DraftRequest(metadata=req.metadata,expected_revision=resumed['revision'],files=[replacement],correction_note='RA corrected Template')
    saved=drafts.save(update,identifier)
    assert saved['revision']!=initial['revision'] and len(saved['history'])==2
    assert saved['history'][-1]['note']=='RA corrected Template'
    for role in ('basic-udi','eudamed-xml'):
        assert next(e['sha256'] for e in initial['files'] if e['role']==role)==next(e['sha256'] for e in saved['files'] if e['role']==role)
    assert (drafts.root/identifier/'revisions'/initial['revision']/'inputs/manifest.json').is_file()
    with pytest.raises(ValueError,match='another window'):drafts.save(update,identifier)
    assert settings.testing_state_db_path.read_bytes()==before
    assert SourceReviewDrafts(settings).list()['drafts'][0]['draft_id']==identifier


def test_review_publish_routine_preparation_and_import_keep_same_plan(dev_import):
    from app.services.import_workflow import ImportWorkflow
    reviewed_assessment=lambda settings,batch,artifact:ImportWorkflow(settings)._assessment(batch,artifact)
    drafts=SourceReviewDrafts(dev_import[-1]);initial=drafts.save(request(dev_import))
    checked=drafts.review(initial['draft_id'],initial['revision'])
    assert checked['review']['can_create'],checked['review']['groups']
    batch=drafts.publish(initial['draft_id'],checked['revision'],checked['review']['review_id'])
    assert batch['source_reviewed']
    assert drafts.publish(initial['draft_id'],checked['revision'],checked['review']['review_id'])['batch_id']==batch['batch_id']
    assert SourceReviewDrafts(dev_import[-1]).describe(initial['draft_id'])['status']=='Batch created'
    prep=drafts.batches
    artifact=prep.prepare(batch['batch_id'],prep.inspect(batch['batch_id'])['inspection_token'])
    assessment=reviewed_assessment(dev_import[-1],batch['batch_id'],artifact['artifact_id'])
    assert assessment['can_import'] and assessment['skipped_count']==0
    importer=dev_import[0]
    result=importer.confirm(batch['batch_id'],artifact['artifact_id'],assessment['assessment_id'],'Synthetic RA',True)
    assert result['created_count']==1
    assert reviewed_assessment(dev_import[-1],batch['batch_id'],artifact['artifact_id'])['already_imported']


def test_missing_files_and_incomplete_details_can_be_saved_but_not_published(dev_import):
    drafts=SourceReviewDrafts(dev_import[-1]);req=request(dev_import)
    req.files=[];req.metadata.source_date=None;req.metadata.complete_scope_confirmed=False
    saved=drafts.save(req)
    checked=drafts.review(saved['draft_id'],saved['revision'])
    assert checked['status']=='Awaiting corrections' and not checked['review']['can_create']
    assert {g['source'] for g in checked['review']['groups']}=={'Source files','Batch details'}
    with pytest.raises(ValueError,match='Resolve Step 1'):drafts.publish(saved['draft_id'],saved['revision'],checked['review']['review_id'])


def test_source_issues_invalidate_ready_review_and_xml_replacement_is_a_set(dev_import):
    drafts=SourceReviewDrafts(dev_import[-1]);req=request(dev_import);saved=drafts.save(req)
    checked=drafts.review(saved['draft_id'],saved['revision']);assert checked['review']['can_create']
    # Replacing an XML page set removes old pages rather than retaining stale exports.
    page=req.files[2].model_copy(update={'name':'replacement.xml'})
    updated=drafts.save(DraftRequest(metadata=req.metadata,files=[page],replace_roles=['eudamed-xml'],expected_revision=saved['revision']),saved['draft_id'])
    assert updated['review'] is None
    assert [f['path'] for f in updated['files'] if f['role']=='eudamed-xml']==['eudamed-xml/replacement.xml']
    with pytest.raises(ValueError,match='current saved revision'):drafts.publish(saved['draft_id'],saved['revision'],checked['review']['review_id'])
    # A malformed reference workbook is saved for correction, never published as a clean batch.
    bad=req.files[1].model_copy(update={'content_base64':base64.b64encode(b'bad workbook').decode()})
    updated=drafts.save(DraftRequest(metadata=req.metadata,files=[bad],expected_revision=updated['revision']),saved['draft_id'])
    checked=drafts.review(saved['draft_id'],updated['revision'])
    assert not checked['review']['can_create'] and checked['status']=='Awaiting corrections'


def test_changed_database_requires_step_one_review_again(dev_import):
    drafts=SourceReviewDrafts(dev_import[-1]);saved=drafts.save(request(dev_import));checked=drafts.review(saved['draft_id'],saved['revision'])
    assert checked['review']['can_create']
    with sqlite3.connect(dev_import[-1].testing_state_db_path) as c:c.execute("INSERT INTO import_batch(source_type,label,imported_at) VALUES('test','changed','now')")
    with pytest.raises(ValueError,match='changed; review'):drafts.publish(saved['draft_id'],saved['revision'],checked['review']['review_id'])


def test_production_and_symlink_storage_are_rejected(dev_import,tmp_path):
    settings=dev_import[-1]
    with pytest.raises(PermissionError):SourceReviewDrafts(settings.model_copy(update={'environment':'prod'}))
    drafts=SourceReviewDrafts(settings);drafts.root.parent.mkdir(exist_ok=True,parents=True)
    drafts.root.symlink_to(tmp_path,target_is_directory=True)
    with pytest.raises(ValueError,match='symlinks'):SourceReviewDrafts(settings)



def test_catalogue_collision_is_reported_at_step_one_with_source_rows(dev_import):
    # Seed an existing, different exact identity at the same catalogue address.
    from app.services.dev_input_batches import create_dev_batch
    drafts=SourceReviewDrafts(dev_import[-1]);req=request(dev_import);initial=drafts.save(req)
    checked=drafts.review(initial['draft_id'],initial['revision']);assert checked['review']['can_create']
    batch=drafts.publish(initial['draft_id'],initial['revision'],checked['review']['review_id'])
    prep=drafts.batches;artifact=prep.prepare(batch['batch_id'],prep.inspect(batch['batch_id'])['inspection_token'])
    importer=dev_import[0];assessment=importer.assess(batch['batch_id'],artifact['artifact_id'])
    importer.confirm(batch['batch_id'],artifact['artifact_id'],assessment['assessment_id'],'Synthetic RA',True)
    # XML-ready collisions require an explicit source correction, not a Step 3 surprise.
    with importer._connect(write=True) as connection:
        stored=connection.execute('SELECT id,record_json FROM canonical_device_record').fetchone()
        record=json.loads(stored['record_json']);record['xml_readiness']['status']='complete'
        connection.execute('UPDATE canonical_device_record SET record_json=? WHERE id=?',(json.dumps(record),stored['id']))
        connection.commit()
    template=dev_import[4]/'data/source_excel/Template.xlsx'
    from openpyxl import load_workbook
    book=load_workbook(template);sheet=book.active;sheet.append(['GS1','99000000000009','BASICSHARED','SYN-000000']);book.save(template);book.close()
    req.files[0]=req.files[0].model_copy(update={'content_base64':base64.b64encode(template.read_bytes()).decode()})
    saved=drafts.save(req);checked=drafts.review(saved['draft_id'],saved['revision'])
    assert not checked['review']['can_create']
    conflict=next(g for g in checked['review']['groups'] if g['code']=='identity')
    assert conflict['severity']=='block' and conflict['count']==1
    issue=conflict['records'][0]
    assert {entry['udi_di'] for entry in issue['identifiers']}=={'99000000000000','99000000000009'}
    assert {location['row'] for location in issue['locations']}=={2,3}
    assert 'before continuing' in issue['detail']


def test_published_files_and_stale_database_cannot_bypass_routine_import_guard(dev_import):
    from app.services.import_workflow import ImportWorkflow
    reviewed_assessment=lambda settings,batch,artifact:ImportWorkflow(settings)._assessment(batch,artifact)
    drafts=SourceReviewDrafts(dev_import[-1]);saved=drafts.save(request(dev_import));checked=drafts.review(saved['draft_id'],saved['revision'])
    batch=drafts.publish(saved['draft_id'],saved['revision'],checked['review']['review_id'])
    prep=drafts.batches;artifact=prep.prepare(batch['batch_id'],prep.inspect(batch['batch_id'])['inspection_token'])
    with sqlite3.connect(dev_import[-1].testing_state_db_path) as c:c.execute("INSERT INTO import_batch(source_type,label,imported_at) VALUES('test','changed','now')")
    with pytest.raises(ValueError,match='review source data again'):reviewed_assessment(dev_import[-1],batch['batch_id'],artifact['artifact_id'])
    path=prep._batch(batch['batch_id'])/'manifest.json';manifest=json.loads(path.read_text());manifest['receipt']['description']='changed';path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError,match='Source files changed'):reviewed_assessment(dev_import[-1],batch['batch_id'],artifact['artifact_id'])
