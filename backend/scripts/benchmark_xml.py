"""Synthetic XML service benchmark; never reads or writes the application database.

Run: PYTHONPATH=backend .venv/bin/python backend/scripts/benchmark_xml.py --output /tmp/xml-before.json
The SQLite fixture contains simplified canonical JSON, not production workbooks.
HTTP transfer and browser display are outside this service benchmark.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from contextlib import ExitStack
import json
import os
from pathlib import Path
import sqlite3
import tempfile
from time import perf_counter
from unittest.mock import patch

from app.config import get_settings
from app.services.xml_generation import XmlGenerationService
from app.services.xml_validation import XmlValidationService
from app.validation_models import CanonicalValidationBundle, CanonicalValidationRecord


def synthetic_record(index: int, *, parent: str = "BASICSHARED", family: str = "Synthetic") -> CanonicalValidationRecord:
    catalogue = f"SYN-{index:05d}"
    udi = f"{99000000000000 + index:014d}"
    values = {
        "manufacturer.manufacturer_srn": "GB-MF-000000001", "manufacturer.issuing_entity": "GS1",
        "basic_device.basic_udi_di": parent, "device_record.basic_udi_identifier": f"GS1:{parent}",
        "device_record.identifier": f"GS1:{udi}", "device_record.primary_udi_di": udi,
        "device_record.catalogue_number": catalogue, "device_record.trade_name": "Synthetic device",
        "device_record.language": "English", "basic_device.risk_class": "CLASS_IIA",
        "basic_device.device_model": "Synthetic model", "basic_device.device_type": "DEVICE",
        "basic_device.nomenclature_code": "P0901", "basic_device.source_version_marker": "1",
        "device_record.status": "ON_THE_MARKET", "device_record.number_of_reuses": "0",
        "device_record.base_quantity": "1",
    }
    for name in ("human_tissues_cells", "animal_tissues_cells", "human_product_check", "medicinal_product_check",
                 "active", "administering_medicinal_product", "implantable", "measuring_function", "reusable_surgical_instrument"):
        values[f"basic_device.{name}"] = "false"
    for name in ("sterile", "sterilisation_before_use", "contains_latex", "reprocessed"):
        values[f"device_record.{name}"] = "false"
    ready = dict(mapped_required_fields=len(values), total_required_fields=len(values), missing_required_fields=0, status="complete")
    return CanonicalValidationRecord(
        source_workbook="synthetic.xlsx", source_sheet="Synthetic", source_row_index=index + 2,
        product_family=family, product_variant="Synthetic", catalogue_number=catalogue, primary_udi_di=udi,
        trade_name="Synthetic device", issuing_entity="GS1", submission_operation="POST", reference_match_status="matched",
        completeness=ready, xml_readiness=ready,
        fields=[dict(canonical_path=k, business_label=k, value=v, source="derived") for k, v in values.items()],
        market_availability_items=[dict(sequence=1, country="DE", original_placed_on_market=True)],
    )


def make_service(directory: Path, flow: str, count: int, population: int = 1000):
    os.environ['EUDAMED_TESTING_STATE_DB_PATH'] = str(directory / 'testing.sqlite3')
    os.environ['EUDAMED_TESTING_STATE_BACKUP_DIR'] = str(directory / 'backups')
    get_settings.cache_clear()
    service = XmlGenerationService()
    records = [synthetic_record(i, parent=f"BASIC{i:05d}" if flow == 'basic_post' else 'BASICSHARED') for i in range(count)]
    records.extend(synthetic_record(i, family="Unrelated") for i in range(count, population))
    bundle = CanonicalValidationBundle(
        family_scope="synthetic", scope_note="synthetic", validation_note="synthetic", total_source_records=population,
        validation_subset_records=population, excluded_records=0, matched_reference_records=population,
        tracked_required_fields=1, tracked_xml_required_fields=1, ready_records=population, blocked_records=0,
        xml_ready_records=population, xml_blocked_records=0, records=records,
    )
    with sqlite3.connect(service.testing_state_store.db_path) as connection:
        connection.execute('CREATE TABLE benchmark_bundle (payload TEXT NOT NULL)')
        connection.execute('INSERT INTO benchmark_bundle VALUES (?)', (bundle.model_dump_json(),))

    def load(**kwargs):
        with sqlite3.connect(service.testing_state_store.db_path) as connection:
            payload = connection.execute('SELECT payload FROM benchmark_bundle').fetchone()[0]
        return CanonicalValidationBundle.model_validate_json(payload)

    service.canonical_projection_service.latest_bundle = load
    service.selector.projection_service.latest_bundle = load
    store = service.testing_state_store
    if flow in ('udidi_post', 'patch'):
        seed_records = records[:count] if flow == 'patch' else [synthetic_record(population + 1)]
        with store._connect() as connection:
            for record in seed_records:
                xml = service.projection_builder.build_device_record(record)
                subject = store._ensure_testing_subject(connection, product_family=record.product_family,
                    product_variant=record.product_variant, catalogue_number=record.catalogue_number,
                    primary_udi_di=record.primary_udi_di, basic_udi_di='BASICSHARED')
                state = json.dumps(service._post_state_snapshot_payload(xml))
                connection.execute('UPDATE testing_subjects SET post_success=1, latest_successful_version=\'1\', latest_successful_post_version=\'1\', latest_successful_post_state_json=? WHERE id=?', (state, subject))
                connection.execute("INSERT INTO testing_events(subject_id,event_index,message_type,status,event_kind,version,raw_event_json) VALUES (?,0,?,'SUCCESS','success_ack','1','{}')", (subject, 'UDI_DI.POST' if flow == 'patch' else 'DEVICE.POST'))
    return service, records[:count]


def operation(service, flow, action, count):
    args = dict(product_family='Synthetic', product_variant='Synthetic')
    if flow == 'single_post':
        return (service.preview_next_post_registration if action == 'preview' else service.download_post_package)(
            **args, **({} if action == 'preview' else {'catalogue_number': 'SYN-00000'}))
    method = getattr(service, f"{'preview' if action == 'preview' else 'download'}_bulk_{ {'basic_post':'post','udidi_post':'udidi_post','patch':'patch'}[flow]}")
    args['record_count'] = count
    if flow == 'patch':
        args.update(basic_udi_di='BASICSHARED', scenario_id='base_quantity_edit', scenario_inputs={'new_base_quantity': 2})
    return method(**args)


class Timings:
    def __init__(self):
        self.seconds = defaultdict(float)
        self.calls = defaultdict(int)
        self.stack = []

    def wrap(self, name, method):
        def measured(*args, **kwargs):
            frame = [perf_counter(), 0.0]
            self.stack.append(frame)
            try:
                return method(*args, **kwargs)
            finally:
                elapsed = perf_counter() - frame[0]
                self.stack.pop()
                self.seconds[name] += elapsed - frame[1]
                self.calls[name] += 1
                if self.stack:
                    self.stack[-1][1] += elapsed
        return measured

    def instrument(self, service, stack):
        groups = [
            (service.canonical_projection_service, ['latest_bundle'], 'canonical_load'),
            (service.selector.projection_service, ['latest_bundle'], 'canonical_load'),
            (service, ['_variant_post_records_with_exclusions', '_bulk_patch_selected_records', '_deduplicate_bulk_basic_udi_posts', '_bulk_udidi_post_candidates'], 'selection'),
            (service.projection_builder, ['build_device_record', 'build_udidi_post_record', 'build_patch_record_from_state'], 'projection'),
            (service.renderer, ['render_message', 'render_message_records', 'render_batch_from_strings'], 'rendering'),
            (service.xml_validation_service, ['validate_message'], 'validation'),
            (service.package_builder, ['build_archive'], 'compression'),
            (service.testing_state_store, ['record_generated_post_context', 'record_generated_patch_context', 'record_generated_package'], 'audit_writes'),
            (service.testing_state_store, ['_subject_row', 'accepted_post_state', 'latest_successful_patch_state', 'latest_successful_market_info_state', 'has_successful_basic_udi_post', 'has_successful_primary_udi_post', 'posted_entries', 'patch_baseline_unavailable_reason', 'has_pending_market_info_update_error'], 'accepted_state'),
        ]
        for obj, names, label in groups:
            for name in names:
                stack.enter_context(patch.object(obj, name, self.wrap(label, getattr(obj, name))))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--population', type=int, default=1000)
    parser.add_argument('--sizes', type=int, nargs='+', default=[10, 50, 100])
    options = parser.parse_args()
    # Keep actors, schema version and batch limits identical across revisions.
    os.environ['EUDAMED_MANUFACTURER_SRN_OVERRIDE'] = 'GB-MF-000000001'
    os.environ['EUDAMED_SUPPRESS_AUTHORISED_REPRESENTATIVE'] = 'true'
    os.environ['EUDAMED_MESSAGE_SCHEMA_VERSION'] = '3.0.32'
    os.environ['EUDAMED_MAX_BATCH_RECORDS'] = '300'
    rows = []
    for flow in ('single_post', 'basic_post', 'udidi_post', 'patch'):
        for count in ([1] if flow == 'single_post' else options.sizes):
            for action in ('preview', 'zip'):
                with tempfile.TemporaryDirectory(prefix='xml-benchmark-') as directory:
                    service, _ = make_service(Path(directory), flow, count, max(count, options.population))
                    XmlValidationService._message_schema.cache_clear()
                    for temperature in ('cold', 'warm'):
                        timing = Timings()
                        with ExitStack() as stack:
                            timing.instrument(service, stack)
                            started = perf_counter()
                            result = operation(service, flow, action, count)
                            elapsed = perf_counter() - started
                        if action == 'preview':
                            validation = getattr(result, 'selected_chunk_validation', None) or result.post_validation
                            if not validation.valid:
                                raise AssertionError(validation.errors)
                        row = dict(flow=flow, count=count, action=action, run=temperature,
                                   seconds=round(elapsed, 6), stages={k: round(v, 6) for k,v in timing.seconds.items()},
                                   calls=dict(timing.calls), bytes=len(result[1]) if action == 'zip' else len(result.model_dump_json()))
                        rows.append(row)
                        print(f'{flow} {count} {action} {temperature}: {elapsed:.3f}s', flush=True)
                        options.output.write_text(json.dumps(dict(population=options.population, results=rows), indent=2))

if __name__ == '__main__':
    main()
