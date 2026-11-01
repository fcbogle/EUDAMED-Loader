"""Persistent Step 1 reviews. Draft files/history survive restarts; SQLite is read only."""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, UTC
import base64
import json
from pathlib import Path
import re
from uuid import uuid4

from pydantic import BaseModel, Field
from app.services.import_review_policy import Findings, category, POLICY_VERSION
from app.services.dev_batch_preparation import DevBatchPreparation
from app.services.dev_input_batches import fingerprint
from app.services.dev_workbook_import import DevWorkbookImporter
from app.services.source_batch_receipt import (ReceivedFile, ReceiptMetadata,
    ReceiptRequest, decode_files, write_inputs, receive_batch, MAX_TOTAL_BYTES, validate_received_content)


class DraftMetadata(ReceiptMetadata):
    """Partial metadata is saved automatically; unknown dates do not block an import."""


class DraftRequest(BaseModel):
    metadata: DraftMetadata
    files: list[ReceivedFile] = Field(default_factory=list, max_length=100)
    expected_revision: str | None = None
    # A replacement XML set must replace every page together; Templates can be replaced individually.
    replace_roles: list[str] = Field(default_factory=list, max_length=3)
    remove_paths: list[str] = Field(default_factory=list, max_length=100)
    correction_note: str = Field(default='', max_length=2000)


class DraftPreparation(DevBatchPreparation):
    def __init__(self, settings, path, draft_id):
        super().__init__(settings)
        self.path, self.draft_id = path, draft_id

    def _batch(self, batch_id):
        if batch_id != self.draft_id or not self.path.is_dir():
            raise ValueError('Invalid source review input')
        return self.path


def now():
    return datetime.now(UTC).isoformat()


def atomic_json(path, data):
    temporary = path.with_name('.'+uuid4().hex+'.tmp')
    try:
        temporary.write_text(json.dumps(data, indent=2)+'\n')
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


class SourceReviewDrafts:
    def __init__(self, settings):
        self.batches = DevBatchPreparation(settings)  # Dev-only, before filesystem/database access.
        self.settings = settings
        self.root = self.batches.root / 'source-reviews'
        self._safe(self.root)

    def _safe(self, path):
        if any(p.is_symlink() for p in [path, *path.parents]):
            raise ValueError('Source review storage must not contain symlinks')
        return path

    def _path(self, draft_id):
        if not re.fullmatch(r'[a-f0-9]{32}', draft_id):
            raise ValueError('Invalid source review ID')
        return self._safe(self.root / draft_id)

    def _load(self, draft_id):
        path = self._path(draft_id)
        return path, json.loads(self._safe(path/'draft.json').read_text())

    @contextmanager
    def _lock(self, path):
        lock = self._safe(path/'.editing.lock')
        try:
            handle = lock.open('x')
        except FileExistsError:
            raise ValueError('This review is busy; wait and retry') from None
        try:
            with handle:
                yield
        finally:
            lock.unlink(missing_ok=True)

    def list(self):
        if not self.root.exists():return {'drafts': []}
        drafts = []
        for path in sorted(self.root.iterdir()):
            if re.fullmatch(r'[a-f0-9]{32}',path.name) and (path/'draft.json').is_file():
                drafts.append(self.describe(path.name))
        return {'drafts': sorted(drafts,key=lambda d:d['updated_at'],reverse=True)}

    def _prep(self, path, state):
        inputs = self._safe(path/'revisions'/state['revision']/'inputs')
        return DraftPreparation(self.settings,inputs,state['draft_id'])

    def describe(self, draft_id):
        path, state = self._load(draft_id)
        inputs, manifest, _, _ = self._prep(path,state)._inputs(draft_id)
        review = None
        if state.get('review_id'):
            review = json.loads(self._safe(path/'reviews'/(state['review_id']+'.json')).read_text())
            # Keep the complete findings on disk; show only a small representative set per group.
            review = {k:v for k,v in review.items() if k not in ('plan','inspection')}
            review['groups'] = [{**g,'truncated':len(g['records'])>10,'records':g['records'][:10]} for g in review['groups']]
        return {**state,'metadata':manifest['receipt'],'files':manifest['files'],'review':review}

    def save(self, request, draft_id=None):
        decoded = decode_files(request.files,require_complete=False)
        if set(request.replace_roles)-{'templates','basic-udi','eudamed-xml'}:
            raise ValueError('Invalid replacement file group')
        draft_id = draft_id or uuid4().hex
        path = self._path(draft_id)
        path.mkdir(parents=True,exist_ok=True)
        with self._lock(path):
            old = json.loads((path/'draft.json').read_text()) if (path/'draft.json').exists() else None
            if old and old['revision'] != request.expected_revision:
                raise ValueError('This saved review changed in another window; reopen it before editing')
            if old and old.get('batch_id'):
                raise ValueError('This review already created a batch; start a new review for further corrections')
            existing = {}
            if old:
                inputs, manifest, _, _ = self._prep(path,old)._inputs(draft_id)
                for entry in manifest['files']:
                    if entry['role'] in request.replace_roles or entry['path'] in request.remove_paths:continue
                    item = ReceivedFile(role=entry['role'],name=entry.get('original_name',Path(entry['path']).name),
                        content_base64='',modified_at=entry['source_modified_at'])
                    existing[(item.role,Path(entry['path']).name.casefold())]=(item,Path(entry['path']).name,(inputs/entry['path']).read_bytes())
            for item,name,data in decoded:
                existing[(item.role,name.casefold())]=(item,name,data)
            merged=list(existing.values())
            if len(merged)>100 or sum(len(data) for _,_,data in merged)>MAX_TOTAL_BYTES:
                raise ValueError('Retained files must total at most 100 files and 60 MB')
            revision=uuid4().hex
            directory=path/'revisions'/revision
            self._safe(directory);directory.mkdir(parents=True)
            inputs=directory/'inputs';inputs.mkdir()
            write_inputs(self.batches,request,inputs,draft_id,merged,validate_content=False)
            state={'draft_id':draft_id,'revision':revision,'created_at':old['created_at'] if old else now(),
                'updated_at':now(),'status':'Awaiting review','review_id':None,'batch_id':None,
                'history':(old['history'] if old else [])+[{'revision':revision,'saved_at':now(),'note':request.correction_note}]}
            atomic_json(path/'draft.json',state)
        return self.describe(draft_id)

    def review(self, draft_id, revision):
        path, _ = self._load(draft_id)
        with self._lock(path):
            _,state=self._load(draft_id)
            if state['revision']!=revision or state.get('batch_id'):raise ValueError('Reopen the current saved review')
            prep=self._prep(path,state)
            inputs, manifest, _, token=prep._inputs(draft_id)
            findings=Findings()
            roles=[entry['role'] for entry in manifest['files']]
            if roles.count('basic-udi')!=1 or not {'templates','eudamed-xml'}<=set(roles):
                findings.add('files','Source files',[{'detail':'Select Template workbooks, one BasicUDI workbook and all XML pages.'}])
            for entry in manifest['files']:
                item=ReceivedFile(role=entry['role'],name=entry.get('original_name',Path(entry['path']).name),content_base64='')
                try:validate_received_content(inputs/entry['path'],item,manifest['manufacturer_srn'])
                except ValueError as exc:
                    code='environment' if 'schema/manufacturer' in str(exc) else 'files'
                    findings.add(code,{'templates':'Template','basic-udi':'BasicUDI','eudamed-xml':'EUDAMED'}[entry['role']],
                        [{'file':item.name,'detail':str(exc)}])
            plan=None;inspection=None
            if findings.result()['can_create']:
                inspection=prep.inspect(draft_id)
                checks=sorted((inputs/'checks').glob('*.json'),key=lambda p:p.stat().st_mtime_ns)
                full=json.loads(checks[-1].read_text())['source_review']
                for group in full['groups']:
                    findings.add(category(group['title'], ' '.join(r.get('detail','') for r in group['records'])),group['source'],group['records'])
                for error in inspection['errors']:
                    findings.add(category(error),'Source files',[{'detail':error}])
                if inspection['inspection_token'] and findings.result()['can_create']:
                    try:
                        artifact=prep.prepare(draft_id,inspection['inspection_token'])
                        importer=DevWorkbookImporter(self.settings)
                        plan,prepared,_,_=importer._plan(draft_id,artifact['artifact_id'],source_batches=prep)
                        for row in prepared.skipped:
                            for reason in row['reasons']:
                                findings.add(category(reason),'Template / EUDAMED',[{**row,'identifier':row['udi_di'],'detail':reason}])
                        if plan['differences']:
                            findings.add('differences','Template / existing database',plan['differences'])
                        for issue in plan['identity_conflicts']:
                            matches=[r for r in prepared.rows if r['key'][1]==issue['identifier']]
                            origins=[o.get('source',{}) for r in matches for o in r['provenance']['templates']]
                            findings.add('identity','Template / existing database',
                                [{**issue,'detail':issue['reason'],**origin} for origin in origins or [{}]])
                        if plan.get('catalogue_conflicts'):
                            findings.add('identity','Template / existing database',plan['catalogue_conflicts'])
                        if not prepared.rows:
                            findings.add('structure','Source files',[{'detail':'No safely identified device records were found.'}])
                    except ValueError as exc:
                        findings.add('structure','Source files',[{'detail':str(exc)}])
            for field,label in [('source_date','Workbook source date'),('export_date','XML export date')]:
                if not manifest['receipt'].get(field):
                    findings.add('optional','Batch details',[{'detail':label+' is not recorded.'}])
            result=findings.result()
            if prep._inputs(draft_id)[3]!=token:raise ValueError('Saved source files changed during review; review again')
            review_id=uuid4().hex
            report={'review_id':review_id,'revision':revision,'reviewed_at':now(),**result, 'can_create':result['can_create'] and plan is not None,
                'input_token':token,'plan':plan,'inspection':inspection}
            (path/'reviews').mkdir(exist_ok=True)
            atomic_json(path/'reviews'/(review_id+'.json'),report)
            state.update(review_id=review_id,status='Ready to create batch' if report['can_create'] else 'Awaiting corrections',updated_at=now())
            state['history'].append({'revision':revision,'review_id':review_id,'reviewed_at':report['reviewed_at'],'status':state['status']})
            atomic_json(path/'draft.json',state)
        return self.describe(draft_id)

    def publish(self,draft_id,revision,review_id):
        path,_=self._load(draft_id)
        with self._lock(path):
            _,state=self._load(draft_id)
            if state.get('batch_id'):return self.batches.describe(state['batch_id'])
            if state['revision']!=revision or state.get('review_id')!=review_id:raise ValueError('Review the current saved revision before creating a batch')
            report=json.loads((path/'reviews'/(review_id+'.json')).read_text())
            prep=self._prep(path,state);inputs,manifest,_,token=prep._inputs(draft_id)
            if report.get('policy_version')!=POLICY_VERSION or not report['can_create'] or token!=report['input_token']:raise ValueError('Resolve Step 1 findings and review again before creating a batch')
            importer=DevWorkbookImporter(self.settings)
            with importer._connect() as c:marker=importer._marker(c)
            if marker!=report['plan']['database_marker'] or importer._configuration()!=report['plan']['configuration']:
                raise ValueError('Dev data or configuration changed; review the saved sources again in Step 1')
            # Recover publication if a process stopped after the dated batch was saved.
            existing=next((p for p in self.batches.root.glob('*/source-review.json')
                if json.loads(p.read_text()).get('review_id')==review_id),None)
            if existing:batch=self.batches.describe(existing.parent.name)
            else:
                files=[ReceivedFile(role=e['role'],name=e.get('original_name',Path(e['path']).name),
                    content_base64=base64.b64encode((inputs/e['path']).read_bytes()).decode(),modified_at=e['source_modified_at']) for e in manifest['files']]
                approval={'draft_id':draft_id,'revision':revision,'review_id':review_id,'reviewed_at':report['reviewed_at'],'policy_version':POLICY_VERSION,
                    'database_marker':marker,'configuration':report['plan']['configuration'],'plan_sha256':report['plan']['plan_sha256']}
                batch=receive_batch(self.batches,ReceiptRequest(metadata=ReceiptMetadata.model_validate(manifest['receipt']),files=files),source_review=approval)
                batch=self.batches.describe(batch['batch_id'])
            state.update(batch_id=batch['batch_id'],status='Batch created',updated_at=now())
            atomic_json(path/'draft.json',state)
        return batch

    def from_batch(self,batch_id,metadata):
        path,manifest,_,_=self.batches._inputs(batch_id)
        files=[ReceivedFile(role=e['role'],name=e.get('original_name',Path(e['path']).name),
            content_base64=base64.b64encode((path/e['path']).read_bytes()).decode(),modified_at=e['source_modified_at']) for e in manifest['files']]
        return self.save(DraftRequest(metadata=metadata,files=files,correction_note=f'Copied from existing batch {batch_id}; originals retained.'))
