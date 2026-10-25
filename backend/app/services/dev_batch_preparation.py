"""Dev-only batch checks and review-workbook artifacts. Never opens SQLite."""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, UTC
import hashlib
import io
import json
from pathlib import Path
import re
import tempfile
from uuid import uuid4
import zipfile

from app.config import Settings
from app.services.dev_input_batches import fingerprint, inspect_dev_batch, verify_dev_batch_inputs
from app.services.production_workbook_preparation import prepare_workbook

PREPARATION_CONTRACT = "dev-review-v2-export-absence-unknown"

class DevBatchPreparation:
    def __init__(self, settings: Settings):
        if settings.environment != "dev":
            raise PermissionError("Batch preparation is currently available only in Dev")
        if settings.dev_input_batch_root is None:
            raise ValueError("Dev batch storage is not configured")
        self.settings = settings
        self.root = settings.dev_input_batch_root.resolve()
        if self.root.parts[-3:] != ("data", "dev", "import-batches"):
            raise ValueError("Dev batch storage must be data/dev/import-batches")

    def _batch(self, batch_id: str) -> Path:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}-\d{3}", batch_id):
            raise ValueError("Invalid batch ID")
        path = self.root / batch_id
        if path.is_symlink() or path.resolve().parent != self.root:
            raise ValueError("Batch path escapes configured Dev storage")
        if not path.is_dir():
            raise FileNotFoundError("Dev batch not found")
        return path

    def _inputs(self, batch_id: str) -> tuple[Path, dict, tuple[str, ...], str]:
        batch = self._batch(batch_id)
        manifest = verify_dev_batch_inputs(batch)
        if manifest["batch_id"] != batch_id or manifest["manufacturer_srn"] != self.settings.eudamed_manufacturer_srn_override:
            raise ValueError("Batch environment, identity or manufacturer does not match current Dev configuration")
        filenames = {entry["path"].split("/")[-1] for entry in manifest["files"] if entry["role"] == "templates"}
        exclusions = tuple(name for name in self.settings.excluded_excel_workbook_names if name in filenames)
        evidence = {"manifest_sha256": fingerprint(batch / "manifest.json"), "exclusions": exclusions,
                    "manufacturer": manifest["manufacturer_srn"], "preparation_contract": PREPARATION_CONTRACT}
        token = hashlib.sha256(json.dumps(evidence, sort_keys=True).encode()).hexdigest()
        return batch, manifest, exclusions, token

    def describe(self, batch_id: str) -> dict:
        batch, manifest, exclusions, _ = self._inputs(batch_id)
        files = [{"name": Path(entry["path"]).name, "role": entry["role"], "size_bytes": entry["size_bytes"],
                  "sha256": entry["sha256"], "source_modified_at": entry["source_modified_at"],
                  "excluded": entry["role"] == "templates" and Path(entry["path"]).name in exclusions}
                 for entry in manifest["files"]]
        return {"batch_id": batch_id, "created_at": manifest["created_at"], "manufacturer_srn": manifest["manufacturer_srn"],
                "environment": "dev", "file_integrity": "verified", "files": files}

    def list_batches(self) -> dict:
        batches = []
        if self.root.exists():
            for path in sorted(self.root.iterdir(), reverse=True):
                if re.fullmatch(r"\d{4}-\d{2}-\d{2}-\d{3}", path.name):
                    try:
                        batches.append(self.describe(path.name))
                    except (ValueError, OSError, KeyError, TypeError) as exc:
                        batches.append({"batch_id": path.name, "error": str(exc)})
        return {"batches": batches}

    def inspect(self, batch_id: str) -> dict:
        batch, _, exclusions, before = self._inputs(batch_id)
        result = inspect_dev_batch(batch, excluded_workbook_names=exclusions)
        if self._inputs(batch_id)[3] != before:
            raise ValueError("Inputs changed during checking; select and check the batch again")
        return {**result, "inspection_token": before if result["inspection_complete"] else None}

    @contextmanager
    def _writer(self, prepared: Path):
        prepared.mkdir(exist_ok=True)
        if prepared.is_symlink():
            raise ValueError("Prepared output must not be a symlink")
        lock = prepared / ".preparing.lock"
        try:
            with lock.open("x"):
                pass
        except FileExistsError:
            raise ValueError("Another workbook is being prepared; wait and retry") from None
        try:
            yield
        finally:
            lock.unlink(missing_ok=True)

    def prepare(self, batch_id: str, inspection_token: str) -> dict:
        batch, manifest, exclusions, token = self._inputs(batch_id)
        if not inspection_token or token != inspection_token:
            raise ValueError("Source checks are missing or stale; check the batch again")
        prepared = batch / "prepared"
        with self._writer(prepared), tempfile.TemporaryDirectory(prefix=".preparing-", dir=prepared) as temporary:
            output = Path(temporary) / "output"
            result = prepare_workbook(template_dir=batch / "templates", xml_dir=batch / "eudamed-xml",
                parent_reference=batch / "basic-udi/BasicUDIs.xlsx", output_dir=output,
                excluded_workbook_names=exclusions, output_prefix="dev-import", environment_label="Dev",
                unmatched_status_label="Not evidenced by supplied exports")
            if self._inputs(batch_id)[3] != token:
                raise ValueError("Inputs changed during preparation; check the batch again")
            workbook, audit = Path(result.pop("workbook")), Path(result.pop("audit"))
            evidence = json.loads(audit.read_text())
            evidence["dev_input_batch"] = {"batch_id": batch_id, "inspection_token": token,
                "manifest": manifest, "excluded_template_workbooks": list(exclusions),
                "scope_limitation": "Export absence is not proof of non-registration. To Register is a preparation grouping requiring later assessment."}
            audit.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
            artifact_id = uuid4().hex
            record = {"batch_id": batch_id, "artifact_id": artifact_id, "environment": "dev",
                "created_at": datetime.now(UTC).isoformat(), "inspection_token": token,
                "workbook_name": workbook.name, "audit_name": audit.name,
                "workbook_sha256": fingerprint(workbook), "audit_sha256": fingerprint(audit),
                "preparation_contract": PREPARATION_CONTRACT,
                "summary": result, "excluded_workbooks": list(exclusions), "database_changed": False}
            record["review_examples"] = evidence["issues"][:20]
            (output / "preparation.json").write_text(json.dumps(record, indent=2) + "\n")
            output.rename(prepared / artifact_id)
        return record

    def artifact(self, batch_id: str, artifact_id: str) -> tuple[dict, Path, Path]:
        batch = self._batch(batch_id)
        if not re.fullmatch(r"[a-f0-9]{32}", artifact_id):
            raise ValueError("Invalid prepared artifact ID")
        directory = batch / "prepared" / artifact_id
        if directory.is_symlink() or not directory.resolve().is_relative_to(batch):
            raise ValueError("Prepared artifact escapes Dev batch storage")
        record = json.loads((directory / "preparation.json").read_text())
        if record.get("preparation_contract") != PREPARATION_CONTRACT:
            raise ValueError("Earlier preparation format; check sources and create a fresh workbook")
        if record["batch_id"] != batch_id or record["artifact_id"] != artifact_id or record["environment"] != "dev":
            raise ValueError("Prepared artifact identity does not match this Dev batch")
        paths = []
        for kind in ("workbook", "audit"):
            name = record[f"{kind}_name"]
            path = directory / name
            if Path(name).name != name or not path.resolve().is_relative_to(directory.resolve()) or fingerprint(path) != record[f"{kind}_sha256"]:
                raise ValueError("Prepared workbook/audit integrity check failed")
            paths.append(path)
        if json.loads(paths[1].read_text())["workbook_sha256"] != record["workbook_sha256"]:
            raise ValueError("Prepared audit does not belong to this workbook")
        return record, paths[0], paths[1]

    def package(self, batch_id: str, artifact_id: str) -> bytes:
        _, workbook, audit = self.artifact(batch_id, artifact_id)
        target = io.BytesIO()
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.write(workbook, workbook.name)
            archive.write(audit, audit.name)
        return target.getvalue()
