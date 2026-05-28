from __future__ import annotations

from fastapi import APIRouter

from app.services.canonical_validation import CanonicalValidationService
from app.services.canonical_review import CanonicalReviewService
from app.services.echelon_validation import EchelonValidationService

router = APIRouter(tags=["canonical"])


@router.get("/canonical-review")
def canonical_review() -> dict:
    return CanonicalReviewService().load_review_bundle().model_dump(mode="json")


@router.get("/canonical-validation")
def canonical_validation() -> dict:
    return CanonicalValidationService().build_validation_bundle().model_dump(mode="json")


@router.get("/canonical-validation/echelon")
def echelon_canonical_validation() -> dict:
    return EchelonValidationService().build_validation_bundle().model_dump(mode="json")
