"""One resumable Dev import; source review is the only operator data-review gate."""
import json
import re

from app.services.source_review_drafts import SourceReviewDrafts, DraftMetadata, atomic_json
from app.services.dev_workbook_import import workbook_importer
from app.services.dev_input_batches import fingerprint
from app.services.import_review_policy import POLICY_VERSION


class ImportWorkflow:
    def __init__(self, settings):
        self.drafts=SourceReviewDrafts(settings)
        self.batches=self.drafts.batches
        self.importer=workbook_importer(settings)

    def _files(self, files):
        return [{**entry,'excluded':entry['role']=='templates' and entry['path'].split('/')[-1] in self.batches.settings.excluded_excel_workbook_names} for entry in files]

    def list(self):
        items=[];linked=set();receipts={}
        for draft in self.drafts.list()['drafts']:
            if draft.get('batch_id'):linked.add(draft['batch_id'])
            status=draft['status']
            if draft.get('batch_id') and draft.get('artifact_id'):
                batch_id=draft['batch_id']
                if batch_id not in receipts:
                    receipts[batch_id]=self.importer.resume(batch_id)['imports']
                if any(result['artifact_id']==draft['artifact_id'] for result in receipts[batch_id]):
                    status='complete'
            items.append({'id':draft['draft_id'],'description':draft['metadata'].get('description') or draft['created_at'][:10],
                'status':status,'updated_at':draft['updated_at']})
        for batch in self.batches.list_batches()['batches']:
            if batch.get('error') or batch['batch_id'] in linked:continue
            items.append({'id':batch['batch_id'],'description':(batch.get('receipt') or {}).get('description') or batch['batch_id'],
                'status':'Review sources','updated_at':batch.get('created_at','')})
        if self.drafts.settings.environment == 'prod':
            with self.importer._connect() as connection:
                for row in connection.execute("SELECT id,label,imported_at FROM import_batch WHERE source_type='production_workbook'"):
                    items.append({'id':f"production-import-{row['id']}", 'description':row['label'], 'status':'complete', 'updated_at':row['imported_at']})
        return {'imports':sorted(items,key=lambda x:x['updated_at'],reverse=True)}

    def get(self, identifier):
        if self.drafts.settings.environment == 'prod' and re.fullmatch(r'production-import-\d+',identifier):
            with self.importer._connect() as connection:
                row=connection.execute("SELECT * FROM import_batch WHERE id=? AND source_type='production_workbook'",(int(identifier.rsplit('-',1)[1]),)).fetchone()
                if row is None:raise FileNotFoundError('Earlier Production import not found')
                report=json.loads(row['notes'] or '{}')
                workbooks=[item[0] for item in connection.execute('SELECT workbook_name FROM source_workbook WHERE import_batch_id=?',(row['id'],))]
            return dict(environment='prod',id=identifier,revision=None,batch_id=None,stage='complete',legacy=True,
                legacy_workbooks=workbooks,metadata={'creator':{'name':row['imported_by'] or '', 'email':'','team_role':''},
                    'description':row['label'],'source_date':None,'export_date':None},files=[],review=None,workbook=None,summary=None,
                result={'import_batch_id':row['id'],'created_count':report.get('created_count',0),
                    'existing_retained_count':report.get('unchanged_count',0),'omitted_retained_count':report.get('retained_count',0),
                    'confirmed_at':row['imported_at'],'confirmed_by':row['imported_by'] or 'Not recorded','backup':None})
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}-\d{3}',identifier):
            _,manifest,_,_=self.batches._inputs(identifier)
            metadata=DraftMetadata.model_validate(manifest.get('receipt',{})).model_dump(mode='json')
            return dict(environment=self.drafts.settings.environment,id=identifier,revision=None,source_batch_id=identifier,batch_id=None,stage='review',
                metadata=metadata,files=self._files(manifest['files']),review=None,workbook=None,result=None,summary=None)
        draft=self.drafts.describe(identifier)
        workbook=None;result=None;summary=None
        artifact_id=draft.get('artifact_id')
        if artifact_id and draft.get('batch_id'):
            resumed=self.importer.resume(draft['batch_id'])
            result=next((r for r in resumed['imports'] if r['artifact_id']==artifact_id),None)
        # A committed import stays completed under later source policies. Older
        # approvals may never authorise a new import without a current review.
        if not result and draft.get('batch_id') and (draft.get('review') or {}).get('policy_version')!=POLICY_VERSION:
            return self.get(draft['batch_id'])
        if not result and (draft.get('review') or {}).get('policy_version')!=POLICY_VERSION:
            draft['review']=None
        stage='workbook' if draft.get('review') and draft['review'].get('can_create') else 'review'
        if artifact_id and draft.get('batch_id'):
            workbook=self.batches.artifact(draft['batch_id'],artifact_id)[0]
            stage='complete' if result else 'import'
            summary=draft.get('import_summary')
        return dict(environment=self.drafts.settings.environment,id=identifier,revision=draft['revision'],batch_id=draft.get('batch_id'),stage=stage,
            metadata=draft['metadata'],files=self._files(draft['files']),review=draft.get('review'),workbook=workbook,result=result,summary=summary)

    def save(self, identifier, request):
        if identifier=='new':saved=self.drafts.save(request)
        elif re.fullmatch(r'\d{4}-\d{2}-\d{2}-\d{3}',identifier):
            copied=self.drafts.from_batch(identifier,request.metadata)
            request.expected_revision=copied['revision']
            saved=self.drafts.save(request,copied['draft_id'])
        else:saved=self.drafts.save(request,identifier)
        return self.get(saved['draft_id'])

    def review(self, identifier, revision):
        self.drafts.review(identifier,revision)
        return self.get(identifier)

    def _assessment(self,batch_id,artifact_id):
        batch=self.batches._batch(batch_id)
        path=batch/'source-review.json'
        if path.is_symlink() or not path.is_file():raise ValueError('Review source data before importing this batch')
        approval=json.loads(path.read_text())
        self.batches._inputs(batch_id)
        if approval.get('policy_version')!=POLICY_VERSION or approval['manifest_sha256']!=fingerprint(batch/'manifest.json'):
            raise ValueError('Source files changed; review source data again')
        report=self.importer.assess(batch_id,artifact_id)
        if not report['already_imported'] and (not report['can_import'] or
            any(report[key]!=approval[key] for key in ('database_marker','configuration','plan_sha256'))):
            raise ValueError('Database state or rules changed; review source data again before importing')
        return report

    def prepare(self, identifier, revision):
        path,state=self.drafts._load(identifier)
        if state['revision']!=revision:raise ValueError('This import changed in another window; reopen it')
        reviewed=self.drafts.describe(identifier)['review']
        if not reviewed or reviewed.get('policy_version')!=POLICY_VERSION or not reviewed['can_create']:
            raise ValueError('Resolve source corrections before creating the workbook')
        batch=self.drafts.publish(identifier,revision,reviewed['review_id'])
        with self.drafts._lock(path):
            _,state=self.drafts._load(identifier)
            if not state.get('artifact_id'):
                _,_,_,token=self.batches._inputs(batch['batch_id'])
                artifact=self.batches.prepare(batch['batch_id'],token)
                state['artifact_id']=artifact['artifact_id']
            assessment=self._assessment(batch['batch_id'],state['artifact_id'])
            state['import_summary']={k:assessment[k] for k in ('new_count','existing_retained_count','omitted_retained_count')}
            state['status']='Ready to import'
            atomic_json(path/'draft.json',state)
        return self.get(identifier)

    def confirm(self,identifier,revision,confirmed_by,confirmed,target_environment=None):
        environment = self.drafts.settings.environment
        if (environment == 'prod' or target_environment is not None) and target_environment != environment:
            raise ValueError('Explicitly confirm the active target environment before importing')
        path,state=self.drafts._load(identifier)
        if state['revision']!=revision or not state.get('artifact_id'):raise ValueError('Create the workbook for this import first')
        if not confirmed or not confirmed_by.strip():raise ValueError('Confirm the import and enter your name and work email')
        with self.drafts._lock(path):
            assessment=self._assessment(state['batch_id'],state['artifact_id'])
            self.importer.confirm(state['batch_id'],state['artifact_id'],assessment['assessment_id'],confirmed_by,confirmed)
        return self.get(identifier)
