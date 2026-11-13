"""Production import path boundary checks; no directories or databases are created."""
import xml.etree.ElementTree as ET


def production_paths(settings):
    if settings.environment != 'prod' or settings.data_root is None:
        raise PermissionError('Production import requires the Production profile')
    if settings.eudamed_message_schema_version != '3.0.30' or not settings.eudamed_manufacturer_srn_override:
        raise PermissionError('Production import requires schema 3.0.30 and an explicit manufacturer')
    schema = settings.schema_dir / 'service/Message/MessageType.xsd'
    try:
        versions = {node.get('fixed') for node in ET.parse(schema).getroot().findall('.//{http://www.w3.org/2001/XMLSchema}attribute') if node.get('name') == 'version'}
    except (OSError, ET.ParseError) as exc:
        raise ValueError('Production message schema cannot be read') from exc
    if versions != {'3.0.30'}:
        raise PermissionError('Production import schema package must declare 3.0.30')
    root = settings.data_root.absolute()
    database = settings.testing_state_db_path.absolute()
    backups = settings.testing_state_backup_dir.absolute()
    batches = root / 'import-batches'
    for path in (root, database, backups, batches):
        if any(parent.is_symlink() for parent in (path, *path.parents)):
            raise PermissionError('Production import paths must not contain symlinks')
        if path != root and (not path.is_relative_to(root) or path == root):
            raise PermissionError('Production import storage must remain inside the configured Production data root')
    for left, right in ((database, backups), (database, batches), (backups, batches)):
        if left == right or left in right.parents or right in left.parents:
            raise PermissionError('Production database, backups and source batches must be separate')
    if not database.is_file():
        raise ValueError('The existing Production database is missing; no database will be created')
    if database.stat().st_nlink != 1:
        raise PermissionError('Production import database must not be a hard-link alias')
    return root, database, backups, batches
