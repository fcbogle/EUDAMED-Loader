from __future__ import annotations

from pathlib import Path
import json
import sqlite3

import yaml

from app.canonical_models import (
    BasicDevice,
    CanonicalDeviceBundle,
    CanonicalEntityReview,
    CanonicalReviewBundle,
    DeviceRecord,
    Manufacturer,
    VariantMappingSummary,
)
from app.config import get_settings
from app.services.basic_udi_reference import BasicUdiReferenceService


class CanonicalReviewService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def load_review_bundle(self) -> CanonicalReviewBundle:
        phase_data = self._load_yaml(self.settings.canonical_mapping_dir / "phase.yaml")
        entity_reviews = [
            CanonicalEntityReview.model_validate(self._load_yaml(path))
            for path in self._entity_paths()
        ]
        return CanonicalReviewBundle(
            phase_assumptions=phase_data.get("phase_assumptions", []),
            device_bundle=CanonicalDeviceBundle(
                manufacturer=Manufacturer(),
                basic_device=BasicDevice(),
                device_record=DeviceRecord(),
            ),
            entity_reviews=entity_reviews,
            variant_mappings=self._variant_mappings(),
        )

    def _variant_mappings(self) -> list[VariantMappingSummary]:
        if self.settings.environment != "prod":
            return BasicUdiReferenceService().list_variant_mappings()
        # Production mappings come from the prepared import, never legacy Dev files.
        database = self.settings.testing_state_db_path
        if not database.exists():
            return []
        with sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True) as connection:
            tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if not {"canonical_device_record", "source_row", "source_workbook"}.issubset(tables):
                return []
            rows = connection.execute(
                """SELECT sw.workbook_name, sr.sheet_name, cr.record_json
                   FROM canonical_device_record cr
                   JOIN source_row sr ON sr.id = cr.source_row_id
                   JOIN source_workbook sw ON sw.id = sr.source_workbook_id
                   ORDER BY cr.id"""
            ).fetchall()
        mappings = {}
        for workbook, sheet, payload in rows:
            record = json.loads(payload)
            fields = {field["canonical_path"]: field["value"] for field in record["fields"]}
            parent = fields.get("basic_device.basic_udi_di")
            identifier = fields.get("device_record.basic_udi_identifier") or ""
            issuer, _, code = identifier.partition(":")
            parent = parent or code or None
            countries = record.get("market_availability_items", [])
            first = next((item["country"] for item in countries if item.get("original_placed_on_market")), None)
            key = (workbook, sheet, record["product_variant"], issuer, parent, record["submission_operation"])
            mappings[key] = VariantMappingSummary(
                workbook=workbook, sheet=sheet, device_model=record["product_variant"],
                basic_udi_di=parent, submission_operation=record["submission_operation"],
                first_eu_market_country=first, available_market_country_count=len(countries),
                match_status="matched" if parent else "unmatched",
                notes=["Derived from the persisted Production workbook import; original source lineage is retained."],
            )
        return list(mappings.values())

    def _entity_paths(self) -> list[Path]:
        return sorted(
            path
            for path in self.settings.canonical_mapping_dir.glob("*.yaml")
            if path.name != "phase.yaml"
        )

    @staticmethod
    def _load_yaml(path: Path) -> dict:
        data = yaml.safe_load(path.read_text()) or {}
        if not isinstance(data, dict):
            raise ValueError(f"Expected mapping document at {path} to be a YAML object.")
        return data
