from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.canonical_projection import (
    CanonicalProjectionNoImportError,
    CanonicalProjectionService,
    CanonicalProjectionUnavailableError,
)
from app.services.canonical_review import CanonicalReviewService

router = APIRouter(tags=["canonical"])


@router.get("/canonical-review")
def canonical_review() -> dict:
    return CanonicalReviewService().load_review_bundle().model_dump(mode="json")


@router.get("/canonical-validation")
def canonical_validation() -> dict:
    try:
        return CanonicalProjectionService().latest_bundle(require_import=True).model_dump(mode="json")
    except CanonicalProjectionNoImportError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except CanonicalProjectionUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

