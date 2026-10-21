"""HTTP regression coverage for the parent selector shared by bulk updates."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import TestingSubjectReadModelSummary as SubjectSummary
from app.routers import xml_generation


@pytest.mark.parametrize(
    "evidence",
    [
        {"imported_baseline_present": True},
        {"has_successful_device_post": True},
        {"has_successful_child_post_or_patch": True},
    ],
)
def test_bulk_update_parent_selector_accepts_registration_evidence(monkeypatch, evidence):
    registered = SubjectSummary(
        id=1, product_family="Synthetic", product_variant="Model",
        catalogue_number="REGISTERED", primary_udi_di="99000000000001",
        basic_udi_di="PARENT", **evidence,
    )
    unregistered = SubjectSummary(
        id=2, catalogue_number="AWAITING", primary_udi_di="99000000000002",
        basic_udi_di="PARENT",
    )
    calls = []

    class ReadModel:
        def list_subject_summaries(self, **kwargs):
            calls.append(kwargs)
            return [registered, unregistered]

    monkeypatch.setattr(xml_generation, "_testing_read_model", ReadModel)
    response = TestClient(app).post(
        "/api/xml/bulk-patch-posted-parents",
        json={"product_family": "Synthetic", "product_variant": "Model"},
    )
    assert response.status_code == 200
    assert response.json()["parents"] == [{
        "basic_udi_di": "PARENT", "posted_child_count": 1,
        "sample_catalogue_numbers": ["REGISTERED"],
    }]
    assert calls == [{
        "product_family": "Synthetic", "product_variant": "Model", "limit": 10000,
    }]


@pytest.mark.parametrize(
    "fields",
    [
        {},
        {"post_success": True},  # A legacy flag alone is not registration evidence.
        {"has_successful_device_post": True, "primary_udi_di": None},
        {"imported_baseline_present": True, "basic_udi_di": None},
    ],
)
def test_bulk_update_parent_selector_excludes_unregistered_or_unresolved_children(monkeypatch, fields):
    values = dict(id=1, catalogue_number="DEVICE", primary_udi_di="99000000000001", basic_udi_di="PARENT")
    values.update(fields)

    class ReadModel:
        def list_subject_summaries(self, **kwargs):
            return [SubjectSummary(**values)]

    monkeypatch.setattr(xml_generation, "_testing_read_model", ReadModel)
    response = TestClient(app).post(
        "/api/xml/bulk-patch-posted-parents",
        json={"product_family": "Synthetic", "product_variant": "Model"},
    )
    assert response.status_code == 200
    assert response.json()["parents"] == []
