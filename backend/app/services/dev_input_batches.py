"""Copy and inspect Dev input batches without opening application databases.

No configuration is switched and no workbook, baseline or database is imported.
Source inspection reuses the existing preparation readers and their checks.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, UTC
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile
from zipfile import BadZipFile

from dotenv import dotenv_values
from lxml import etree
from openpyxl.utils.exceptions import InvalidFileException

from app.services.production_workbook_preparation import _exports, _parent_reference, _templates


def fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def create_dev_batch(*, project_root: Path, xml_dir: Path, batch_id: str) -> Path:
    """Publish a new, byte-verified batch; never overwrite an existing batch."""
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}-\d{3}", batch_id):
        raise ValueError("Batch ID must be YYYY-MM-DD-NNN")
    root = project_root.resolve()
    profile = dotenv_values(root / ".env.dev", interpolate=False)
    if profile.get("EUDAMED_ENVIRONMENT") != "dev":
        raise ValueError("The source project must have an explicit Dev profile")
    actor = profile.get("EUDAMED_MANUFACTURER_SRN_OVERRIDE")
    if not actor:
        raise ValueError("Dev manufacturer SRN is required for export checks")
    sources = {
        "templates": sorted((root / "data/source_excel").glob("*.xlsx")),
        "basic-udi": [root / "data/basic_udi_reference/BasicUDIs.xlsx"],
        "eudamed-xml": sorted(xml_dir.resolve().glob("*.xml")),
    }
    sources = {role: [p for p in paths if not p.name.startswith("~$")] for role, paths in sources.items()}
    if any(not paths for paths in sources.values()):
        raise ValueError("Templates, Basic UDI-DI reference and XML exports are all required")
    for paths in sources.values():
        for source in paths:
            if not source.is_file() or (root / "data/prod").resolve() in source.resolve().parents:
                raise ValueError(f"Missing or Production source file: {source}")
    base = root / "data/dev/import-batches"
    # Refuse a local symlink that would redirect batch publication outside Dev.
    if not base.resolve().is_relative_to((root / "data/dev").absolute()) or (root / "data/dev").is_symlink():
        raise ValueError("Dev batch storage must remain beneath the project's data/dev folder")
    base.mkdir(parents=True, exist_ok=True)
    destination = base / batch_id
    if destination.exists():
        raise ValueError(f"Batch already exists; choose a new ID: {destination}")
    with tempfile.TemporaryDirectory(prefix=".preparing-", dir=base) as temporary:
        staged = Path(temporary) / batch_id
        staged.mkdir()
        manifest = {"format_version": 1, "environment": "dev", "batch_id": batch_id,
                    "created_at": datetime.now(UTC).isoformat(), "manufacturer_srn": actor,
                    "source_project": str(root), "files": []}
        for role, paths in sources.items():
            (staged / role).mkdir()
            for source in paths:
                before = fingerprint(source)
                target = staged / role / source.name
                shutil.copy2(source, target)
                if fingerprint(target) != before or fingerprint(source) != before:
                    raise ValueError(f"Source changed during copy: {source}")
                manifest["files"].append({"role": role, "path": str(target.relative_to(staged)),
                    "source_path": str(source.resolve()), "size_bytes": target.stat().st_size,
                    "sha256": before, "source_modified_at": datetime.fromtimestamp(source.stat().st_mtime, UTC).isoformat()})
        (staged / "prepared").mkdir()
        (staged / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        # A completed manifest is published with its inputs. No partial batch is exposed.
        staged.rename(destination)
    return destination


def verify_dev_batch_inputs(batch_dir: Path) -> dict:
    """Verify the immutable file inventory before any source reading or preparation."""
    batch = batch_dir.resolve()
    manifest = json.loads((batch / "manifest.json").read_text())
    if manifest.get("environment") != "dev" or manifest.get("format_version") != 1:
        raise ValueError("Expected a version-1 Dev input batch")
    expected = set()
    for entry in manifest["files"]:
        path = batch / entry["path"]
        if not path.resolve().is_relative_to(batch) or not path.is_file():
            raise ValueError("Manifest contains an absent file or an escaping path")
        if fingerprint(path) != entry["sha256"] or path.stat().st_size != entry["size_bytes"]:
            raise ValueError(f"Batch input no longer matches its manifest: {entry['path']}")
        expected.add(path.relative_to(batch).as_posix())
    actual = {p.relative_to(batch).as_posix() for role in ("templates", "basic-udi", "eudamed-xml")
              for p in (batch / role).rglob("*") if p.is_file()}
    if actual != expected:
        raise ValueError("Batch has added or missing input files; create a new batch")
    return manifest


def inspect_dev_batch(batch_dir: Path, *, excluded_workbook_names: tuple[str, ...] = ()) -> dict:
    """Return source findings only; does not create reports or write any inputs."""
    batch = batch_dir.resolve()
    manifest = verify_dev_batch_inputs(batch)
    expected = {entry["path"] for entry in manifest["files"]}
    reference = batch / "basic-udi/BasicUDIs.xlsx"
    findings = {"batch_id": manifest["batch_id"], "environment": "dev",
                "manufacturer_srn": manifest["manufacturer_srn"],
                "assessed_at": datetime.now(UTC).isoformat(), "file_integrity": "verified",
                "file_count": len(expected), "errors": [], "inspection_complete": False,
                "database_accessed": False, "workbook_created": False,
                "scope_note": "All copied Templates inspected; this does not change the current importer's workbook exclusions."}
    try:
        models, parents = _parent_reference(reference)
        templates, _, template_files = _templates(batch / "templates", models, parents, parent_reference=reference)
        unknown_exclusions = set(excluded_workbook_names) - {entry["file"] for entry in template_files}
        if unknown_exclusions:
            raise ValueError(f"Excluded workbook names are not in this batch: {sorted(unknown_exclusions)}")
        exports, export_files = _exports(batch / "eudamed-xml", {})
        for path in (batch / "eudamed-xml").glob("*.xml"):
            tree = etree.parse(str(path), etree.XMLParser(resolve_entities=False, no_network=True))
            if tree.getroot().get("version") != "3.0.32":
                raise ValueError(f"Dev export must declare version 3.0.32: {path.name}")
            actors = set(tree.xpath('//*[local-name()="MFActorCode"]/text()'))
            if actors != {manifest["manufacturer_srn"]}:
                raise ValueError(f"Export manufacturer differs from the selected Dev actor: {path.name}")
        proposed = {tuple(row["key"]) for row in templates if all(row["key"])}
        accepted = {tuple(row["key"]) for row in exports}
        reasons = Counter(reason for row in templates for reason in row["reasons"])
        active_rows = [row for row in templates if row["source"]["file"] not in excluded_workbook_names]
        active_keys = {tuple(row["key"]) for row in active_rows if all(row["key"])}
        findings.update(inspection_complete=True, parent_identities=len(parents),
            templates={"files": len(template_files), "row_occurrences": len(templates),
                       "distinct_device_identities": len(proposed),
                       "duplicate_identity_occurrences": sum(count - 1 for key, count in Counter(tuple(row["key"]) for row in templates if all(row["key"])).items()),
                       "rows_with_findings": sum(bool(row["reasons"]) for row in templates),
                       "finding_counts": dict(reasons),
                       "rows_by_workbook": dict(Counter(row["source"]["file"] for row in templates)),
                       "rows_with_findings_by_workbook": dict(Counter(row["source"]["file"] for row in templates if row["reasons"]))},
            requested_inspection_scope={"excluded_workbook_names": list(excluded_workbook_names),
                "note": "Inspection filter only; no application import configuration is changed.",
                "row_occurrences": len(active_rows), "distinct_device_identities": len(active_keys),
                "duplicate_identity_occurrences": sum(count - 1 for count in Counter(tuple(row["key"]) for row in active_rows if all(row["key"])).values()),
                "rows_with_findings": sum(bool(row["reasons"]) for row in active_rows),
                "finding_counts": dict(Counter(reason for row in active_rows for reason in row["reasons"])),
                "in_exports": len(active_keys & accepted), "export_only": len(accepted - active_keys)},
            exports={"files": len(export_files), "device_records": len(exports),
                     "distinct_device_identities": len(accepted), "pages": export_files,
                     "finding_counts": dict(Counter(reason for row in exports for reason in row["reasons"]))},
            identity_overlap={"in_both": len(proposed & accepted), "template_only": len(proposed - accepted),
                              "export_only": len(accepted - proposed)})
    except (ValueError, OSError, etree.LxmlError, BadZipFile, InvalidFileException) as exc:
        findings["errors"].append(str(exc))
    return findings
