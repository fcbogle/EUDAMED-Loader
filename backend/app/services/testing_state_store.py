from __future__ import annotations

from dataclasses import dataclass

import yaml

from app.config import get_settings
from app.xml_models import CriticalWarningXmlItem, PatchStateSnapshot, StorageConditionXmlItem


@dataclass(frozen=True)
class PatchStateResolution:
    source: str
    state: PatchStateSnapshot
    scenario_id: str | None = None


class TestingStateStore:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def yaml_path(self):
        return self.settings.schema_dir.parents[1] / "data" / "testing" / "playground-tested-subjects.yaml"

    def latest_successful_patch_state(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> PatchStateResolution | None:
        data = yaml.safe_load(self.yaml_path.read_text()) or {}
        subjects = data.get("tested_subjects") or []
        for subject in subjects:
            if not isinstance(subject, dict):
                continue
            if (
                subject.get("product_family") == product_family
                and subject.get("product_variant") == product_variant
                and subject.get("catalogue_number") == catalogue_number
            ):
                latest_state = subject.get("latest_successful_state")
                if not isinstance(latest_state, dict):
                    return None
                version = str(latest_state.get("version") or "").strip()
                if not version:
                    return None
                latest_successful_scenario_id = None
                test_events = subject.get("test_events")
                if isinstance(test_events, list):
                    successful_patch_events = [
                        event
                        for event in test_events
                        if isinstance(event, dict)
                        and event.get("message_type") == "UDI_DI.PATCH"
                        and event.get("status") == "SUCCESS"
                    ]
                    if successful_patch_events:
                        latest_event = successful_patch_events[-1]
                        scenario_value = latest_event.get("scenario_id")
                        if isinstance(scenario_value, str) and scenario_value.strip():
                            latest_successful_scenario_id = scenario_value.strip()
                        elif str(latest_event.get("version") or "").strip() == "2":
                            latest_successful_scenario_id = "equivalent_first_patch"
                return PatchStateResolution(
                    source="yaml_latest_successful_patch",
                    state=PatchStateSnapshot(
                        version=version,
                        trade_name=self._optional_string(latest_state.get("trade_name")),
                        base_quantity=self._optional_int(latest_state.get("base_quantity")),
                        sterile=self._optional_bool(latest_state.get("sterile")),
                        contains_latex=self._optional_bool(latest_state.get("contains_latex")),
                        status_code=self._optional_string(latest_state.get("status_code")),
                        storage_conditions=self._storage_conditions(latest_state.get("storage_conditions")),
                        critical_warnings=self._critical_warnings(latest_state.get("critical_warnings")),
                    ),
                    scenario_id=latest_successful_scenario_id,
                )
        return None

    @staticmethod
    def _optional_string(value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return str(value)
        normalized = value.strip()
        return normalized or None

    @staticmethod
    def _optional_int(value: object) -> int | None:
        if value is None or value == "":
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _optional_bool(value: object) -> bool | None:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized == "true":
                return True
            if normalized == "false":
                return False
        return None

    @staticmethod
    def _storage_conditions(value: object) -> list[StorageConditionXmlItem]:
        if not isinstance(value, list):
            return []
        items: list[StorageConditionXmlItem] = []
        for entry in value:
            if not isinstance(entry, dict):
                continue
            code = str(entry.get("code") or "").strip()
            if not code:
                continue
            items.append(
                StorageConditionXmlItem(
                    code=code,
                    comment=TestingStateStore._optional_string(entry.get("comment")),
                )
            )
        return items

    @staticmethod
    def _critical_warnings(value: object) -> list[CriticalWarningXmlItem]:
        if not isinstance(value, list):
            return []
        items: list[CriticalWarningXmlItem] = []
        for entry in value:
            if not isinstance(entry, dict):
                continue
            code = str(entry.get("code") or "").strip()
            if not code:
                continue
            items.append(
                CriticalWarningXmlItem(
                    code=code,
                    comment=TestingStateStore._optional_string(entry.get("comment")),
                )
            )
        return items
