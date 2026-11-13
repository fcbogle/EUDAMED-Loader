"""Negative registration status needs explicit environment-bound scope evidence."""
from contextlib import closing
import json,sqlite3
import pytest

from app.services.registration_coverage import confirm_dev_device_scope,coverage_for
from app.services.registration_summary import RegistrationSummaryService
from test_playground_baseline_import import importer,apply
from test_playground_reconciliation import reconciliation
from test_dev_input_batches import project
from test_registration_summary import record,subject,event,ready


def coverage(issuer='GS1',environment='dev'):
    return {'environment':environment,'manufacturer_srn':'GB-MF-000000001',
            'manufacturer_override':'GB-MF-000000001','registered_device_keys':{(issuer,'REGISTERED')},
            'export_as_of':'2026-10-25T10:00:00Z','confirmed_at':'2026-10-25T12:00:00Z','covers_parent_only':False}


def build(scope,records=None,subjects=None,events=None,issues=None):
    return RegistrationSummaryService._build(records or [record()],subjects or [],events or [],[ready()],
        batch={'id':1,'imported_at':'2026-10-25'},source_count=1,identity_issues=0,include_children=True,
        issue_subjects=issues,coverage=scope)


def test_workbook_child_and_parent_are_unregistered_without_positive_evidence():
    result=build(coverage())
    assert result['counts']['awaiting_devices']==1 and result['counts']['unknown_devices']==0
    group=result['groups'][0]
    assert group['children'][0]['registration_status']=='Unregistered'
    assert not group['parent_registered'] and result['counts']['unregistered_parents']==1
    assert group['parent_registration_status']=='Unregistered'
    assert result['registration_coverage']['covers_parent_only'] is False
    assert 'registered_device_keys' not in result['registration_coverage']


def test_workbook_membership_is_independent_of_coverage_and_identity_readiness():
    assert build(None)['counts']['awaiting_devices']==1
    result=build(coverage(),issues={1})
    assert result['counts']['awaiting_devices']==1
    assert result['counts']['awaiting_blocked']==1
    # Positive extract membership wins even if its old local subject link is missing.
    scope=coverage();scope['registered_device_keys']={('GS1','D1')}
    assert build(scope)['counts']['registered_devices']==1


def test_later_success_overrides_negative_coverage():
    result=build(coverage(),subjects=[subject()],events=[event()])
    assert result['counts']['registered_devices']==1
    assert result['counts']['awaiting_devices']==0
    assert result['groups'][0]['children'][0]['registration_status']=='Registered'


def test_confirmation_is_backed_up_idempotent_and_environment_bound(importer):
    service,batch,_=importer
    apply(importer)
    settings=service.settings
    result=confirm_dev_device_scope(settings,batch.name,confirmed_by='Synthetic owner: complete device extracts only')
    assert not result['already_confirmed'] and not result['covers_parent_only']
    assert result['backup']['integrity_check']=='ok'
    with closing(sqlite3.connect(service.database)) as c:
        c.row_factory=sqlite3.Row
        actual=coverage_for(c,settings)
        assert actual and actual['environment']=='dev'
        assert coverage_for(c,settings.model_copy(update={'environment':'prod'})) is None
        assert coverage_for(c,settings.model_copy(update={'eudamed_manufacturer_srn_override':'OTHER-MF'})) is None
        assert coverage_for(c,settings.model_copy(update={'testing_state_db_path':service.database.parent/'different.sqlite3'})) is None
    assert confirm_dev_device_scope(settings,batch.name,confirmed_by='Repeat')['already_confirmed']
    with sqlite3.connect(service.database) as c:
        assert c.execute('SELECT count(*) FROM registration_scope_confirmation').fetchone()[0]==1
        c.execute('UPDATE registration_scope_confirmation SET revoked=1')
        c.row_factory=sqlite3.Row
        assert coverage_for(c,settings) is None


def test_confirmation_requires_applied_baseline_and_keeps_history(importer):
    service,batch,_=importer
    with pytest.raises(ValueError,match='Apply and verify'):confirm_dev_device_scope(service.settings,batch.name,confirmed_by='Owner')
    apply(importer)
    with sqlite3.connect(service.database) as c: before=c.execute('SELECT * FROM testing_events').fetchall()
    confirm_dev_device_scope(service.settings,batch.name,confirmed_by='Owner')
    with sqlite3.connect(service.database) as c:
        assert c.execute('SELECT * FROM testing_events').fetchall()==before
        assert c.execute('SELECT count(*) FROM reviewed_post_baselines').fetchone()[0]==0


def test_newer_export_set_requires_fresh_completeness_confirmation(importer):
    service,batch,_=importer
    apply(importer)
    confirm_dev_device_scope(service.settings,batch.name,confirmed_by='Owner')
    with closing(sqlite3.connect(service.database)) as c:
        c.row_factory=sqlite3.Row
        previous=c.execute("SELECT * FROM testing_events WHERE status='IMPORTED'").fetchone()
        raw=json.loads(previous['raw_event_json']);raw['evidence_id']='different-new-export-set'
        c.execute("INSERT INTO testing_events(subject_id,event_index,message_type,status,event_kind,accepted_state_source,state_after_json,raw_event_json) VALUES(1,99,'PLAYGROUND_EXPORT.SNAPSHOT','IMPORTED','BASELINE_IMPORT','playground_export',?,?)",(previous['state_after_json'],json.dumps(raw)))
        assert coverage_for(c,service.settings) is None
