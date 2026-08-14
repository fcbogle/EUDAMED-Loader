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
    _reviewed_post_keys: set[tuple[str, str, str]] = set()

    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def yaml_path(self):
        return self.settings.schema_dir.parents[1] / "data" / "testing" / "playground-tested-subjects.yaml"

    def _subjects(self) -> list[dict]:
        data = yaml.safe_load(self.yaml_path.read_text()) or {}
        subjects = data.get("tested_subjects") or []
        return [subject for subject in subjects if isinstance(subject, dict)]

    def latest_successful_patch_state(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> PatchStateResolution | None:
        for subject in self._subjects():
            if (
                self._matches_identity(subject.get("product_family"), product_family)
                and self._matches_identity(subject.get("product_variant"), product_variant)
                and self._matches_identity(subject.get("catalogue_number"), catalogue_number)
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

    def posted_entries(
        self,
        *,
        product_family: str,
        product_variant: str,
        basic_udi_di: str,
    ) -> list[dict[str, object]]:
        entries: list[dict[str, object]] = []
        for subject in self._subjects():
            if (
                not self._matches_identity(subject.get("product_family"), product_family)
                or not self._matches_identity(subject.get("product_variant"), product_variant)
                or not self._matches_identity(subject.get("basic_udi_di"), basic_udi_di)
            ):
                continue
            if not self._is_posted_patch_candidate(subject):
                continue
            playground_status = subject.get("playground_status") or {}
            latest_state = subject.get("latest_successful_state") or {}
            entries.append(
                {
                    "catalogue_number": self._optional_string(subject.get("catalogue_number")),
                    "primary_udi_di": self._optional_string(subject.get("primary_udi_di")),
                    "basic_udi_di": self._optional_string(subject.get("basic_udi_di")),
                    "latest_version": self._optional_string(latest_state.get("version")) if isinstance(latest_state, dict) else None,
                    "baseline_patch_success": bool(playground_status.get("baseline_patch_success")),
                }
            )
        return entries

    def posted_parent_groups(
        self,
        *,
        product_family: str,
        product_variant: str,
    ) -> list[dict[str, object]]:
        grouped: dict[str, list[dict[str, object]]] = {}
        for subject in self._subjects():
            if (
                not self._matches_identity(subject.get("product_family"), product_family)
                or not self._matches_identity(subject.get("product_variant"), product_variant)
            ):
                continue
            if not self._is_posted_patch_candidate(subject):
                continue
            basic_udi_di = self._optional_string(subject.get("basic_udi_di"))
            if not basic_udi_di:
                continue
            grouped.setdefault(basic_udi_di, []).append(subject)

        return [
            {
                "basic_udi_di": basic_udi_di,
                "posted_child_count": len(subjects),
                "sample_catalogue_numbers": [
                    self._optional_string(subject.get("catalogue_number"))
                    for subject in subjects[:10]
                    if self._optional_string(subject.get("catalogue_number"))
                ],
            }
            for basic_udi_di, subjects in sorted(grouped.items(), key=lambda item: item[0])
        ]

    def has_successful_basic_udi_post(
        self,
        *,
        product_family: str,
        product_variant: str,
        basic_udi_di: str,
    ) -> bool:
        for subject in self._subjects():
            if (
                not self._matches_identity(subject.get("product_family"), product_family)
                or not self._matches_identity(subject.get("product_variant"), product_variant)
                or not self._matches_identity(subject.get("basic_udi_di"), basic_udi_di)
            ):
                continue
            test_events = subject.get("test_events")
            if not isinstance(test_events, list):
                continue
            if any(
                isinstance(event, dict)
                and event.get("status") == "SUCCESS"
                and event.get("message_type") == "DEVICE.POST"
                for event in test_events
            ):
                return True
        return False

    def mark_reviewed_post(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> None:
        self._reviewed_post_keys.add(
            (
                self._normalize_identity(product_family),
                self._normalize_identity(product_variant),
                self._normalize_identity(catalogue_number),
            )
        )

    def has_reviewed_post(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> bool:
        return (
            self._normalize_identity(product_family),
            self._normalize_identity(product_variant),
            self._normalize_identity(catalogue_number),
        ) in self._reviewed_post_keys

    @classmethod
    def clear_reviewed_posts(cls) -> None:
        cls._reviewed_post_keys.clear()

    @staticmethod
    def _is_posted_patch_candidate(subject: dict[str, object]) -> bool:
        playground_status = subject.get("playground_status") or {}
        if not isinstance(playground_status, dict) or not playground_status.get("post_success"):
            return False
        test_events = subject.get("test_events")
        if not isinstance(test_events, list):
            return False
        return any(
            isinstance(event, dict)
            and event.get("status") == "SUCCESS"
            and event.get("message_type") in {"UDI_DI.POST", "UDI_DI.PATCH"}
            for event in test_events
        )

    @staticmethod
    def _optional_string(value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return str(value)
        normalized = value.strip()
        return normalized or None

    @classmethod
    def _matches_identity(cls, left: object, right: object) -> bool:
        left_normalized = cls._normalize_identity(left)
        right_normalized = cls._normalize_identity(right)
        return bool(left_normalized and right_normalized and left_normalized == right_normalized)

    @classmethod
    def _normalize_identity(cls, value: object) -> str:
        text = cls._optional_string(value)
        if not text:
            return ""
        return "".join(text.casefold().split())

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
