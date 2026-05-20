from __future__ import annotations

import re
from pathlib import Path

import yaml

from app.config import get_settings
from app.models import ApplyNormalizationRulesResponse, NormalizationRule, NormalizationRuleFile


class NormalizationRepository:
    def __init__(self) -> None:
        self.settings = get_settings()

    def list_rule_files(self) -> list[NormalizationRuleFile]:
        rule_files: list[NormalizationRuleFile] = []
        for path in sorted(self.settings.normalization_dir.glob("*.yaml")):
            data = yaml.safe_load(path.read_text()) or {}
            rule_files.append(NormalizationRuleFile.model_validate(data))
        return rule_files

    def rules_for_column(self, column: str) -> dict[str, str]:
        for rule_file in self.list_rule_files():
            if rule_file.column == column:
                return {rule.raw: rule.normalized for rule in rule_file.rules}
        return {}

    def accepted_values_for_column(self, column: str) -> set[str]:
        for rule_file in self.list_rule_files():
            if rule_file.column == column:
                return {rule.normalized for rule in rule_file.rules}
        return set()

    def apply_rules(
        self,
        *,
        column: str,
        rules: list[NormalizationRule],
    ) -> ApplyNormalizationRulesResponse:
        path = self._path_for_column(column)
        existing = self._rule_file_for_column(column)
        description = (
            existing.description
            if existing
            else f"Normalize source values for {column} before canonical mapping."
        )

        merged_rules: dict[str, str] = {}
        if existing:
            merged_rules.update({rule.raw: rule.normalized for rule in existing.rules})
        merged_rules.update({rule.raw: rule.normalized for rule in rules})

        ordered_rules = [
            NormalizationRule(raw=raw, normalized=normalized)
            for raw, normalized in sorted(merged_rules.items(), key=lambda item: item[0].lower())
        ]
        rule_file = NormalizationRuleFile(
            column=column,
            description=description,
            rules=ordered_rules,
        )
        path.write_text(
            yaml.safe_dump(
                rule_file.model_dump(mode="json"),
                sort_keys=False,
                allow_unicode=False,
            )
        )
        return ApplyNormalizationRulesResponse(
            column=column,
            applied_rules=len(rules),
            file_path=path,
        )

    def _rule_file_for_column(self, column: str) -> NormalizationRuleFile | None:
        for rule_file in self.list_rule_files():
            if rule_file.column == column:
                return rule_file
        return None

    def _path_for_column(self, column: str) -> Path:
        for path in sorted(self.settings.normalization_dir.glob("*.yaml")):
            data = yaml.safe_load(path.read_text()) or {}
            if data.get("column") == column:
                return path
        slug = re.sub(r"[^a-z0-9]+", "_", column.lower()).strip("_") or "normalization_rules"
        return self.settings.normalization_dir / f"{slug}.yaml"
