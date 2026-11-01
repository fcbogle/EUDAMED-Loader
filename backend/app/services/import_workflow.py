"""One resumable Dev import; source review is the only operator data-review gate."""
import json
import re

from app.services.source_review_drafts import SourceReviewDrafts, DraftMetadata, atomic_json
from app.services.dev_workbook_import import DevWorkbookImporter
from app.services.dev_input_batches import fingerprint
from app.services.import_review_policy import POLICY_VERSION


class ImportWorkflow:
    def __init__(self, settings):
        self.drafts=SourceReviewDrafts(settings)
        self.batches=self.drafts.batches
        self.importer=DevWorkbookImporter(settings)

    def _files(self, files):
        return [{**entry,'excluded':entry['role']=='templates' and entry['path'].split('/')[-1] in self.batches.settings.excluded_excel_workbook_names} for entry in files]

    def list(self):
        items=[];linked=set()
        for draft in self.drafts.list()['drafts']:
            if draft.get('batch_id'):linked.add(draft['batch_id'])
            items.append({'id':draft['draft_id'],'description':draft['metadata'].get('description') or draft['created_at'][:10],
                'status':draft['status'],'updated_at':draft['updated_at']})
        for batch in self.batches.list_batches()['batches']:
            if batch.get('error') or batch['batch_id'] in linked:continue
            items.append({'id':batch['batch_id'],'description':(batch.get('receipt') or {}).get('description') or batch['batch_id'],
                'status':'Review sources','updated_at':batch.get('created_at','')})
        return {'imports':sorted(items,key=lambda x:x['updated_at'],reverse=True)}

    def get(self, identifier):
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}-\d{3}',identifier):
            _,manifest,_,_=self.batches._inputs(identifier)
            metadata=DraftMetadata.model_validate(manifest.get('receipt',{})).model_dump(mode='json')
            return dict(id=identifier,revision=None,source_batch_id=identifier,batch_id=None,stage='review',
                metadata=metadata,files=self._files(manifest['files']),review=None,workbook=None,result=None,summary=None)
        draft=self.drafts.describe(identifier)
        # Earlier published reviews used a broader blocker policy. Reuse their saved files,
        # but never silently treat old approval as approval under the new policy.
        if draft.get('batch_id') and (draft.get('review') or {}).get('policy_version')!=POLICY_VERSION:
            return self.get(draft['batch_id'])
        if (draft.get('review') or {}).get('policy_version')!=POLICY_VERSION:draft['review']=None
        stage='workbook' if draft.get('review') and draft['review'].get('can_create') else 'review'
        workbook=None;result=None;summary=None
        artifact_id=draft.get('artifact_id')
        if artifact_id and draft.get('batch_id'):
            workbook=self.batches.artifact(draft['batch_id'],artifact_id)[0]
            resumed=self.importer.resume(draft['batch_id'])
            result=next((r for r in resumed['imports'] if r['artifact_id']==artifact_id),None)
            stage='complete' if result else 'import'
            summary=draft.get('import_summary')
        return dict(id=identifier,revision=draft['revision'],batch_id=draft.get('batch_id'),stage=stage,
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
            raise ValueError('Dev data or rules changed; review source data again before importing')
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

    def confirm(self,identifier,revision,confirmed_by,confirmed):
        path,state=self.drafts._load(identifier)
        if state['revision']!=revision or not state.get('artifact_id'):raise ValueError('Create the workbook for this import first')
        if not confirmed or not confirmed_by.strip():raise ValueError('Confirm the Dev import and enter your name and work email')
        with self.drafts._lock(path):
            assessment=self._assessment(state['batch_id'],state['artifact_id'])
            self.importer.confirm(state['batch_id'],state['artifact_id'],assessment['assessment_id'],confirmed_by,confirmed)
        return self.get(identifier)
