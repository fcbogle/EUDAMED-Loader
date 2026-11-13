"""Read-only model activity: recorded ZIP actions and correlated message history.

Never infer a portal upload time, operator, or ZIP-to-batch association.
"""
from __future__ import annotations

import base64
from collections import Counter, defaultdict
from contextlib import closing
from datetime import datetime, UTC
from io import BytesIO
import json
import sqlite3

from openpyxl import Workbook

from app.services.playground_reconciliation import timestamp
from app.services.production_workbook_preparation import _cell
from app.services.ra_reporting import StoredDeviceComparisonReport

OPERATIONS = {'DEVICE.POST', 'UDI_DI.POST', 'UDI_DI.PATCH', 'MARKET_INFO.PUT'}


def model_key(family, model):
    return json.dumps([family or 'Unmapped', model or 'Unmapped'])


def parsed(value):
    try:
        result = json.loads(value or '{}')
    except (ValueError, TypeError):
        return {}
    return result if isinstance(result, dict) else {}


def latest(values):
    usable = [(timestamp(value), value) for value in values if value and timestamp(value)]
    return max(usable, key=lambda item: item[0])[1] if usable else None


def order(row):
    when = timestamp(row['activity_at'])
    return (when is not None, when or datetime.min.replace(tzinfo=UTC), row['id'])


def outcome(states):
    counts = Counter(states)
    success, error, pending = counts['SUCCESS'], counts['ERROR'], counts['PENDING']
    unknown = len(states) - success - error - pending
    if not states or unknown:
        label = 'Incomplete / conflicting outcome evidence'
    elif pending and not success and not error:
        label = 'Awaiting response'
    elif pending:
        label = 'Partially responded'
    elif success and error:
        label = 'Partial success'
    elif error:
        label = 'Failed'
    else:
        label = 'Successful'
    return dict(success=success, error=error, pending=pending, unknown=unknown, outcome=label)


class SubmissionActivityReport:
    def __init__(self, settings):
        if settings.environment != 'dev':
            raise PermissionError('Submission Activity is available only in Dev')
        StoredDeviceComparisonReport(settings)  # Dev/database path guard; no stores initialized.
        self.settings = settings
        self.database = settings.testing_state_db_path.resolve()

    def generate(self, include_device_details=False):
        with closing(sqlite3.connect(self.database.as_uri() + '?mode=ro', uri=True)) as c:
            c.row_factory = sqlite3.Row
            c.execute('PRAGMA query_only=ON'); c.execute('BEGIN')
            tables = {row[0] for row in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if not {'generated_packages','testing_batches','testing_batch_devices','testing_subjects','testing_events'} <= tables:
                raise ValueError('Submission activity history is unavailable for this database schema')
            models = {}
            canonical_models = {}
            if {'canonical_device_record','import_batch'} <= tables:
                for row in c.execute('SELECT device_subject_id,record_json FROM canonical_device_record WHERE source_import_batch_id=(SELECT MAX(id) FROM import_batch)'):
                    record = parsed(row['record_json'])
                    family, model = record.get('product_family'), record.get('product_variant')
                    key = model_key(family, model)
                    canonical_models[row['device_subject_id']] = key
                    models.setdefault(key, self._model(key, family, model))
            subjects = {row['id']: dict(row) for row in c.execute('SELECT id,device_subject_id,product_family,product_variant,catalogue_number,primary_udi_di FROM testing_subjects')}
            subject_models = {}
            for sid, subject in subjects.items():
                key = canonical_models.get(subject['device_subject_id']) or model_key(subject['product_family'],subject['product_variant'])
                subject_models[sid] = key
            packages = [dict(row) for row in c.execute('SELECT id,created_at,flow,product_family,product_variant,package_file_name,package_sha256,manifest_json,reviewed_at,review_basis FROM generated_packages')]
            batches = [dict(row) for row in c.execute('SELECT batch_id,message_type,product_family,product_variant,created_at,acknowledged_at FROM testing_batches')]
            memberships = defaultdict(list)
            for row in c.execute('SELECT batch_id,subject_id,generated_event_id,acknowledgement_event_id,outcome_status FROM testing_batch_devices'):
                memberships[row['batch_id']].append(dict(row))
            events = {row['id']: dict(row) for row in c.execute('''SELECT id,subject_id,event_index,message_type,status,version,batch_id,correlation_id,message_id,
                tested_at,transaction_id,submission_id,source_file_name,
                CASE WHEN raw_xml IS NOT NULL AND length(raw_xml)>0 THEN 1 ELSE 0 END AS response_xml_available,
                CASE WHEN json_valid(raw_event_json) THEN json_extract(raw_event_json,'$.error_details') END AS error_details,
                changed_fields_json FROM testing_events WHERE status IN ('SUCCESS','ERROR')''')}
        activities = []
        covered = set()
        batch_events=defaultdict(list)
        for event in events.values():
            if event['batch_id'] and event['correlation_id'] and event['batch_id']!=event['correlation_id']:
                continue
            reference=event['batch_id'] or event['correlation_id']
            if reference:batch_events[(reference,event['subject_id'],event['message_type'])].append(event)

        def ensure(key):
            if key not in models:
                family, model = json.loads(key)
                models[key] = self._model(key,family,model)
            return models[key]

        for package in packages:
            key = model_key(package['product_family'],package['product_variant'])
            ensure(key)
            manifest = parsed(package['manifest_json'])
            downloaded = package['reviewed_at'] if package['review_basis']=='zip_download' else None
            row = self._activity('zip:'+str(package['id']),key,'ZIP download' if downloaded else 'ZIP generation (download not recorded)',downloaded or package['created_at'])
            row.update(generated_at=package['created_at'],zip_downloaded_at=downloaded,
                operation=manifest.get('message_type') or manifest.get('mode') or package['flow'],
                reference=package['package_file_name'],package_sha256=package['package_sha256'],
                outcome='ZIP download / review recorded' if downloaded else 'Download not recorded',
                notes=['No persisted package-to-message-batch association; no response outcome is inferred for this ZIP.'])
            activities.append(row)

        for batch in batches:
            if batch['message_type'] not in OPERATIONS:
                continue  # Imported baselines are not submission/upload activity.
            grouped = defaultdict(list)
            for member in memberships[batch['batch_id']]:
                sid = member['subject_id']
                key = subject_models.get(sid) or model_key(batch['product_family'],batch['product_variant'])
                grouped[key].append(member)
            if not grouped:
                grouped[model_key(batch['product_family'],batch['product_variant'])] = []
            for key,members in grouped.items():
                ensure(key)
                row = self._activity('batch:'+batch['batch_id']+':'+key,key,'Message batch',batch['created_at'])
                row.update(reference=batch['batch_id'],operation=batch['message_type'],generated_at=batch['created_at'],batch_id=batch['batch_id'])
                if not members:
                    row['notes'].append('No per-entity membership is retained; no entity outcomes are inferred')
                responses = []
                states = []
                for member in members:
                    sid=member['subject_id']; subject=subjects.get(sid,{})
                    event=events.get(member['acknowledgement_event_id'])
                    if event is None and batch_events[(batch['batch_id'],sid,batch['message_type'])]:
                        event=batch_events[(batch['batch_id'],sid,batch['message_type'])][0]
                        row['notes'].append('Response associated by exact correlation and recorded batch membership')
                    if event and (event['subject_id']!=sid or event['message_type']!=batch['message_type']
                                  or (event['correlation_id'] and event['correlation_id']!=batch['batch_id'])
                                  or (event['batch_id'] and event['batch_id']!=batch['batch_id'])):
                        row['notes'].append('Conflicting response membership; outcome requires investigation')
                        state='UNKNOWN'
                    elif event:
                        observations={e['id']:e for e in batch_events[(batch['batch_id'],sid,batch['message_type'])]}
                        observations[event['id']]=event
                        observations=list(observations.values())
                        responses.extend(observations);covered.update(e['id'] for e in observations)
                        dated=[e for e in observations if timestamp(e['tested_at'])]
                        last=max((timestamp(e['tested_at']) for e in dated),default=None)
                        candidates=[e for e in observations if not timestamp(e['tested_at']) or timestamp(e['tested_at'])==last]
                        statuses={e['status'] for e in candidates}
                        state=next(iter(statuses)) if len(statuses)==1 else 'UNKNOWN'
                        if state=='UNKNOWN':row['notes'].append('Response ordering or outcomes conflict for an entity')
                    elif member['outcome_status'] in {'SUCCESS','ERROR'}:
                        state=member['outcome_status'];row['notes'].append('Outcome recorded but linked response event is unavailable')
                    else:
                        state='PENDING'
                    states.append(state)
                    row['entities'].append({'catalogue':subject.get('catalogue_number'),'udi_di':subject.get('primary_udi_di'),
                        'kind':'Device UDI-DI' if subject.get('primary_udi_di') else 'Parent / unresolved entity', 'status':state})
                row.update(outcome(states))
                response_at = latest([event['tested_at'] for event in responses])
                # Only an entirely unscoped batch may use its recorded overall response time.
                if not members:
                    response_at=batch['acknowledged_at']
                if responses and not response_at:
                    response_at=next((e['tested_at'] for e in responses if e['tested_at']),None)
                row['response_at']=response_at
                row['activity_at']=response_at if responses else response_at or row['generated_at']
                row['kind']='Message response' if responses or response_at else 'Message generation'
                self._responses(row,responses)
                activities.append(row)
        # Old or orphan responses are separate evidence. Do not attach by model/date alone.
        unlinked = defaultdict(list)
        for event in events.values():
            if event['id'] in covered or event['message_type'] not in OPERATIONS:
                continue
            key=subject_models.get(event['subject_id']) or model_key(None,None)
            correlation=event['correlation_id'] or 'event:'+str(event['id'])
            unlinked[(key,event['message_type'],correlation)].append(event)
        for (key,operation,correlation),responses in unlinked.items():
            ensure(key)
            row=self._activity('unlinked:'+key+':'+operation+':'+correlation,key,'Unlinked response',latest([e['tested_at'] for e in responses]))
            row.update(reference=correlation,operation=operation,response_at=row['activity_at'])
            by_subject=defaultdict(list)
            for event in responses:by_subject[event['subject_id']].append(event)
            states=[]
            for sid,observations in by_subject.items():
                dated=[e for e in observations if timestamp(e['tested_at'])]
                if dated:
                    last=max(timestamp(e['tested_at']) for e in dated)
                    candidates=[e for e in observations if not timestamp(e['tested_at']) or timestamp(e['tested_at'])==last]
                else:candidates=observations
                statuses={e['status'] for e in candidates}
                state=next(iter(statuses)) if len(statuses)==1 else 'UNKNOWN'
                states.append(state);subject=subjects.get(sid,{})
                row['entities'].append({'catalogue':subject.get('catalogue_number'),'udi_di':subject.get('primary_udi_di'),
                    'kind':'Device UDI-DI' if subject.get('primary_udi_di') else 'Parent / unresolved entity','status':state})
            row.update(outcome(states));row['notes'].append('No verified message-batch/ZIP association')
            self._responses(row,responses);activities.append(row)
        for row in activities:
            row['notes']=sorted(set(row['notes']))
            if not timestamp(row['activity_at']):row['notes'].append('Timestamp cannot be ordered reliably')
        activities.sort(key=order,reverse=True)
        by_model=defaultdict(list)
        for row in activities:by_model[row['model_key']].append(row)
        for key,model in models.items():
            rows=by_model[key]
            dated=[row for row in rows if timestamp(row['activity_at'])]
            model['latest_activity']=dated[0] if dated else None
            model['zip_records']=sum(row['id'].startswith('zip:') for row in rows)
            model['message_batches']=sum(row['id'].startswith('batch:') for row in rows)
            model['unlinked_responses']=sum(row['id'].startswith('unlinked:') for row in rows)
            model['unordered_records']=sum(not timestamp(row['activity_at']) for row in rows)
            model['latest_zip_downloaded_at']=latest([row['zip_downloaded_at'] for row in rows])
            model['latest_response_at']=latest([row['response_at'] for row in rows])
        report={'environment':self.settings.environment,'generated_at':datetime.now(UTC).isoformat(),
            'models':sorted(models.values(),key=lambda m:(m['model'],m['family'])),'activities':activities,
            'limitations':[
                'Portal ZIP upload time and uploader are not recorded. ZIP creation/download and EUDAMED response times are separate observations.',
                'ZIP generator and Success XML importer identities, and a separate Success XML application import time, are not recorded. No historical identities are inferred.',
                'ZIP records and message batches have no consistent persisted association. They remain separate records; counts are not portal-upload totals.',
                'Per-entity linked outcomes determine batch status; cached batch status is not treated as proof that all entities succeeded.',
                'Parent and child entities are identified separately in optional entity detail. Repeat activity is not additional registered devices.',
                'Latest means latest usable recorded timestamp. Missing/timezone-less timestamps are retained as unordered history; unlinked responses are explicitly labelled.',
                'The current canonical model is used for linked device subjects; otherwise recorded historical model labels are preserved. No model/date matching joins ZIPs to responses.',
                'This report is a read-only database snapshot. It does not prove original ZIP bytes remain available, or change accepted state.']}
        report['excel_base64']=base64.b64encode(self._workbook(report,include_device_details)).decode()
        return report

    @staticmethod
    def _model(key,family,model):
        return {'key':key,'family':family or 'Unmapped','model':model or 'Unmapped'}

    @staticmethod
    def _activity(identifier,key,kind,when):
        return dict(id=identifier,model_key=key,kind=kind,activity_at=when,generated_at=None,zip_downloaded_at=None,
            response_at=None,batch_id=None,reference=None,operation=None,package_sha256=None,outcome='Unknown',
            success=0,error=0,pending=0,unknown=0,entities=[],responses=[],notes=[],generated_by=None,response_imported_by=None,response_imported_at=None)

    @staticmethod
    def _responses(row,events):
        references={}
        for event in events:
            key=(event['message_id'],event['correlation_id'],event['source_file_name'],event['tested_at']) if event['message_id'] else ('event',event['id'])
            reference={'event_id':event['id'],'file_name':event['source_file_name'],'message_id':event['message_id'],
                'correlation_id':event['correlation_id'],'response_at':event['tested_at'],
                'transaction_id':event['transaction_id'],'submission_id':event['submission_id'],
                'xml_available':bool(event['response_xml_available'])}
            if key not in references or reference['xml_available']:references[key]=reference
            errors=event['error_details']
            if errors:
                try:row['notes'].extend(str(value) for value in json.loads(errors))
                except (ValueError,TypeError):row['notes'].append('Recorded error detail is not readable')
        row['responses']=list(references.values())

    @staticmethod
    def _workbook(report,include_details):
        book=Workbook();context=book.active;context.title='Context'
        context.append(['Environment',report['environment']]);context.append(['Generated at',report['generated_at']])
        for note in report['limitations']:context.append(['Scope',note])
        models=book.create_sheet('Models')
        models.append(['Model','Family','Latest recorded activity','Activity type','Latest ZIP download','Latest EUDAMED response','ZIP records','Message batches','Unlinked responses','Unordered records'])
        for model in report['models']:
            last=model['latest_activity'] or {}
            models.append([model['model'],model['family'],last.get('activity_at'),last.get('kind'),model['latest_zip_downloaded_at'],model['latest_response_at'],model['zip_records'],model['message_batches'],model['unlinked_responses'],model['unordered_records']])
        history=book.create_sheet('Activity')
        history.append(['Model / family','Record','Type','Operation','Recorded activity','Generated','ZIP downloaded','EUDAMED response','Reference','ZIP SHA-256','Successful entities','Failed entities','Pending entities','Unknown entities','Outcome','Response records','Note count','ZIP generated by','Success XML imported by','Actual portal upload time'])
        responses=book.create_sheet('Response evidence')
        responses.append(['Record','Event ID','Response filename','EUDAMED response time','Message ID','Correlation ID','Transaction ID','Submission ID','Retained XML available'])
        notes=book.create_sheet('Record notes');notes.append(['Record','Note'])
        for row in report['activities']:
            history.append([row['model_key'],row['id'],row['kind'],row['operation'],row['activity_at'],row['generated_at'],row['zip_downloaded_at'],row['response_at'],row['reference'],row['package_sha256'],row['success'],row['error'],row['pending'],row['unknown'],row['outcome'],len(row['responses']),len(row['notes']),'Not recorded','Not recorded','Not recorded'])
            for reference in row['responses']:
                responses.append([row['id'],reference['event_id'],reference['file_name'],reference['response_at'],reference['message_id'],reference['correlation_id'],reference['transaction_id'],reference['submission_id'],reference['xml_available']])
            for note in row['notes']:notes.append([row['id'],_cell(note)])
        if include_details:
            sheet=book.create_sheet('Requested entity outcomes');sheet.append(['Model / family','Record','Catalogue','Device UDI-DI','Entity kind','Outcome'])
            for row in report['activities']:
                for entity in row['entities']:sheet.append([row['model_key'],row['id'],entity['catalogue'],entity['udi_di'],entity['kind'],entity['status']])
        for sheet in book:
            sheet.freeze_panes='A2'
            for cells in sheet:
                for cell in cells:
                    if isinstance(cell.value,str):cell.data_type='s';cell.number_format='@'
        data=BytesIO();book.save(data);book.close();return data.getvalue()
