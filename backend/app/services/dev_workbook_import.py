"""Assessed, additive Dev workbook imports. Accepted history is never replaced."""
from __future__ import annotations

from contextlib import closing
from datetime import datetime, UTC, timedelta
import hashlib
import json
from pathlib import Path
import re
import sqlite3
from uuid import uuid4

from app.services.dev_batch_preparation import DevBatchPreparation
from app.services.dev_input_batches import fingerprint
from app.services.production_workbook_import import ProductionWorkbookImporter, dump, semantic
from app.services.identity import normalize_identity
from app.services.import_review_policy import reason_blocks


class _DevReader(ProductionWorkbookImporter):
    template_only_status = 'Not evidenced by supplied exports'
    subject_key_prefix = 'DEV'

    def __init__(self, settings, workbook, audit):
        self.settings, self.workbook, self.audit_path = settings, workbook, audit

    def _review_blocks(self, reasons):
        return any(reason_blocks(reason) for reason in reasons)

    def _database_state(self, connection=None):
        # Use the existing workbook/audit validation and canonical adapter only.
        # Identity/difference checks against Dev's legacy source rows follow below.
        return 'read-by-dev-importer', {}, None


class DevWorkbookImporter:
    def __init__(self, settings):
        self.batches = DevBatchPreparation(settings)
        self.settings = settings
        self.database = settings.testing_state_db_path.resolve()
        data = self.batches.root.parents[1]
        if self.database != data / 'testing/testing-state.sqlite3' or settings.testing_state_db_path.is_symlink():
            raise PermissionError('Workbook import requires the existing data/testing/testing-state.sqlite3 Dev database')
        self.backups = data / 'testing/backups'
        if self.backups.is_symlink():
            raise PermissionError('Dev backup directory must not be a symlink')

    def _connect(self, write=False):
        if self.database.is_symlink() or self.database.resolve()!=self.database:
            raise PermissionError('Dev database path changed or is redirected')
        production = self.batches.root.parents[1] / 'prod/application.sqlite3'
        if production.exists() and self.database.exists() and self.database.samefile(production):
            raise PermissionError('Dev import cannot access the Production database')
        if not self.database.is_file():
            raise ValueError('The existing Dev database is missing; no database will be created')
        c = sqlite3.connect(self.database.as_uri()+('?mode=rw' if write else '?mode=ro'), uri=True, timeout=10)
        c.row_factory = sqlite3.Row
        c.execute('PRAGMA foreign_keys=ON')
        if not write:c.execute('PRAGMA query_only=ON')
        return c

    @staticmethod
    def _marker(c):
        digest = hashlib.sha256()
        for row in c.execute("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
            name = row['name']; digest.update(str(tuple(row)).encode())
            if not re.fullmatch(r'[A-Za-z_][A-Za-z_0-9]*', name):raise ValueError('Unsupported database table name')
            for record in c.execute(f'SELECT * FROM "{name}" ORDER BY rowid'):
                digest.update(repr(tuple(record)).encode())
        return digest.hexdigest()

    def _configuration(self):
        rules = hashlib.sha256()
        for folder in (self.settings.normalization_dir, self.settings.canonical_mapping_dir, self.settings.schema_dir):
            for path in sorted(folder.rglob('*')):
                if path.is_file():rules.update(str(path).encode());rules.update(fingerprint(path).encode())
        if self.settings.environment_file and self.settings.environment_file.is_file():
            rules.update(fingerprint(self.settings.environment_file).encode())
        return [rules.hexdigest()] + [str(value) for value in (self.settings.environment, self.database, self.batches.root,
            self.settings.eudamed_manufacturer_srn_override, self.settings.eudamed_authorised_representative_srn_override,
            self.settings.eudamed_suppress_authorised_representative, self.settings.eudamed_message_schema_version)]

    def _artifacts(self, batch_id):
        batch, _, _, token = self.batches._inputs(batch_id)
        artifacts = []
        for path in sorted((batch / 'prepared').glob('*/preparation.json'), key=lambda p:p.stat().st_mtime, reverse=True):
            try:
                record, _, _ = self.batches.artifact(batch_id, path.parent.name)
                if record['inspection_token'] == token:artifacts.append(record)
            except (ValueError, OSError, KeyError):continue
        return artifacts

    def resume(self, batch_id):
        artifacts = self._artifacts(batch_id)
        results = []
        with closing(self._connect()) as c:
            for row in c.execute("SELECT notes FROM import_batch WHERE source_type='dev_prepared_workbook' ORDER BY id DESC"):
                result = json.loads(row['notes'])
                if result.get('batch_id') == batch_id:results.append(result)
        return {'batch_id':batch_id, 'artifacts':artifacts, 'imports':results}

    @staticmethod
    def _source_fields(fields):
        # Legacy source-row storage retained named headers with last-column wins.
        result = {}
        for name,value in fields.items():
            if name.startswith('Unnamed column '):continue
            name = re.sub(r' \[occurrence \d+\]$', '', name)
            if isinstance(value,dict) and value.get('type') in ('datetime','date'):value=value['value'].replace('T',' ')
            result[name]=semantic(value)
        return {k:v for k,v in result.items() if v is not None and v != ''}

    def _plan(self, batch_id, artifact_id, connection=None, *, source_batches=None):
        batches = source_batches or self.batches
        batch, manifest, _, input_token = batches._inputs(batch_id)
        artifact, workbook, audit_path = batches.artifact(batch_id, artifact_id)
        if artifact['inspection_token'] != input_token:
            raise ValueError('Batch inputs changed since workbook creation; create a fresh workbook')
        if workbook.with_name('~$'+workbook.name).exists():raise ValueError('Close the prepared workbook before assessing/importing')
        try:prepared = _DevReader(self.settings, workbook, audit_path)._prepare()
        except ValueError as exc:raise ValueError(str(exc).replace('Production','Dev')) from exc
        own = connection is None
        c = connection or self._connect()
        if own:c.execute('BEGIN')
        try:
            marker = self._marker(c)
            current = list(c.execute('''SELECT d.*, c.id AS canonical_id,c.source_row_id AS canonical_source_row_id,c.record_json,s.raw_payload_json
                FROM device_subject d LEFT JOIN canonical_device_record c ON c.device_subject_id=d.id
                LEFT JOIN source_row s ON s.id=d.current_source_row_id'''))
            lookup = {}; conflicts = []; changes = []; catalogue_conflicts = []; new = []; existing_rows = []
            for device in current:
                record = json.loads(device['record_json'] or '{}')
                issuer = record.get('issuing_entity') or next((f['value'] for f in record.get('fields',[]) if f['canonical_path']=='manufacturer.issuing_entity'),None)
                key=(str(issuer or '').upper(),str(device['primary_udi_di'] or ''))
                if device['canonical_source_row_id'] != device['current_source_row_id'] or device['canonical_id'] is None:
                    conflicts.append({'identifier':key[1],'reason':'Existing source/canonical lineage needs review'})
                if not all(key):
                    conflicts.append({'identifier':device['primary_udi_di'],'reason':'Existing identity lacks an issuer-qualified canonical projection'})
                elif key in lookup:conflicts.append({'identifier':key[1],'reason':'Multiple existing devices share one issuer-qualified identity'})
                else:lookup[key]=device
            for row in prepared.rows:
                key=tuple(row['key']); previous=lookup.get(key)
                row['record'].source_workbook=workbook.name
                if previous is None:
                    if any(d['primary_udi_di']==key[1] for d in current):
                        conflicts.append({'identifier':key[1],'reason':'UDI exists under a different or unresolved issuer'})
                    if c.execute('SELECT 1 FROM testing_subjects WHERE primary_udi_di=?',(key[1],)).fetchone():
                        conflicts.append({'identifier':key[1],'reason':'Existing submission evidence needs an explicit device identity link'})
                    new.append(row);continue
                row['existing_id']=previous['id'];existing_rows.append(row)
                old=json.loads(previous['raw_payload_json'] or '{}')
                saved=old.get('dev_prepared_import')
                proposed={k:v for k,v in row['values'].items() if k.startswith(('Proposed: ', 'Proposed Parent: '))}
                if saved:
                    before=saved['proposed_values'];after=proposed
                else:
                    occurrences=row['provenance']['templates']
                    # XML-only evidence cannot replace an existing proposed source.
                    if not occurrences:
                        continue
                    before=self._source_fields(old);after=self._source_fields(occurrences[0]['fields'])
                fields=[{'field':k,'before':before.get(k),'after':after.get(k)} for k in sorted(set(before)|set(after)) if semantic(before.get(k))!=semantic(after.get(k))]
                if fields:changes.append({'issuer':key[0],'udi_di':key[1],'catalogue':row['record'].catalogue_number,'fields':fields})
            # One unresolved catalogue address produces one finding, even when it
            # appears in both the selected sources and the existing database.
            addresses={}
            def address(family,variant,catalogue):
                return tuple(normalize_identity(value) for value in (family,variant,catalogue))
            for row in prepared.rows:
                record=row['record'];key=address(record.product_family,record.product_variant,record.catalogue_number)
                group=addresses.setdefault(key,{'catalogue':record.catalogue_number,'identities':set(),'locations':[]})
                group['identities'].add(tuple(row['key']))
                for occurrence in row['provenance']['templates']:
                    origin=occurrence.get('source',{})
                    location={**origin,'identifier':row['key'][1],'issuer':row['key'][0]}
                    if location not in group['locations']:group['locations'].append(location)
            for key,previous in lookup.items():
                group=addresses.get(address(previous['product_family'],previous['product_variant'],previous['catalogue_number']))
                if group is not None:group['identities'].add(key)
            for group in addresses.values():
                identities=sorted(group['identities'])
                if len(identities)<2:continue
                catalogue_conflicts.append({'catalogue':group['catalogue'],
                    'identifier':'; '.join(f'{issuer} · {udi}' for issuer,udi in identities),
                    'identifiers':[{'issuer':issuer,'udi_di':udi} for issuer,udi in identities],
                    'locations':group['locations'],
                    'detail':f"Catalogue {group['catalogue']} is associated with {len(identities)} different Device UDI-DIs. Confirm or correct the source identities before continuing."})
            conflict_addresses={key for key,group in addresses.items() if len(group['identities'])>1}
            for row in new:
                record=row['record']
                if address(record.product_family,record.product_variant,record.catalogue_number) in conflict_addresses:
                    record.xml_blockers.append('Catalogue identity is unresolved; clarify the exact device identities before XML generation.')
                    record.xml_readiness.status='incomplete'
            keys={tuple(row['key']) for row in prepared.rows}
            already=None
            for entry in c.execute("SELECT notes FROM import_batch WHERE source_type='dev_prepared_workbook' ORDER BY id DESC"):
                previous=json.loads(entry['notes'])
                if (previous.get('batch_id'),previous.get('artifact_id'))==(batch_id,artifact_id):already=previous;break
            report={'batch_id':batch_id,'artifact_id':artifact_id,'environment':'dev','workbook_name':workbook.name,
                'workbook_sha256':prepared.workbook_hash,'audit_sha256':prepared.audit_hash,'input_token':input_token,
                'eligible_count':len(prepared.rows),'new_count':len(new),'existing_retained_count':len(existing_rows),
                'omitted_retained_count':len(set(lookup)-keys),'skipped_count':len(prepared.skipped),
                'new_registered_count':sum(r['snapshot'] is not None for r in new),
                'new_xml_blocked_count':sum(r['record'].xml_readiness.status!='complete' for r in new),
                'existing_accepted_state_updates':0,'differences':changes,'identity_conflicts':conflicts,
                'catalogue_conflicts':catalogue_conflicts, 'can_import':not catalogue_conflicts and not conflicts and not prepared.skipped and bool(prepared.rows),'already_imported':already is not None,
                'database_marker':marker,'configuration':self._configuration(),
                'plan_sha256':hashlib.sha256(dump([{'key':r['key'],'record':r['record'].model_dump(mode='json', exclude={'source_workbook'})} for r in prepared.rows]).encode()).hexdigest()}
            if already:report['previous_import']=already
            return report, prepared, new, existing_rows
        finally:
            if own:c.close()

    def assess(self,batch_id,artifact_id):
        report,_,_,_=self._plan(batch_id,artifact_id)
        assessment_id=uuid4().hex
        report.update(assessment_id=assessment_id,assessed_at=datetime.now(UTC).isoformat(),expires_at=(datetime.now(UTC)+timedelta(minutes=15)).isoformat())
        self._save(batch_id,'assessments',assessment_id,report)
        return report

    def _save(self,batch_id,folder,name,record):
        batch=self.batches._batch(batch_id);directory=batch/folder
        if directory.is_symlink():raise ValueError('Import report storage must not be a symlink')
        directory.mkdir(exist_ok=True)
        with (directory/(name+'.json')).open('x') as output:output.write(dump(record)+'\n')

    def _backup(self,run_id):
        if self.backups.is_symlink() or self.backups.resolve()!=self.backups:raise ValueError('Backup directory must not be redirected')
        self.backups.mkdir(exist_ok=True)
        path=self.backups/f'testing-state-before-workbook-import-{run_id}.sqlite3'
        if path.exists():raise ValueError('Backup already exists')
        with closing(self._connect()) as source,closing(sqlite3.connect(path)) as target:
            source.backup(target)
            if target.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('Backup integrity check failed')
        with closing(sqlite3.connect(path.resolve().as_uri()+'?mode=ro',uri=True)) as verified:
            verified.row_factory=sqlite3.Row
            marker=self._marker(verified)
        return {'path':str(path),'sha256':fingerprint(path),'integrity_check':'ok','database_marker':marker}

    def confirm(self,batch_id,artifact_id,assessment_id,confirmed_by,confirmed):
        if not confirmed or not confirmed_by.strip():raise ValueError('Review confirmation and importer attribution are required')
        if not re.fullmatch(r'[a-f0-9]{32}',assessment_id):raise ValueError('Invalid assessment reference')
        report_path=self.batches._batch(batch_id)/'assessments'/f'{assessment_id}.json'
        if report_path.is_symlink() or report_path.parent.is_symlink():raise ValueError('Invalid assessment storage')
        saved=json.loads(report_path.read_text())
        if saved['artifact_id']!=artifact_id or saved['batch_id']!=batch_id or saved['configuration']!=self._configuration():raise ValueError('Assessment scope/configuration differs; assess again')
        if datetime.now(UTC)>datetime.fromisoformat(saved['expires_at']):raise ValueError('Assessment expired; assess again')
        if not saved['can_import']:raise ValueError('Resolve assessment differences before importing')
        run_id=uuid4().hex;now=datetime.now(UTC).isoformat()
        with closing(self._connect(write=True)) as c:
            c.execute('BEGIN IMMEDIATE')
            try:
                # Do not re-map values after confirmation: recheck immutable inputs and full DB state under lock.
                _,_,_,input_token=self.batches._inputs(batch_id)
                artifact,_,_=self.batches.artifact(batch_id,artifact_id)
                if input_token!=saved['input_token'] or (artifact['workbook_sha256'],artifact['audit_sha256'])!=(saved['workbook_sha256'],saved['audit_sha256']):raise ValueError('Workbook or source files changed; assess again')
                # A committed repeat is a no-op, even when the old assessment predates its own import.
                for entry in c.execute("SELECT notes FROM import_batch WHERE source_type='dev_prepared_workbook' ORDER BY id DESC"):
                    result=json.loads(entry['notes'])
                    if (result.get('batch_id'),result.get('artifact_id'))==(batch_id,artifact_id):
                        c.rollback();return {**result,'already_imported':True}
                if self._marker(c)!=saved['database_marker']:raise ValueError('Database changed since assessment; assess again')
                current,prepared,new,existing=self._plan(batch_id,artifact_id,connection=c)
                if not current['can_import'] or current['database_marker']!=saved['database_marker'] or current['plan_sha256']!=saved['plan_sha256']:raise ValueError('Import plan changed; assess again')
                backup=self._backup(run_id)
                if backup['database_marker']!=saved['database_marker']:raise ValueError('Backup does not match the assessed database; import cancelled')
                result={**current,'confirmed_by':confirmed_by,'confirmed_at':now,'assessment_id':assessment_id,'backup':backup,'run_id':run_id,'already_imported':False}
                # All writes are in this transaction. No store constructors, schema setup, DELETE or pruning.
                import_id=c.execute('INSERT INTO import_batch(source_type,label,imported_at,imported_by,notes) VALUES(?,?,?,?,?)',('dev_prepared_workbook',f'Dev source batch {batch_id}',now,confirmed_by,'pending')).lastrowid
                wb=c.execute('INSERT INTO source_workbook(import_batch_id,workbook_name,file_path,file_hash,loaded_at) VALUES(?,?,?,?,?)',(import_id,prepared.report['workbook'],str(self.batches.artifact(batch_id,artifact_id)[1]),saved['workbook_sha256'],now)).lastrowid
                existing_by_id={r['existing_id']:r for r in existing}
                retained_workbooks={}
                # Retain complete current projections and source lineage, including omitted/skipped devices.
                for device in list(c.execute('''SELECT d.id,c.id AS canonical_id,c.source_row_id FROM device_subject d JOIN canonical_device_record c ON c.device_subject_id=d.id''')):
                    row=existing_by_id.get(device['id'])
                    source=c.execute('SELECT * FROM source_row WHERE id=?',(device['source_row_id'],)).fetchone()
                    if source is None:raise ValueError('Existing canonical source row is missing; import rolled back')
                    payload=json.loads(source['raw_payload_json'])
                    if row:
                        payload['dev_prepared_import']={'batch_id':batch_id,'artifact_id':artifact_id,'proposed_values':{k:v for k,v in row['values'].items() if k.startswith(('Proposed: ','Proposed Parent: '))},'prior_source_row_id':source['id']}
                    else:payload['retained_source_row_id']=source['id']
                    old_workbook_id=source['source_workbook_id']
                    if old_workbook_id not in retained_workbooks:
                        old_workbook=c.execute('SELECT * FROM source_workbook WHERE id=?',(old_workbook_id,)).fetchone()
                        retained_workbooks[old_workbook_id]=c.execute('INSERT INTO source_workbook(import_batch_id,workbook_name,file_path,file_hash,loaded_at) VALUES(?,?,?,?,?)',(import_id,old_workbook['workbook_name'],old_workbook['file_path'],old_workbook['file_hash'],now)).lastrowid
                    source_id=c.execute('''INSERT INTO source_row(source_workbook_id,sheet_name,row_index,product_family,product_variant,catalogue_number,primary_udi_di,submission_operation,raw_payload_json,canonical_status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)''',(retained_workbooks[old_workbook_id],source['sheet_name'],source['row_index'],source['product_family'],source['product_variant'],source['catalogue_number'],source['primary_udi_di'],source['submission_operation'],dump(payload),source['canonical_status'],now)).lastrowid
                    c.execute('UPDATE device_subject SET current_source_row_id=?,updated_at=? WHERE id=?',(source_id,now,device['id']))
                    c.execute('UPDATE canonical_device_record SET source_row_id=?,source_import_batch_id=? WHERE id=?',(source_id,import_id,device['canonical_id']))
                for row in new:self._insert(c,row,wb,import_id,now,batch_id,artifact_id)
                # Current canonical rows are unique per device; the existing snapshot builder is read/append only.
                ProductionWorkbookImporter._snapshot(c,import_id, family_scope="Dev devices")
                result.update(import_batch_id=import_id,created_count=len(new),database_changed=True,retained_source_workbook_ids=list(retained_workbooks))
                c.execute('UPDATE import_batch SET notes=? WHERE id=?',(dump(result),import_id))
                if self.batches._inputs(batch_id)[3]!=saved['input_token']:raise ValueError('Batch changed during import; rolled back')
                self.batches.artifact(batch_id,artifact_id)  # Reject changed workbook/audit before commit.
                if self._configuration()!=saved['configuration']:raise ValueError('Import configuration changed; rolled back')
                if c.execute('PRAGMA foreign_key_check').fetchone() is not None:raise ValueError('Import integrity check failed; rolled back')
                c.commit()
            except BaseException:
                c.rollback();raise
        try:self._save(batch_id,'imports',run_id,result)
        except (OSError,ValueError):result['report_warning']='Database committed; report is retained in import history but the file copy could not be saved.'
        return result

    def _insert(self,c,row,workbook,import_id,now,batch_id,artifact_id):
        record=row['record'];payload={'prepared_values':row['values'],'dev_prepared_import':{'batch_id':batch_id,'artifact_id':artifact_id,'proposed_values':{k:v for k,v in row['values'].items() if k.startswith(('Proposed: ','Proposed Parent: '))}},'provenance':row['provenance']}
        source=c.execute('''INSERT INTO source_row(source_workbook_id,sheet_name,row_index,product_family,product_variant,catalogue_number,primary_udi_di,submission_operation,raw_payload_json,canonical_status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)''',(workbook,row['sheet'],row['number'],record.product_family,record.product_variant,record.catalogue_number,record.primary_udi_di,record.submission_operation,dump(payload),'xml_ready' if record.xml_readiness.status=='complete' else 'xml_blocked',now)).lastrowid
        parent=row['values'].get('Proposed Basic UDI-DI') or row['values'].get('Accepted Basic UDI-DI')
        subject=c.execute('INSERT INTO device_subject(subject_key,product_family,product_variant,catalogue_number,primary_udi_di,basic_udi_di,current_source_row_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',(row['subject_key'],record.product_family,record.product_variant,record.catalogue_number,record.primary_udi_di,parent,source,now,now)).lastrowid
        canonical=c.execute('INSERT INTO canonical_device_record(device_subject_id,source_row_id,source_import_batch_id,canonical_version,canonical_status,completeness_status,xml_readiness_status,xml_ready,record_json,completeness_json,blockers_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)',(subject,source,import_id,1,'xml_ready' if not record.xml_blockers else 'xml_blocked',record.completeness.status,record.xml_readiness.status,int(record.xml_readiness.status=='complete'),dump(record.model_dump(mode='json')),dump({'completeness':record.completeness.model_dump(),'xml_readiness':record.xml_readiness.model_dump()}),dump({'blockers':record.blockers,'xml_blockers':record.xml_blockers}))).lastrowid
        for field in record.fields:
            c.execute('INSERT INTO canonical_field_value(canonical_device_record_id,canonical_path,field_status,required,value_json,source_headers_json,review_note) VALUES(?,?,?,?,?,?,?)',(canonical,field.canonical_path,'populated' if field.value is not None else 'missing',int(field.required),dump(field.value) if field.value is not None else None,dump([field.source_detail]),field.review_note))
        if row['snapshot'] is None:return
        snapshot={**row['snapshot'],'accepted_state_source':'playground_export','import_batch_id':import_id};full=snapshot['device_record']
        testing=c.execute('''INSERT INTO testing_subjects(subject_key,device_subject_id,normalized_product_family,normalized_product_variant,normalized_catalogue_number,normalized_primary_udi_di,normalized_basic_udi_di,product_family,product_variant,catalogue_number,primary_udi_di,basic_udi_di) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''',(row['subject_key'],subject,normalize_identity(record.product_family),normalize_identity(record.product_variant),normalize_identity(record.catalogue_number),normalize_identity(record.primary_udi_di),normalize_identity(parent),record.product_family,record.product_variant,record.catalogue_number,record.primary_udi_di,parent)).lastrowid
        market={'version':snapshot['market_info_version'],'market_countries':snapshot['market_countries'],'accepted_state_source':'playground_export'}
        c.execute("INSERT INTO testing_events(subject_id,event_index,message_type,status,event_kind,accepted_state_source,version,source_file_name,state_after_json,raw_event_json) VALUES(?,1,'PLAYGROUND_EXPORT.SNAPSHOT','IMPORTED','BASELINE_IMPORT','playground_export',?,?,?,?)",(testing,snapshot['version'],snapshot['export_source']['file'],dump(snapshot),dump({'import_batch_id':import_id,'batch_id':batch_id,'artifact_id':artifact_id,'export_source':snapshot['export_source']})))
        c.execute("UPDATE testing_subjects SET registration_status='child_registered',latest_successful_version=?,latest_successful_state_json=?,latest_successful_market_info_version=?,latest_successful_market_info_state_json=? WHERE id=?",(snapshot['version'],dump(snapshot),market['version'],dump(market),testing))
