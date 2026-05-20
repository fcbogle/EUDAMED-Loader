from __future__ import annotations

from fastapi import APIRouter

from app.services.canonical_review import CanonicalReviewService

router = APIRouter(tags=["canonical"])


@router.get("/canonical-review")
def canonical_review() -> dict:
    return CanonicalReviewService().load_review_bundle().model_dump(mode="json")
