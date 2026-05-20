from __future__ import annotations

from app.routers.canonical import canonical_review
from app.services.canonical_review import CanonicalReviewService


def test_canonical_review_service_loads_bundle() -> None:
    bundle = CanonicalReviewService().load_review_bundle()

    assert bundle.phase_assumptions
    assert bundle.entity_reviews
    assert any(entity.entity_name == "DeviceRecord" for entity in bundle.entity_reviews)
    assert sum(len(entity.field_reviews) for entity in bundle.entity_reviews) >= 1


def test_canonical_review_api_returns_review_bundle() -> None:
    payload = canonical_review()

    assert "phase_assumptions" in payload
    assert "entity_reviews" in payload
    assert any(entity["entity_name"] == "DeviceRecord" for entity in payload["entity_reviews"])
