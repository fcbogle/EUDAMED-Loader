"""Select complete retained Data Import XML sets without writing application state."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tempfile

from lxml import etree

from app.services.dev_batch_preparation import DevBatchPreparation
from app.services.playground_reconciliation import timestamp
from app.services.production_workbook_preparation import NS, _exports


class RetainedEudamedExtracts:
    def __init__(self, settings):
        self.settings = settings
        self.batches = DevBatchPreparation(settings)  # Path/environment checks only; no stores or mkdir.
        if any(self.batches.root.parts[i:i+2] == ('data', 'prod') for i in range(len(self.batches.root.parts)-1)):
            raise ValueError('Dev report sources must not use Production storage')

    def _read(self, batch_id):
        batch = self.batches._batch(batch_id)
        manifest_path = batch / 'manifest.json'
        if manifest_path.is_symlink():
            raise ValueError('Retained manifest must not be a symlink')
        manifest_bytes = manifest_path.read_bytes()
        manifest = json.loads(manifest_bytes)
        if (not isinstance(manifest, dict) or not isinstance(manifest.get('files'), list)
                or any(not isinstance(item, dict) for item in manifest['files'])):
            raise ValueError('Retained set manifest is malformed')
        if (manifest.get('format_version') != 1 or manifest.get('environment') != self.settings.environment
                or manifest.get('batch_id') != batch_id
                or manifest.get('manufacturer_srn') != self.settings.eudamed_manufacturer_srn_override):
            raise ValueError('Retained set identity, environment or manufacturer does not match')
        inputs = [item for item in manifest['files'] if item['role'] == 'eudamed-xml']
        if not inputs or len(inputs) > 100:
            raise ValueError('Retained set has no usable XML inventory')
        xml_root = batch / 'eudamed-xml'
        if xml_root.is_symlink():
            raise ValueError('Retained XML directory must not be redirected')
        contents, evidence, dates, declared_paths = [], [], [], set()
        size = 0
        for item in inputs:
            relative = PurePosixPath(item['path'])
            if (relative.is_absolute() or len(relative.parts) != 2 or relative.parts[0] != 'eudamed-xml'
                    or not relative.name.lower().endswith('.xml') or str(relative) in declared_paths):
                raise ValueError('Retained XML manifest contains an invalid or repeated path')
            declared_paths.add(str(relative))
            path = batch / str(relative)
            if path.is_symlink() or not path.resolve().is_relative_to(batch.resolve()) or not path.is_file():
                raise ValueError('Retained XML file is unavailable or redirected')
            if path.stat().st_size > 20 * 1024 * 1024:
                raise ValueError('Retained XML file exceeds the supported 20 MB size')
            data = path.read_bytes()
            size += len(data)
            if size > 60 * 1024 * 1024:
                raise ValueError('Retained XML set exceeds the supported 60 MB size')
            digest = hashlib.sha256(data).hexdigest()
            if digest != item['sha256'] or len(data) != item['size_bytes']:
                raise ValueError('Retained XML does not match its Data Import manifest')
            root = etree.fromstring(data, etree.XMLParser(resolve_entities=False, no_network=True))
            if root.getroottree().docinfo.doctype:
                raise ValueError('DOCTYPE is not supported in retained XML')
            if root.tag != f'{{{NS["message"]}}}PullResponse':
                raise ValueError('Retained XML is not a EUDAMED PullResponse extract')
            if root.get('version') != self.settings.eudamed_message_schema_version:
                raise ValueError('Retained extract schema does not match the active environment')
            if set(root.xpath('//*[local-name()="MFActorCode"]/text()')) != {manifest['manufacturer_srn']}:
                raise ValueError('Retained extract manufacturer does not match the active environment')
            created_at = (root.findtext('message:creationDateTime', namespaces=NS) or '').strip()
            date = timestamp(created_at)
            if date is None:
                raise ValueError('Retained export dates need usable timezone-bearing timestamps')
            dates.append(date)
            contents.append((relative.name, data))
            evidence.append({'kind': 'Retained Data Import extract', 'name': relative.name,
                             'sha256': digest, 'created_at': created_at})
        actual = {path.relative_to(batch).as_posix() for path in xml_root.iterdir()
                  if path.suffix.lower() == '.xml'}
        if actual != declared_paths:
            raise ValueError('Retained XML file inventory differs from its manifest')
        # Parse captured, hash-verified bytes. Never mix pages from other batches.
        with tempfile.TemporaryDirectory(prefix='retained-eudamed-') as temporary:
            directory = Path(temporary)
            for index, (_, data) in enumerate(contents):
                (directory / f'{index}.xml').write_bytes(data)
            entries, files = _exports(directory, {})
            for entry in entries:
                entry['source']['file'] = contents[int(Path(entry['source']['file']).stem)][0]
            for file in files:
                file['file'] = contents[int(Path(file['file']).stem)][0]
        exported = {}
        for entry in entries:
            key = tuple(entry['key'])
            if key in exported:
                raise ValueError('Duplicate exported device identities require review')
            exported[key] = entry
        digest = hashlib.sha256(json.dumps(sorted(e['sha256'] for e in evidence)).encode()).hexdigest()
        context = {'batch_id': batch_id, 'set_sha256': digest,
            'manifest_sha256': hashlib.sha256(manifest_bytes).hexdigest(),
            'exported_from': min(dates).isoformat(), 'exported_to': max(dates).isoformat(),
            'file_count': len(files), 'device_count': len(exported), 'complete_pages': True,
            'retained_batches': [batch_id],
            'selection_reason': 'Latest suitable complete retained extract set by recorded export dates',
            'scope': 'Set membership follows the Data Import manifest. Business export filters are not established; absence does not prove unregistration.',
            'source_status': 'Retained source batch; this does not establish completion of database import or registration.'}
        return {'selected': context, 'exported': exported, 'export_files': files, 'evidence': evidence}

    def select(self):
        candidates, excluded = {}, []
        if self.batches.root.is_dir():
            for path in sorted(self.batches.root.iterdir(), reverse=True):
                if not re.fullmatch(r'\d{4}-\d{2}-\d{2}-\d{3}', path.name):
                    continue
                try:
                    result = self._read(path.name)
                except (ValueError, KeyError, TypeError, OSError, etree.XMLSyntaxError) as exc:
                    # Expected source failures are report context, not zero-count results.
                    reason = str(exc) if not isinstance(exc, OSError) else 'Retained source files are unavailable'
                    excluded.append({'batch_id': path.name, 'reason': reason})
                    continue
                digest = result['selected']['set_sha256']
                if digest in candidates:
                    candidates[digest]['selected']['retained_batches'].append(path.name)
                else:
                    candidates[digest] = result
        if not candidates:
            return {'available': False, 'selected': None, 'excluded_sets': excluded,
                    'reason': 'No suitable complete retained EUDAMED extract set is available. Add or correct the extracts through Data Import.'}
        ordered = sorted(candidates.values(), key=lambda item: timestamp(item['selected']['exported_to']), reverse=True)
        chosen = ordered[0]
        start = timestamp(chosen['selected']['exported_from'])
        conflicts = [item['selected']['batch_id'] for item in ordered[1:]
                     if timestamp(item['selected']['exported_to']) >= start]
        if conflicts:
            return {'available': False, 'selected': None, 'excluded_sets': excluded,
                    'reason': 'Conflicting retained extract sets have overlapping export dates. Resolve their ordering through Data Import before reporting.'}
        return {'available': True, 'excluded_sets': excluded, **chosen}

    def status(self):
        result = self.select()
        return {key: value for key, value in result.items() if key not in {'exported', 'export_files', 'evidence'}}
