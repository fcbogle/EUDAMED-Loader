"""Receive browser-selected Dev files as a dated immutable batch; never access SQLite."""
from __future__ import annotations

import base64
import binascii
from datetime import date, datetime, UTC
from pathlib import Path
import json
import tempfile
from zoneinfo import ZoneInfo
from zipfile import ZipFile, BadZipFile

import lxml.etree as etree
from pydantic import BaseModel, Field

from app.services.dev_batch_preparation import DevBatchPreparation
from app.services.dev_input_batches import fingerprint

MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_TOTAL_BYTES = 60 * 1024 * 1024
MAX_REQUEST_BYTES = 85 * 1024 * 1024


class BatchContact(BaseModel):
    name: str = Field(default='', max_length=200)
    email: str = Field(default='', max_length=254)
    team_role: str = Field(default='', max_length=200)



class ReceiptMetadata(BaseModel):
    creator: BatchContact = Field(default_factory=BatchContact)
    description: str = Field(default='', max_length=2000)
    source_date: date | None = None
    export_date: date | None = None
    # Kept for reading earlier receipts; coverage is checked from the selected XML pages.
    complete_scope_confirmed: bool = False


class ReceivedFile(BaseModel):
    role: str = Field(pattern=r'^(templates|basic-udi|eudamed-xml)$')
    name: str = Field(min_length=1, max_length=180)
    content_base64: str = Field(max_length=28 * 1024 * 1024)
    modified_at: datetime | None = None


class ReceiptRequest(BaseModel):
    metadata: ReceiptMetadata
    files: list[ReceivedFile] = Field(min_length=3, max_length=100)


def receive_batch(service: DevBatchPreparation, request: ReceiptRequest, *, source_review: dict | None = None) -> dict:
    # Service construction enforces Dev-only. Guard symlinks before mkdir/writes.
    root = service.root
    if any(p.is_symlink() for p in [root, *root.parents]) or root.parts[-3:] != ('data', 'dev', 'import-batches'):
        raise ValueError('Batch storage must be a real Dev data/import-batches directory')
    decoded = decode_files(request.files)
    root.mkdir(parents=True, exist_ok=True)
    lock = root / '.receiving.lock'
    try:
        handle = lock.open('x')
    except FileExistsError as exc:
        raise ValueError('Another batch is being received; wait and retry') from exc
    try:
        with handle, tempfile.TemporaryDirectory(prefix='.receiving-', dir=root) as temporary:
            staged = Path(temporary) / 'batch'
            staged.mkdir()
            now = datetime.now(UTC)
            prefix = now.astimezone(ZoneInfo('Europe/London')).date().isoformat()
            batch_id = next((f'{prefix}-{n:03}' for n in range(1, 1000) if not (root / f'{prefix}-{n:03}').exists()), None)
            if batch_id is None:
                raise ValueError('No batch sequence available for this date')
            write_inputs(service, request, staged, batch_id, decoded)
            if source_review is not None:
                (staged / 'source-review.json').write_text(json.dumps({**source_review,
                    'manifest_sha256': fingerprint(staged / 'manifest.json')}, indent=2)+'\n')
            if (root / batch_id).exists():
                raise ValueError('Batch ID was taken during receipt; retry to create a new batch')
            staged.rename(root / batch_id)
    finally:
        lock.unlink(missing_ok=True)
    return service.describe(batch_id)


def decode_files(files: list[ReceivedFile], *, require_complete=True):
    roles = [f.role for f in files]
    if roles.count('basic-udi') > 1 or (require_complete and (roles.count('basic-udi') != 1 or not {'templates', 'eudamed-xml'} <= set(roles))):
        raise ValueError('Select Template workbooks, exactly one BasicUDI workbook and XML extracts')
    decoded = []
    names = set()
    total = 0
    for item in files:
        if item.name != Path(item.name).name or any(c in item.name for c in '/\\:') or item.name.startswith(('~$', '.')) or any(ord(c) < 32 for c in item.name):
            raise ValueError('Use ordinary filenames without paths, temporary names or control characters')
        extension = '.xml' if item.role == 'eudamed-xml' else '.xlsx'
        if Path(item.name).suffix != extension:
            raise ValueError(f'{item.name}: expected {extension}')
        stored_name = 'BasicUDIs.xlsx' if item.role == 'basic-udi' else item.name
        key = (item.role, stored_name.casefold())
        if key in names:
            raise ValueError(f'Duplicate filename in the same input group: {item.name}')
        names.add(key)
        try:
            data = base64.b64decode(item.content_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError(f'Unable to receive {item.name}; select the file again') from exc
        total += len(data)
        if not data or len(data) > MAX_FILE_BYTES or total > MAX_TOTAL_BYTES:
            raise ValueError('Files must be non-empty, at most 20 MB each and 60 MB per batch')
        decoded.append((item, stored_name, data))
    return decoded


def write_inputs(service, request, staged: Path, batch_id: str, decoded, *, validate_content=True):
    now = datetime.now(UTC)
    manifest = {'format_version': 1, 'environment': 'dev', 'batch_id': batch_id,
                'created_at': now.isoformat(), 'manufacturer_srn': service.settings.eudamed_manufacturer_srn_override,
                'receipt': {**request.metadata.model_dump(mode='json'), 'identity_source': 'user_supplied', 'transport': 'browser_upload'}, 'files': []}
    if not manifest['manufacturer_srn']:
        raise ValueError('Configure the Dev manufacturer before receiving files')
    for role in ('templates', 'basic-udi', 'eudamed-xml', 'prepared'):
        (staged / role).mkdir()
    for item, name, data in decoded:
        path = staged / item.role / name
        path.write_bytes(data)
        if validate_content:
            validate_received_content(path, item, manifest['manufacturer_srn'])
        manifest['files'].append({'role': item.role, 'path': f'{item.role}/{name}', 'original_name': item.name,
            'source_path': None, 'source_modified_at': (item.modified_at or now).isoformat(),
            'received_at': now.isoformat(), 'size_bytes': len(data), 'sha256': fingerprint(path)})
    (staged / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


def validate_received_content(path, item, manufacturer):
    if item.role == 'eudamed-xml':
        try:
            tree = etree.parse(str(path), etree.XMLParser(resolve_entities=False, no_network=True))
        except etree.LxmlError as exc:
            raise ValueError(f'{item.name}: XML cannot be read') from exc
        export_root = tree.getroot()
        if export_root is None or tree.docinfo.doctype or etree.QName(export_root).localname != 'PullResponse':
            raise ValueError(f'{item.name}: select device extracts, not Success XML acknowledgements')
        if export_root.get('version') != '3.0.32' or set(tree.xpath('//*[local-name()="MFActorCode"]/text()')) != {manufacturer}:
            raise ValueError(f'{item.name}: export schema/manufacturer does not match Dev')
    else:
        try:
            with ZipFile(path) as book:
                if 'xl/workbook.xml' not in book.namelist() or sum(i.file_size for i in book.infolist()) > 150 * 1024 * 1024:
                    raise ValueError(f'{item.name}: unsupported or oversized Excel workbook')
        except BadZipFile as exc:
            raise ValueError(f'{item.name}: not a valid .xlsx workbook') from exc
