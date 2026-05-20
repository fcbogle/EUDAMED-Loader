from __future__ import annotations

from pathlib import Path

import yaml

from app.canonical_models import (
    BasicDevice,
    CanonicalDeviceBundle,
    CanonicalEntityReview,
    CanonicalReviewBundle,
    DeviceRecord,
    Manufacturer,
)
from app.config import get_settings


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
        )

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
