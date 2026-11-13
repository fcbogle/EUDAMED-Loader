"""Both environments select operations from registration, never legacy labels."""
import json
from types import SimpleNamespace
import pytest
from lxml import etree

from app.services.operation_assessment import OperationAssessmentService
from scripts.benchmark_xml import make_service


@pytest.fixture(params=["dev", "prod"])
def workspace(tmp_path,monkeypatch,request):
    monkeypatch.setenv('EUDAMED_ENVIRONMENT','dev')
    monkeypatch.setenv('EUDAMED_TESTING_STATE_DB_PATH',str(tmp_path/'before.sqlite3'))
    monkeypatch.setenv('EUDAMED_TESTING_STATE_BACKUP_DIR',str(tmp_path/'before-backups'))
    service,records=make_service(tmp_path,'single_post',3,population=3)
    settings=service.settings.model_copy(update={'environment':request.param})
    service.settings=settings
    monkeypatch.setattr('app.config.get_settings',lambda:settings)
    with service.testing_state_store._connect() as c:
        bundle=json.loads(c.execute('SELECT payload FROM benchmark_bundle').fetchone()[0])
        for row in bundle['records']:row['submission_operation']='PATCH'
        bundle['records'][2]['xml_readiness']['status']='incomplete'
        c.execute('UPDATE benchmark_bundle SET payload=?',(json.dumps(bundle),))
    assessment=OperationAssessmentService.__new__(OperationAssessmentService)
    assessment.xml_service=service
    assessment.testing_state_store=service.testing_state_store
    return service,records,assessment


def seed_registered(service,record):
    store=service.testing_state_store
    with store._connect() as c:
        id=store._ensure_testing_subject(c,product_family=record.product_family,product_variant=record.product_variant,
            catalogue_number=record.catalogue_number,primary_udi_di=record.primary_udi_di,basic_udi_di='BASICSHARED')
        c.execute("INSERT INTO testing_events(subject_id,event_index,message_type,status,version,raw_event_json) VALUES(?,0,'DEVICE.POST','SUCCESS','1','{}')",(id,))
        state=service._post_state_snapshot_payload(service.projection_builder.build_device_record(record))
        c.execute("UPDATE testing_subjects SET post_success=1,latest_successful_version='1',latest_successful_post_version='1',latest_successful_post_state_json=?,exclude_from_post_wave=1,exclude_from_baseline_patch_wave=1 WHERE id=?",(json.dumps(state),id))
    return id


def test_dev_patch_source_can_be_assessed_selected_and_rendered_as_real_post(workspace):
    service,records,assessment=workspace
    scope={'product_family':'Synthetic','product_variant':'Synthetic'}
    result=assessment.assess_single_post(**scope,catalogue_number=records[0].catalogue_number)
    assert result.status=='available'
    preview=service.preview_next_post_registration(**scope)
    assert preview.message_type=='DEVICE.POST'
    assert preview.post_validation.valid
    root=etree.fromstring(preview.post_xml.encode())
    assert root.xpath('//*[local-name()="serviceOperation"]/text()')==['POST','POST']
    selected=service.selector.find_post_record(**scope,catalogue_number=records[0].catalogue_number)
    assert selected.submission_operation=='POST'
    readiness=assessment.record_readiness()
    assert len(readiness)==2 and all(row['post_ready'] for row in readiness)
    with service.testing_state_store._connect() as c:
        source=json.loads(c.execute('SELECT payload FROM benchmark_bundle').fetchone()[0])
        assert all(row['submission_operation']=='PATCH' for row in source['records'])
        assert c.execute('SELECT count(*) FROM testing_events').fetchone()[0]==0


def test_known_parent_uses_child_post_and_registered_device_stays_blocked(workspace):
    service,records,assessment=workspace
    seed_registered(service,records[1])
    scope={'product_family':'Synthetic','product_variant':'Synthetic'}
    assert assessment.assess_single_post(**scope,catalogue_number=records[1].catalogue_number).status=='blocked'
    with pytest.raises(ValueError,match='already has registration evidence'):
        service.download_post_package(**scope,catalogue_number=records[1].catalogue_number)
    preview=service.preview_next_post_registration(**scope)
    assert preview.catalogue_number==records[0].catalogue_number
    assert preview.message_type=='UDI_DI.POST' and preview.post_validation.valid
    root=etree.fromstring(preview.post_xml.encode())
    assert not root.xpath('//*[local-name()="MDRBasicUDI"]')
    rows=assessment.record_readiness()
    assert rows[0]['child_post_ready']
    assert not rows[1]['post_ready']
    assert rows[1]['registration_known'] and rows[1]['operational_operation']=='PATCH'
    assert rows[0]['operational_operation']=='POST'
    candidates,excluded,_=service._variant_post_records_with_exclusions(**scope,record_count=None)
    included,excluded,_=service._bulk_udidi_post_candidates(**scope,records=candidates,excluded_records=excluded)
    assert [r.catalogue_number for r in included]==[records[0].catalogue_number]
    assert any(row.reason_code=='xml_not_ready' for row in excluded)


def test_legacy_testing_flags_do_not_establish_registration_or_exclude_post(workspace):
    service,records,assessment=workspace
    store=service.testing_state_store
    with store._connect() as c:
        id=store._ensure_testing_subject(c,product_family=records[0].product_family,product_variant=records[0].product_variant,
            catalogue_number=records[0].catalogue_number,primary_udi_di=records[0].primary_udi_di,basic_udi_di='BASICSHARED')
        c.execute('UPDATE testing_subjects SET post_success=1,baseline_patch_success=1,exclude_from_post_wave=1,exclude_from_baseline_patch_wave=1 WHERE id=?',(id,))
    row=assessment.record_readiness()[0]
    assert row['post_ready'] and not row['registration_known']
    assert row['operational_operation']=='POST' and not row['patch_ready']


def test_identical_udi_registration_is_not_shared_between_environment_databases(tmp_path,monkeypatch):
    monkeypatch.setenv('EUDAMED_ENVIRONMENT','dev')
    monkeypatch.setenv('EUDAMED_TESTING_STATE_DB_PATH',str(tmp_path/'before.sqlite3'))
    monkeypatch.setenv('EUDAMED_TESTING_STATE_BACKUP_DIR',str(tmp_path/'before-backups'))
    dev,dev_records=make_service(tmp_path/'dev','single_post',1,population=1)
    prod,prod_records=make_service(tmp_path/'prod','single_post',1,population=1)
    prod.settings=prod.settings.model_copy(update={'environment':'prod'})
    seed_registered(dev,dev_records[0])
    def assess(service):
        result=OperationAssessmentService.__new__(OperationAssessmentService)
        result.xml_service=service;result.testing_state_store=service.testing_state_store
        return result.assess_single_post(product_family='Synthetic',product_variant='Synthetic',catalogue_number='SYN-00000')
    assert dev_records[0].primary_udi_di==prod_records[0].primary_udi_di
    assert assess(dev).status=='blocked'
    assert assess(prod).status=='available'
    assert 'Registered in Dev' in dev._registration_label(product_family='Synthetic',product_variant='Synthetic',primary_udi_di=dev_records[0].primary_udi_di)
    assert 'not evidenced in Production' in prod._registration_label(product_family='Synthetic',product_variant='Synthetic',primary_udi_di=prod_records[0].primary_udi_di)
