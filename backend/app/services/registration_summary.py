"""Reconciled, uncapped registration counts for the active SQLite import.

No local success is not proof of non-registration. Import defaults and POST
instructions are therefore never treated as negative registration evidence.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
import json
import hashlib
import sqlite3

from app.services.accepted_evidence import imported_event_sql
from app.config import get_settings
from app.services.identity import normalize_identity, normalized_family_candidates
from app.services.operation_assessment import OperationAssessmentService


def token(value: object) -> str:
    return str(value or "").strip().upper()


def fields(record: dict) -> dict:
    return {field["canonical_path"]: field.get("value") for field in record.get("fields", [])}


def identifier(value: object, issuer: object = None) -> tuple[str, str]:
    value = token(value)
    # Existing canonical records use ISSUER:CODE; older projections may use urn:ISSUER:CODE.
    if value.startswith("URN:"):
        parts = value.split(":", 2)
        return parts[1], parts[2]
    if ":" in value:
        entity, code = value.split(":", 1)
        return entity, code
    return token(issuer), value


class RegistrationSummaryService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def summary(self, *, product_family: str = "", product_variant: str = "", search: str = "",
                status: str = "", actionable_only: bool = False) -> dict:
        db = self.settings.testing_state_db_path
        if not db.exists():
            return self._empty()
        with sqlite3.connect(f"{db.resolve().as_uri()}?mode=ro", uri=True) as connection:
            connection.row_factory = sqlite3.Row
            tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if not {"import_batch", "canonical_device_record", "canonical_projection_snapshot"} <= tables:
                return self._empty()
            batch = connection.execute("SELECT * FROM import_batch ORDER BY id DESC LIMIT 1").fetchone()
            if batch is None:
                return self._empty()
            projection = connection.execute("SELECT 1 FROM canonical_projection_snapshot WHERE source_import_batch_id=?", (batch["id"],)).fetchone()
            if projection is None:
                raise ValueError("The latest import has no canonical snapshot. Refresh the import before using registration counts.")
            marker = self._marker(connection)
            production = getattr(self.settings, "environment", "dev") == "prod"
            record_query = ("SELECT c.device_subject_id, c.source_row_id, c.record_json, sr.raw_payload_json FROM canonical_device_record c JOIN source_row sr ON sr.id=c.source_row_id WHERE c.source_import_batch_id=?"
                            if production else "SELECT device_subject_id, source_row_id, record_json FROM canonical_device_record WHERE source_import_batch_id=?")
            records = [self._compact(dict(row)) for row in connection.execute(record_query, (batch["id"],))]
            source_count = connection.execute("SELECT COUNT(*) FROM source_row sr JOIN source_workbook sw ON sw.id=sr.source_workbook_id WHERE sw.import_batch_id=?", (batch["id"],)).fetchone()[0]
            issue_rows = connection.execute("SELECT di.device_subject_id FROM device_identity_issue di JOIN source_row sr ON sr.id=di.source_row_id JOIN source_workbook sw ON sw.id=sr.source_workbook_id WHERE sw.import_batch_id=? AND di.resolved_at IS NULL", (batch["id"],)).fetchall()
            issues = len(issue_rows)
            issue_subjects = {row[0] for row in issue_rows if row[0] is not None}
            subjects = [dict(row) for row in connection.execute("SELECT * FROM testing_subjects")] if "testing_subjects" in tables else []
            event_query = f"SELECT * FROM testing_events event WHERE status='SUCCESS' OR {imported_event_sql()}" if production else "SELECT * FROM testing_events WHERE status='SUCCESS'"
            events = [dict(row) for row in connection.execute(event_query)] if "testing_events" in tables else []
        # Reuse generation's assessment rules, rather than reimplementing readiness.
        readiness = OperationAssessmentService().record_readiness()
        with sqlite3.connect(f"{db.resolve().as_uri()}?mode=ro", uri=True) as connection:
            if marker != self._marker(connection):
                raise ValueError("Import or acceptance state changed while calculating counts. Refresh to obtain a consistent snapshot.")
        return self._build(records, subjects, events, readiness, batch=dict(batch),
                           source_count=source_count, identity_issues=issues, issue_subjects=issue_subjects,
                           product_family=product_family, product_variant=product_variant,
                           search=search, status=status, actionable_only=actionable_only)

    @staticmethod
    def _compact(row: dict) -> dict:
        record = json.loads(row["record_json"])
        minimal = {name: record.get(name) for name in ("product_family", "product_variant", "primary_udi_di", "catalogue_number", "issuing_entity")}
        minimal["fields"] = [field for field in record.get("fields", []) if field["canonical_path"] in
                             {"device_record.identifier", "device_record.basic_udi_identifier", "basic_device.basic_udi_di"}]
        return {**row, "production_registration_status": json.loads(row.get("raw_payload_json") or "{}").get("production_import", {}).get("registration_status"), "fingerprint": hashlib.sha256(row["record_json"].encode()).hexdigest(), "record_json": json.dumps(minimal)}

    @staticmethod
    def _marker(connection: sqlite3.Connection) -> tuple:
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        return (tuple(connection.execute("SELECT MAX(id), COUNT(*) FROM import_batch").fetchone()),
                tuple(connection.execute("SELECT MAX(id), COUNT(*) FROM testing_events").fetchone()) if "testing_events" in tables else (),
                tuple(connection.execute("SELECT MAX(updated_at), COUNT(*) FROM canonical_device_record").fetchone()),
                hashlib.sha256(repr([tuple(row) for row in connection.execute("SELECT * FROM testing_subjects ORDER BY id")]).encode()).hexdigest() if "testing_subjects" in tables else "")

    @staticmethod
    def _empty() -> dict:
        return {"import_batch_id": None, "imported_at": None, "calculated_at": datetime.now(UTC).isoformat(),
                "latest_acceptance_at": None, "source_rows": 0, "mapped_rows": 0, "outside_canonical_scope_rows": 0,
                "unresolved_identity_rows": 0, "duplicate_identity_rows": 0, "identity_issue_count": 0,
                "unmatched_success_subjects": 0, "event_counts": {name: 0 for name in ("DEVICE.POST", "UDI_DI.POST", "UDI_DI.PATCH", "MARKET_INFO.PUT")}, "groups": [], "counts": RegistrationSummaryService._counts([])}

    @staticmethod
    def _counts(groups: list[dict]) -> dict:
        counts = {key: sum(group[key] for group in groups) for key in
                  ("total_devices", "registered_devices", "unknown_devices", "awaiting_devices", "awaiting_ready", "awaiting_blocked",
                   "post_ready", "child_post_ready", "patch_ready", "market_info_ready")}
        counts.update(unresolved_parent_devices=sum(g["total_devices"] for g in groups if not g["parent_key"]),
                      total_parents=len({g["parent_key"] for g in groups if g["parent_key"]}),
                      registered_parents=len({g["parent_key"] for g in groups if g["parent_registered"]}),
                      unknown_parents=len({g["parent_key"] for g in groups if g["parent_key"] and not g["parent_registered"]}))
        assert counts["total_devices"] == counts["registered_devices"] + counts["unknown_devices"] + counts["awaiting_devices"]
        assert counts["awaiting_devices"] == counts["awaiting_ready"] + counts["awaiting_blocked"]
        assert counts["total_parents"] == counts["registered_parents"] + counts["unknown_parents"]
        return counts

    @staticmethod
    def _build(records: list[dict], subjects: list[dict], events: list[dict], readiness: list[dict], *, batch: dict,
               source_count: int, identity_issues: int, product_family: str = "", product_variant: str = "",
               search: str = "", status: str = "", actionable_only: bool = False, issue_subjects: set[int] | None = None) -> dict:
        issue_subjects = issue_subjects or set()
        by_identity: dict[tuple, list[dict]] = defaultdict(list)
        unresolved = 0
        for row in records:
            record = json.loads(row["record_json"])
            values = fields(record)
            key = identifier(values.get("device_record.identifier") or record.get("primary_udi_di"), record.get("issuing_entity"))
            parent = identifier(values.get("device_record.basic_udi_identifier") or values.get("basic_device.basic_udi_di"), record.get("issuing_entity"))
            if not all(key):
                unresolved += 1
                continue
            by_identity[key].append({**row, "record": record, "parent": parent if all(parent) else None})
        devices = {}
        duplicates = 0
        for key, rows in by_identity.items():
            scopes = {(normalize_identity(r["record"]["product_family"]), normalize_identity(r["record"]["product_variant"]), r["parent"]) for r in rows}
            if len(scopes) != 1:
                unresolved += len(rows)  # Conflicting identities must not become two devices.
                continue
            duplicates += len(rows) - 1
            devices[key] = rows
        subject_devices = {r["device_subject_id"]: key for key, rows in devices.items() for r in rows}
        successful = defaultdict(set)
        for event in events:
            successful[event["subject_id"]].add(event["message_type"])
        accepted = defaultdict(set)
        accepted_parents = set()
        parent_subjects = defaultdict(set)
        events_by_subject = defaultdict(list)
        subjects_by_id = {subject["id"]: subject for subject in subjects}
        for event in events:
            events_by_subject[event["subject_id"]].append(event)
        matched_subjects = set()
        parents_by_code = defaultdict(set)
        for rows in devices.values():
            if rows[0]["parent"]:
                parents_by_code[rows[0]["parent"][1]].add(rows[0]["parent"])
        for subject in subjects:
            types = successful.get(subject["id"], set())
            key = subject_devices.get(subject.get("device_subject_id"))
            if key and token(subject.get("primary_udi_di")) != key[1]:
                key = None
            states = [json.loads(subject[column]) for column in ("latest_successful_post_state_json", "latest_successful_patch_state_json", "latest_successful_state_json") if subject.get(column)]
            state = states[0] if states else {}
            issuer = state.get("device_identifier_issuing_entity") or state.get("issuing_entity") or state.get("device_record", {}).get("device_identifier_issuing_entity")
            if not key and issuer:
                candidate = identifier(subject.get("primary_udi_di"), issuer)
                key = candidate if candidate in devices else None
            if key and issuer and token(issuer) != key[0]:
                key = None
            if key and types & {"DEVICE.POST", "UDI_DI.POST", "UDI_DI.PATCH", "PRODUCTION_EXPORT.SNAPSHOT"}:
                accepted[key].add(subject["id"])
                matched_subjects.add(subject["id"])
            if types & {"DEVICE.POST", "PRODUCTION_EXPORT.SNAPSHOT"}:
                code = token(subject.get("basic_udi_di"))
                candidates = parents_by_code[code]
                parent_issuer = state.get("basic_identifier_issuing_entity") or state.get("device_record", {}).get("basic_identifier_issuing_entity") or issuer
                parent = identifier(code, parent_issuer) if parent_issuer else devices[key][0]["parent"] if key else None
                # A parent-only acknowledgement can be used only if its issuer is recoverable.
                if parent in candidates:
                    accepted_parents.add(parent)
                    parent_subjects[parent].add(subject["id"])
                    matched_subjects.add(subject["id"])
        ready_by_code = defaultdict(list)
        for entry in readiness:
            ready_by_code[token(entry.get("primary_udi_di"))].append(entry)
        issuer_counts = defaultdict(int)
        for key in devices:
            issuer_counts[key[1]] += 1
        groups = {}
        for key, rows in devices.items():
            record = rows[0]["record"]
            parent = rows[0]["parent"]
            group_key = (record["product_family"], record["product_variant"], parent)
            group = groups.setdefault(group_key, {
                "key": json.dumps(group_key), "product_family": group_key[0], "product_variant": group_key[1],
                "parent_key": json.dumps(parent) if parent else "", "basic_udi_di": parent[1] if parent else "Unresolved",
                "parent_registered": parent in accepted_parents, "parent_post_ready": False, "total_devices": 0, "registered_devices": 0,
                "unknown_devices": 0, "awaiting_devices": 0, "awaiting_ready": 0, "awaiting_blocked": 0,
                "post_ready": 0, "child_post_ready": 0, "patch_ready": 0, "market_info_ready": 0,
                "patch_completed": 0, "market_info_completed": 0, "latest_acceptance_at": None,
                "latest_patch_version": None, "latest_market_info_version": None, "parent_issuing_entity": parent[0] if parent else None,
            })
            group["total_devices"] += 1
            awaiting = key not in accepted and all(r.get("production_registration_status") == "Not registered" for r in rows)
            group["registered_devices" if key in accepted else "awaiting_devices" if awaiting else "unknown_devices"] += 1
            eligible = [entry for entry in ready_by_code[key[1]] if
                        normalize_identity(entry["product_variant"]) == normalize_identity(record["product_variant"]) and
                        set(normalized_family_candidates(entry["product_family"])) & set(normalized_family_candidates(record["product_family"])) and
                        token(entry["catalogue_number"]) == token(record.get("catalogue_number"))]
            # Do not count an ambiguous issuer, unresolved parent, or conflicting duplicate draft as ready.
            issuer_unique = issuer_counts[key[1]] == 1
            consistent = len({r.get("fingerprint") or json.dumps(r["record"], sort_keys=True) for r in rows}) == 1 and not any(r["device_subject_id"] in issue_subjects for r in rows)
            if parent and eligible and issuer_unique and consistent:
                if key not in accepted and all(entry["post_ready"] and not entry.get("parent_registered", False) for entry in eligible):
                    group["parent_post_ready"] = True
                for name in ("post_ready", "child_post_ready", "patch_ready", "market_info_ready"):
                    if name in {"post_ready", "child_post_ready"} and key in accepted:
                        continue
                    if name in {"patch_ready", "market_info_ready"} and key not in accepted:
                        continue
                    group[name] += int(all(entry[name] for entry in eligible))
            if awaiting:
                awaiting_ready = bool(eligible and parent and issuer_unique and consistent and all(e["post_ready"] or e["child_post_ready"] for e in eligible))
                group["awaiting_ready" if awaiting_ready else "awaiting_blocked"] += 1
            subject_ids = accepted.get(key, set())
            group["patch_completed"] += int(any("UDI_DI.PATCH" in successful[s] for s in subject_ids))
            group["market_info_completed"] += int(any("MARKET_INFO.PUT" in successful[s] for s in subject_ids))
            for column, output in (("latest_successful_patch_version", "latest_patch_version"), ("latest_successful_market_info_version", "latest_market_info_version")):
                versions = [str(subjects_by_id[s].get(column) or "") for s in subject_ids]
                versions.append(str(group[output] or ""))
                group[output] = max((int(v) for v in versions if v.isdigit()), default=0) or None
            dates = [e.get("tested_at") for s in subject_ids | parent_subjects[parent] for e in events_by_subject[s] if e.get("tested_at")]
            group["latest_acceptance_at"] = max([*dates, group["latest_acceptance_at"] or ""]) or None
        for group in groups.values():
            modes = [("POST ready", group["parent_post_ready"]),
                     ("Child POST ready", group["child_post_ready"] > 0), ("PATCH ready", group["patch_ready"] > 0),
                     ("Market Info ready", group["market_info_ready"] > 0)]
            available = [name for name, enabled in modes if enabled]
            group["status"] = "Mixed" if len(available) > 1 else available[0] if available else "Blocked"
        selected = [group for group in groups.values() if
                    (not product_family or set(normalized_family_candidates(product_family)) & set(normalized_family_candidates(group["product_family"]))) and
                    (not product_variant or normalize_identity(product_variant) == normalize_identity(group["product_variant"])) and
                    (not search.strip() or any(search.strip().casefold() in str(group[name]).casefold() for name in ("product_family", "product_variant", "basic_udi_di"))) and
                    (not status or group["status"] == status) and
                    (not actionable_only or any(group[name] for name in ("post_ready", "child_post_ready", "patch_ready", "market_info_ready")))]
        # Historical operation totals are uncapped and deliberately count events,
        # separately from identities in the active import.
        history_subjects = {subject["id"] for subject in subjects if
                            (not product_family or set(normalized_family_candidates(product_family)) & set(normalized_family_candidates(subject.get("product_family")))) and
                            (not product_variant or normalize_identity(product_variant) == normalize_identity(subject.get("product_variant"))) and
                            (not search.strip() or any(search.strip().casefold() in str(subject.get(name) or "").casefold() for name in ("product_family", "product_variant", "basic_udi_di")))}
        event_counts = {name: sum(event["subject_id"] in history_subjects and event["message_type"] == name for event in events)
                        for name in ("DEVICE.POST", "UDI_DI.POST", "UDI_DI.PATCH", "MARKET_INFO.PUT")}
        return {"import_batch_id": batch["id"], "imported_at": batch["imported_at"], "calculated_at": datetime.now(UTC).isoformat(),
                "latest_acceptance_at": max((e.get("tested_at") or "" for e in events), default="") or None,
                "source_rows": source_count, "mapped_rows": len(records), "outside_canonical_scope_rows": max(0, source_count - len(records)),
                "unresolved_identity_rows": unresolved, "duplicate_identity_rows": duplicates, "identity_issue_count": identity_issues,
                "unmatched_success_subjects": len(set(successful) - matched_subjects),
                "event_counts": event_counts, "groups": sorted(selected, key=lambda g: (g["product_family"], g["product_variant"], g["basic_udi_di"])),
                "counts": RegistrationSummaryService._counts(selected)}
