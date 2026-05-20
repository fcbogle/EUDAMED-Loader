from __future__ import annotations

from fastapi import APIRouter

from app.models import ApplyNormalizationRulesRequest
from app.services.normalization import NormalizationRepository

router = APIRouter(tags=["normalization"])


@router.get("/normalization-rules")
def list_normalization_rules() -> list[dict]:
    return [
        rule_file.model_dump(mode="json")
        for rule_file in NormalizationRepository().list_rule_files()
    ]


@router.post("/normalization-rules/apply")
def apply_normalization_rules(payload: ApplyNormalizationRulesRequest) -> dict:
    result = NormalizationRepository().apply_rules(
        column=payload.column,
        rules=payload.rules,
    )
    return result.model_dump(mode="json")
