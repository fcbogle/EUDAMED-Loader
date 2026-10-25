from __future__ import annotations

import json
import sqlite3
from contextlib import nullcontext
from types import SimpleNamespace

import pytest

from app.services.registration_summary import RegistrationSummaryService
from app.routers.xml_generation import registration_summary


# This module uses synthetic in-memory data only; override the project seed fixtures.
@pytest.fixture(scope="session", autouse=True)
def reset_testing_state_database():
    yield


@pytest.fixture(autouse=True)
def clear_reviewed_post_state():
    yield


def record(subject=1, udi="D1", issuer="GS1", parent="B1", family="A", variant="Model", **extra):
    data = {"product_family": family, "product_variant": variant, "primary_udi_di": udi,
            "catalogue_number": f"CAT-{udi}", "issuing_entity": issuer,
            "fields": [{"canonical_path": "device_record.basic_udi_identifier", "value": f"urn:{issuer}:{parent}"}]}
    data.update(extra)
    return {"device_subject_id": subject, "source_row_id": subject, "record_json": json.dumps(data)}


def subject(id=1, device=1, udi="D1", parent="B1", **extra):
    return {"id": id, "device_subject_id": device, "primary_udi_di": udi, "basic_udi_di": parent,
            "product_family": "A", "product_variant": "Model", **extra}


def event(subject_id=1, kind="DEVICE.POST", **extra):
    return {"subject_id": subject_id, "message_type": kind, "tested_at": "2026-10-08T12:00:00Z", **extra}


def ready(udi="D1", **extra):
    return {"primary_udi_di": udi, "product_family": "A", "product_variant": "Model", "catalogue_number": f"CAT-{udi}",
            "post_ready": True, "child_post_ready": False, "patch_ready": False, "market_info_ready": False, **extra}


def summary(records=None, subjects=None, events=None, readiness=None, **filters):
    records = records if records is not None else [record()]
    return RegistrationSummaryService._build(records, subjects or [], events or [], readiness or [],
        batch={"id": 1, "imported_at": "2026-10-08T10:00:00Z"}, source_count=len(records), identity_issues=0, **filters)


def test_no_acceptance_and_default_unregistered_do_not_prove_non_registration():
    result = summary(subjects=[subject(registration_status="unregistered", post_success=0)], readiness=[ready()])
    assert result["counts"]["total_devices"] == 1
    assert result["counts"]["unknown_devices"] == 1
    assert result["counts"]["awaiting_devices"] == 0
    assert result["counts"]["post_ready"] == 1
    assert result["counts"]["unknown_parents"] == 1


def test_repeated_patch_events_count_once_as_registered_device_and_separate_history():
    result = summary(subjects=[subject()], events=[event(), event(kind="UDI_DI.PATCH"), event(kind="UDI_DI.PATCH")],
                     readiness=[ready(post_ready=False, patch_ready=True)])
    assert result["counts"]["registered_devices"] == 1
    assert result["counts"]["registered_parents"] == 1
    assert result["counts"]["patch_ready"] == 1
    assert result["groups"][0]["patch_completed"] == 1
    assert result["event_counts"]["UDI_DI.PATCH"] == 2


def test_flags_drafts_and_errors_are_not_success_evidence():
    # The SQL reader supplies SUCCESS events only. A flag alone is insufficient.
    result = summary(subjects=[subject(post_success=1, latest_successful_version="2")])
    assert result["counts"]["registered_devices"] == 0
    assert result["groups"][0]["patch_completed"] == 0
    assert result["unmatched_success_subjects"] == 0


def test_linked_acknowledgement_with_changed_identifier_or_issuer_does_not_register_new_identity():
    for sub in [subject(udi="OLD"), subject(latest_successful_post_state_json=json.dumps({"issuing_entity": "HIBCC"}))]:
        result = summary(subjects=[sub], events=[event()])
        assert result["counts"]["unknown_devices"] == 1
        assert result["unmatched_success_subjects"] == 1


def test_unlinked_success_requires_recoverable_issuer():
    assert summary(subjects=[subject(device=None)], events=[event()])["counts"]["registered_devices"] == 0
    result = summary(subjects=[subject(device=None, latest_successful_post_state_json=json.dumps({"issuing_entity": "GS1"}))], events=[event()])
    assert result["counts"]["registered_devices"] == 1


def test_parent_only_success_does_not_count_as_child_registration():
    sub = subject(device=None, udi=None, latest_successful_post_state_json=json.dumps({"basic_identifier_issuing_entity": "GS1"}))
    result = summary(subjects=[sub], events=[event()])
    assert result["counts"]["registered_parents"] == 1
    assert result["counts"]["registered_devices"] == 0


def test_issuer_distinguishes_devices_and_ambiguous_text_readiness_is_not_counted():
    result = summary(records=[record(), record(subject=2, issuer="HIBCC")], readiness=[ready()])
    assert result["counts"]["total_devices"] == 2
    assert result["counts"]["total_parents"] == 2
    assert result["counts"]["post_ready"] == 0


def test_exact_duplicates_count_once_and_conflicting_scopes_are_reported():
    result = summary(records=[record(), record(subject=2)], readiness=[ready()])
    assert result["counts"]["total_devices"] == 1
    assert result["duplicate_identity_rows"] == 1
    result = summary(records=[record(), record(subject=2, parent="OTHER")])
    assert result["counts"]["total_devices"] == 0
    assert result["unresolved_identity_rows"] == 2


def test_missing_identity_and_open_import_conflict_are_not_silently_ready():
    result = summary(records=[record(), record(subject=2, udi=None)], readiness=[ready()], issue_subjects={1})
    assert result["counts"]["total_devices"] == 1
    assert result["unresolved_identity_rows"] == 1
    assert result["counts"]["post_ready"] == 0


def test_parent_count_deduplicates_across_variants_and_filters_are_consistent():
    records = [record(), record(subject=2, udi="D2", variant="Other")]
    result = summary(records=records)
    assert result["counts"]["total_devices"] == 2
    assert result["counts"]["total_parents"] == 1
    result = summary(records=records, product_variant="Other", search="b1")
    assert result["counts"]["total_devices"] == 1
    assert sum(g["total_devices"] for g in result["groups"]) == 1
    assert summary(records=records, search="no match")["counts"]["total_devices"] == 0
    assert summary(records=records, actionable_only=True)["groups"] == []


def test_history_is_uncapped_and_filters_apply_to_counts_not_only_loaded_details():
    events = [event(kind="UDI_DI.PATCH") for _ in range(10001)]
    result = summary(subjects=[subject()], events=events)
    assert result["event_counts"]["UDI_DI.PATCH"] == 10001
    assert result["counts"]["registered_devices"] == 1
    assert summary(subjects=[subject()], events=events, search="unmatched")["event_counts"]["UDI_DI.PATCH"] == 0


def create_database(path):
    with sqlite3.connect(path) as c:
        c.executescript('''
            CREATE TABLE import_batch(id INTEGER PRIMARY KEY, imported_at TEXT);
            CREATE TABLE canonical_projection_snapshot(source_import_batch_id INTEGER);
            CREATE TABLE canonical_device_record(device_subject_id INTEGER, source_row_id INTEGER, record_json TEXT, source_import_batch_id INTEGER, updated_at TEXT);
            CREATE TABLE source_workbook(id INTEGER, import_batch_id INTEGER);
            CREATE TABLE source_row(id INTEGER, source_workbook_id INTEGER);
            CREATE TABLE device_identity_issue(device_subject_id INTEGER, source_row_id INTEGER, resolved_at TEXT);
            CREATE TABLE testing_subjects(id INTEGER, device_subject_id INTEGER, primary_udi_di TEXT, basic_udi_di TEXT);
            CREATE TABLE testing_events(id INTEGER, subject_id INTEGER, message_type TEXT, status TEXT, tested_at TEXT);
            INSERT INTO import_batch VALUES (1, '2026-10-07');
            INSERT INTO import_batch VALUES (2, '2026-10-08');
            INSERT INTO canonical_projection_snapshot VALUES (2);
            INSERT INTO source_workbook VALUES (1,1),(2,2);
            INSERT INTO source_row VALUES (1,1),(2,2),(3,2);
            INSERT INTO testing_subjects VALUES (2,2,'D2','B1');
            INSERT INTO testing_events VALUES (1,2,'UDI_DI.POST','ERROR','2026-10-08');
        ''')
        for batch in (1, 2):
            row = record(subject=batch, udi=f"D{batch}")
            c.execute('INSERT INTO canonical_device_record VALUES (?,?,?,?,?)',
                      (batch, batch, row['record_json'], batch, '2026-10-08'))


def service(path):
    instance = RegistrationSummaryService.__new__(RegistrationSummaryService)
    instance.settings = SimpleNamespace(testing_state_db_path=path)
    return instance


def test_sql_summary_uses_only_latest_import_and_exposes_excluded_rows(tmp_path, monkeypatch):
    path = tmp_path / 'synthetic.sqlite3'
    create_database(path)
    monkeypatch.setattr('app.services.registration_summary.OperationAssessmentService', lambda: SimpleNamespace(record_readiness=lambda **kwargs: [ready('D2')]))
    result = service(path).summary()
    assert result['counts']['total_devices'] == 1
    assert result['source_rows'] == 2
    assert result['outside_canonical_scope_rows'] == 1
    assert result['counts']['registered_devices'] == 0  # ERROR was excluded by SQL.
    assert result['import_batch_id'] == 2


def test_readiness_is_scoped_to_search_without_losing_whole_import_reconciliation(tmp_path, monkeypatch):
    path = tmp_path / 'synthetic.sqlite3'
    create_database(path)
    calls = []
    def readiness(*, record_payloads):
        calls.append(record_payloads)
        return [ready('D2')] if record_payloads else []
    monkeypatch.setattr('app.services.registration_summary.OperationAssessmentService', lambda: SimpleNamespace(record_readiness=readiness))
    matched = service(path).summary(search='b1')
    assert len(calls[-1]) == 1
    assert matched['counts']['total_devices'] == 1
    empty = service(path).summary(search='no matching model')
    assert calls[-1] == []
    assert empty['counts']['total_devices'] == 0
    assert empty['source_rows'] == matched['source_rows'] == 2
    assert empty['mapped_rows'] == matched['mapped_rows'] == 1
    assert empty['outside_canonical_scope_rows'] == matched['outside_canonical_scope_rows'] == 1


def test_scoped_readiness_preserves_identity_conflicts_outside_selected_family(tmp_path, monkeypatch):
    path = tmp_path / 'synthetic.sqlite3'
    create_database(path)
    conflicting = record(subject=3, udi='D2')
    payload = json.loads(conflicting['record_json'])
    payload['product_family'] = 'Other family'
    with sqlite3.connect(path) as connection:
        connection.execute('INSERT INTO canonical_device_record VALUES (?,?,?,?,?)', (3, 3, json.dumps(payload), 2, '2026-10-08'))
    calls = []
    def readiness(*, record_payloads):
        calls.append(record_payloads)
        return [ready('D2')]
    monkeypatch.setattr('app.services.registration_summary.OperationAssessmentService', lambda: SimpleNamespace(record_readiness=readiness))
    result = service(path).summary(product_family='A')
    assert len(calls[-1]) == 1
    assert result['unresolved_identity_rows'] == 2
    assert result['counts']['total_devices'] == 0
    assert result['counts']['post_ready'] == 0


def test_mid_calculation_acceptance_change_rejects_mixed_snapshot(tmp_path, monkeypatch):
    path = tmp_path / 'synthetic.sqlite3'
    create_database(path)
    def readiness(**kwargs):
        with sqlite3.connect(path) as c:
            c.execute("INSERT INTO testing_events VALUES (2,2,'UDI_DI.POST','SUCCESS','2026-10-08')")
        return []
    monkeypatch.setattr('app.services.registration_summary.OperationAssessmentService', lambda: SimpleNamespace(record_readiness=readiness))
    with pytest.raises(ValueError, match='state changed'):
        service(path).summary()


def test_missing_import_returns_unavailable_not_confirmed_zero(tmp_path):
    assert service(tmp_path / 'missing.sqlite3').summary()['import_batch_id'] is None


def test_route_reports_unavailable_snapshot_as_conflict(monkeypatch):
    def fail(**kwargs):
        raise ValueError('Snapshot changed; refresh')
    monkeypatch.setattr('app.routers.xml_generation.RegistrationSummaryService', lambda: SimpleNamespace(summary=fail))
    with pytest.raises(Exception) as exc:
        registration_summary()
    assert exc.value.status_code == 409


def test_post_counts_follow_actual_generation_assessment_rules():
    from app.services.operation_assessment import OperationAssessmentService
    from app.validation_models import CanonicalValidationRecord, CompletenessSnapshot

    completeness = CompletenessSnapshot(mapped_required_fields=1, total_required_fields=1, missing_required_fields=0, status='complete')
    device = CanonicalValidationRecord(source_workbook='synthetic.xlsx', product_family='A', product_variant='Model',
        source_sheet='Model', source_row_index=1, primary_udi_di='D1', catalogue_number='CAT-D1', issuing_entity='GS1',
        submission_operation='POST', reference_match_status='matched', completeness=completeness, xml_readiness=completeness)
    assessment = OperationAssessmentService.__new__(OperationAssessmentService)
    state = {'registered': False}
    assessment.testing_state_store = SimpleNamespace(
        generation_scope=lambda **kwargs: nullcontext(),
        has_successful_basic_udi_post=lambda **kwargs: True,
        has_successful_primary_udi_post=lambda **kwargs: state['registered'])
    assessment.xml_service = SimpleNamespace(_validation_bundle=lambda: SimpleNamespace(records=[device]),
        selector=SimpleNamespace(request_scope=lambda projection: nullcontext()),
        canonical_projection_service=None,
        _bulk_record_summary=lambda record: SimpleNamespace(basic_udi_di='B1'))
    assessment._assess_single_patch_record = lambda record: SimpleNamespace(status='blocked')
    assessment._assess_single_market_info_record = lambda record: SimpleNamespace(status='blocked')
    readiness = assessment.record_readiness()
    result = summary(readiness=readiness)
    assert result['counts']['post_ready'] == 1
    assert result['counts']['child_post_ready'] == 1
    state['registered'] = True
    assert summary(readiness=assessment.record_readiness())['counts']['post_ready'] == 0
    state['registered'] = False
    device.xml_readiness = completeness.model_copy(update={'status': 'incomplete'})
    assert summary(readiness=assessment.record_readiness())['counts']['post_ready'] == 0


def test_snapshot_rejects_subject_identity_change_without_new_event(tmp_path, monkeypatch):
    path = tmp_path / 'synthetic.sqlite3'
    create_database(path)
    def readiness(**kwargs):
        with sqlite3.connect(path) as c:
            c.execute("UPDATE testing_subjects SET primary_udi_di='CHANGED' WHERE id=2")
        return []
    monkeypatch.setattr('app.services.registration_summary.OperationAssessmentService', lambda: SimpleNamespace(record_readiness=readiness))
    with pytest.raises(ValueError, match='state changed'):
        service(path).summary()


def test_missing_latest_canonical_snapshot_never_falls_back_to_old_counts(tmp_path):
    path = tmp_path / 'synthetic.sqlite3'
    create_database(path)
    with sqlite3.connect(path) as c:
        c.execute('DELETE FROM canonical_projection_snapshot')
    with pytest.raises(ValueError, match='no canonical snapshot'):
        service(path).summary()


def test_status_filter_totals_and_group_rows_use_same_scope():
    result = summary(records=[record(), record(subject=2, udi='D2', parent='B2')], readiness=[ready()], status='POST ready')
    assert result['counts']['total_devices'] == 1
    assert len(result['groups']) == 1
    assert result['counts']['post_ready'] == 1
    assert result['counts']['total_devices'] == result['counts']['registered_devices'] + result['counts']['unknown_devices'] + result['counts']['awaiting_devices']


def test_unknown_parent_identity_is_not_mistaken_for_parent_post_eligibility():
    result = summary(readiness=[ready(child_post_ready=True, parent_registered=True)])
    # Existing generation may know a parent from legacy text lineage, while the
    # stronger identity summary lacks issuer evidence. Do not offer another seed.
    assert result['counts']['unknown_parents'] == 1
    assert result['groups'][0]['parent_post_ready'] is False
    assert result['groups'][0]['status'] == 'Child POST ready'


def test_unresolved_parent_is_disclosed_without_losing_known_device_total():
    row = record()
    value = json.loads(row['record_json'])
    value['fields'] = []
    row['record_json'] = json.dumps(value)
    result = summary(records=[row], readiness=[ready()])
    assert result['counts']['total_devices'] == 1
    assert result['counts']['unresolved_parent_devices'] == 1
    assert result['counts']['total_parents'] == 0
    assert result['counts']['post_ready'] == 0


def test_child_details_share_summary_identity_and_acceptance_rules():
    rows = [record(), record(subject=2, udi='D2'), record(subject=3, udi='D2')]
    rows[1]['production_registration_status'] = 'Not registered'
    rows[2]['production_registration_status'] = 'Not registered'
    result = summary(records=rows, subjects=[subject()], events=[event()],
                     readiness=[ready(post_ready=False, patch_ready=True), ready('D2', child_post_ready=True)],
                     include_children=True)
    group = result['groups'][0]
    assert group['total_devices'] == len(group['children']) == 2
    assert group['children'][0]['registration_status'] == 'Registered'
    assert group['children'][0]['patch_ready'] is True
    assert group['children'][0]['post_ready'] is False
    assert group['children'][1]['registration_status'] == 'Awaiting registration'
    assert group['children'][1]['child_post_ready'] is True
    assert summary(records=rows)['groups'][0].get('children') is None


def test_parent_only_acceptance_preserves_unknown_child_and_enables_child_post():
    parent = subject(device=None, udi=None,
                     latest_successful_post_state_json=json.dumps({'basic_identifier_issuing_entity': 'GS1'}))
    result = summary(subjects=[parent], events=[event()], readiness=[ready(child_post_ready=True, parent_registered=True)],
                     include_children=True)
    group = result['groups'][0]
    assert group['parent_registered'] is True
    assert group['children'][0]['registration_status'] == 'Unknown'
    assert group['children'][0]['child_post_ready'] is True


def test_child_details_do_not_expose_ambiguous_identity_as_ready():
    result = summary(records=[record(), record(subject=2, issuer='HIBCC')],
                     readiness=[ready()], include_children=True)
    assert all(not g['children'][0]['post_ready'] for g in result['groups'])
    result = summary(readiness=[ready()], issue_subjects={1}, include_children=True)
    assert result['groups'][0]['children'][0]['post_ready'] is False


def test_children_drilldown_uses_exact_parent_issuer_group_scope_and_pagination(monkeypatch):
    result = summary(records=[record(), record(subject=2, udi='D2'),
                              record(subject=3, udi='D3', parent='B10'),
                              record(subject=4, udi='D4', issuer='HIBCC')], include_children=True)
    instance = service(None)
    calls = []
    monkeypatch.setattr(instance, 'summary', lambda **kw: calls.append(kw) or result)
    gs1 = next(g for g in result['groups'] if g['basic_udi_di'] == 'B1' and g['parent_issuing_entity'] == 'GS1')
    page = instance.children(basic_udi_di='B1', issuing_entity='GS1', group_keys=[gs1['key']], offset=1, limit=1, import_batch_id=1)
    assert page['total'] == 2
    assert [c['primary_udi_di'] for c in page['children']] == ['D2']
    assert calls == [{'search': 'B1', 'include_children': True}]
    assert instance.children(basic_udi_di='B1', issuing_entity='GS1', group_keys=['not in scope'])['total'] == 0
    with pytest.raises(ValueError, match='import changed'):
        instance.children(basic_udi_di='B1', issuing_entity='GS1', group_keys=[gs1['key']], import_batch_id=2)


def test_children_request_rejects_invalid_pagination_and_reports_snapshot_conflict(monkeypatch):
    from pydantic import ValidationError
    from app.routers.xml_generation import RegistrationChildrenRequest, registration_children
    payload = {'basic_udi_di': 'B1', 'issuing_entity': 'GS1', 'group_keys': ['group']}
    for invalid in ({'offset': -1}, {'limit': 101}, {'group_keys': []}):
        with pytest.raises(ValidationError):
            RegistrationChildrenRequest(**(payload | invalid))
    def fail(**kwargs):
        raise ValueError('The import changed. Refresh counts.')
    monkeypatch.setattr('app.routers.xml_generation.RegistrationSummaryService', lambda: SimpleNamespace(children=fail))
    with pytest.raises(Exception) as exc:
        registration_children(RegistrationChildrenRequest(**payload))
    assert exc.value.status_code == 409


def test_dev_playground_baseline_registers_identity_without_submission_success(tmp_path, monkeypatch):
    path=tmp_path/'synthetic.sqlite3'
    create_database(path)
    with sqlite3.connect(path) as connection:
        for column in ('event_kind TEXT','accepted_state_source TEXT','state_after_json TEXT'):
            connection.execute('ALTER TABLE testing_events ADD COLUMN '+column)
        connection.execute("INSERT INTO testing_events(id,subject_id,message_type,status,event_kind,accepted_state_source,state_after_json) VALUES(2,2,'PLAYGROUND_EXPORT.SNAPSHOT','IMPORTED','BASELINE_IMPORT','playground_export','{}')")
    monkeypatch.setattr('app.services.registration_summary.OperationAssessmentService',lambda:SimpleNamespace(record_readiness=lambda **kwargs:[ready('D2',post_ready=False,patch_ready=True)]))
    result=service(path).summary()
    assert result['counts']['registered_devices']==1
    assert result['counts']['registered_parents']==1
    assert result['counts']['patch_ready']==1
    assert sum(result['event_counts'].values())==0
