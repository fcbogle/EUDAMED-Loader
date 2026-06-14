from __future__ import annotations

from app.config import get_settings
from app.services.canonical_validation import CanonicalValidationService
from app.services.xml_packaging import XmlPackageBuilder
from app.services.xml_projection import DeviceXmlProjectionBuilder
from app.services.xml_rendering import EudamedMessageRenderer
from app.services.xml_selection import ValidationRecordSelector
from app.services.xml_validation import XmlValidationService
from app.validation_models import CanonicalValidationRecord
from app.xml_models import (
    BatchXmlChunkSummary,
    BatchXmlPreview,
    EquivalentPatchPairPreview,
    MarketInfoPutPreview,
    PatchScenarioXmlPreview,
    RegisteredDeviceAnchor,
    SingleRecordXmlPreview,
    XmlGenerationScopeBundle,
    XmlGenerationSelectionSummary,
)


class XmlGenerationService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.validation_service = CanonicalValidationService()
        self.xml_validation_service = XmlValidationService()
        self.selector = ValidationRecordSelector(self.validation_service)
        self.projection_builder = DeviceXmlProjectionBuilder()
        self.renderer = EudamedMessageRenderer(self.settings)
        self.package_builder = XmlPackageBuilder()

    @property
    def project_root(self):
        return self.settings.schema_dir.parents[1]

    def generation_scope(self) -> XmlGenerationScopeBundle:
        bundle = self.validation_service.build_validation_bundle()
        families = [
            XmlGenerationSelectionSummary(
                product_family=summary.product_family,
                product_variant="All variants",
                submission_operation=None,
                total_records=summary.total_records,
                xml_ready_records=summary.xml_ready_records,
                xml_blocked_records=summary.xml_blocked_records,
            )
            for summary in bundle.family_summaries
        ]
        return XmlGenerationScopeBundle(
            family_scope=bundle.family_scope,
            scope_note=(
                "XML generation now follows Canonical Validation scope. Select a product family and "
                "product variant, then generate XML only from rows that are currently XML-ready."
            ),
            total_xml_ready_records=bundle.xml_ready_records,
            families=families,
        )

    def testing_registered_device_anchor(self, *, family_id: str) -> RegisteredDeviceAnchor:
        baseline_fixture, manifest = self._load_patch_baseline_manifest(family_id=family_id)
        return self._registered_device_anchor_from_manifest(
            family_id=family_id,
            baseline_fixture=baseline_fixture,
            manifest=manifest,
        )

    def preview_single_record(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> SingleRecordXmlPreview:
        record = self.selector.find_xml_ready_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        xml_record = self.projection_builder.build_device_record(record)
        xml_bytes = self.renderer.render_message(xml_record)
        validation = self.xml_validation_service.validate_message(xml_bytes)
        return SingleRecordXmlPreview(
            product_family=record.product_family,
            product_variant=record.product_variant,
            submission_operation=record.submission_operation,
            catalogue_number=xml_record.catalogue_number,
            trade_name=xml_record.trade_name,
            primary_udi_di=xml_record.primary_udi_di,
            file_name=self.package_builder.file_name(
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=xml_record.catalogue_number,
            ),
            xml=xml_bytes.decode("utf-8"),
            validation=validation,
        )

    def download_single_record(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> tuple[str, bytes]:
        preview = self.preview_single_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        return preview.file_name, preview.xml.encode("utf-8")

    def preview_post_patch_pair(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> EquivalentPatchPairPreview:
        record = self.selector.find_xml_ready_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        if self._normalized_operation(record.submission_operation) != "POST":
            raise ValueError(
                f"Catalogue number {catalogue_number} is not currently classified as a POST record for "
                f"{product_family} / {product_variant}."
            )

        post_record = self.projection_builder.build_device_record(record)
        patch_record = self.projection_builder.build_equivalent_first_patch(post_record)
        post_xml_bytes = self.renderer.render_message(post_record)
        patch_xml_bytes = self.renderer.render_message(patch_record)
        post_file_name = self.package_builder.operation_file_name(
            product_family=record.product_family,
            product_variant=record.product_variant,
            operation="POST",
            catalogue_number=post_record.catalogue_number,
        )
        patch_file_name = self.package_builder.operation_file_name(
            product_family=record.product_family,
            product_variant=record.product_variant,
            operation="PATCH",
            catalogue_number=patch_record.catalogue_number,
        )
        registered_device_anchor = RegisteredDeviceAnchor(
            family_id=self._slugify_fixture_family_id(record.product_family, record.product_variant, post_record.catalogue_number),
            baseline_fixture=(
                f"equivalent_baseline/"
                f"{self._slugify_fixture_family_id(record.product_family, record.product_variant, post_record.catalogue_number)}"
            ),
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=post_record.catalogue_number,
            primary_udi_di=post_record.primary_udi_di,
            post_file_name=post_file_name,
            patch_file_name=patch_file_name,
            post_valid=True,
            patch_valid=True,
            eudamed_status="EUDAMED Accepted",
        )
        return EquivalentPatchPairPreview(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=post_record.catalogue_number,
            primary_udi_di=post_record.primary_udi_di,
            registered_device_anchor=registered_device_anchor,
            post_file_name=post_file_name,
            post_xml=post_xml_bytes.decode("utf-8"),
            post_validation=self.xml_validation_service.validate_message(post_xml_bytes),
            patch_file_name=patch_file_name,
            patch_xml=patch_xml_bytes.decode("utf-8"),
            patch_validation=self.xml_validation_service.validate_message(patch_xml_bytes),
        )

    def preview_market_info_put(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> MarketInfoPutPreview:
        record = self.selector.find_xml_ready_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        market_info_record = self.projection_builder.build_market_info_record(record)
        xml_bytes = self.renderer.render_market_info_message(market_info_record)
        validation = self.xml_validation_service.validate_message(xml_bytes)
        fixture_family_id = self._slugify_fixture_family_id(
            record.product_family,
            record.product_variant,
            market_info_record.catalogue_number,
        )
        return MarketInfoPutPreview(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=market_info_record.catalogue_number,
            primary_udi_di=market_info_record.primary_udi_di,
            registered_device_anchor=RegisteredDeviceAnchor(
                family_id=fixture_family_id,
                baseline_fixture=f"equivalent_baseline/{fixture_family_id}",
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=market_info_record.catalogue_number,
                primary_udi_di=market_info_record.primary_udi_di,
                post_file_name=self.package_builder.operation_file_name(
                    product_family=record.product_family,
                    product_variant=record.product_variant,
                    operation="POST",
                    catalogue_number=market_info_record.catalogue_number,
                ),
                patch_file_name=self.package_builder.operation_file_name(
                    product_family=record.product_family,
                    product_variant=record.product_variant,
                    operation="PATCH",
                    catalogue_number=market_info_record.catalogue_number,
                ),
                post_valid=True,
                patch_valid=True,
                eudamed_status="EUDAMED Accepted",
            ),
            file_name=self.package_builder.market_info_file_name(
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=market_info_record.catalogue_number,
            ),
            xml=xml_bytes.decode("utf-8"),
            validation=validation,
        )

    def download_market_info_put(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> tuple[str, bytes]:
        preview = self.preview_market_info_put(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        return preview.file_name, preview.xml.encode("utf-8")

    def preview_patch_scenario_fixture(
        self,
        *,
        family_id: str,
        scenario_id: str,
    ) -> PatchScenarioXmlPreview:
        scenario_dir = (
            self.project_root
            / "backend"
            / "tests"
            / "fixtures"
            / "xml_patch_scenarios"
            / scenario_id
            / family_id
        )
        scenario_file = scenario_dir / "scenario.json"
        if not scenario_file.exists():
            raise ValueError(f"PATCH scenario fixture {scenario_id!r} for family {family_id!r} was not found.")

        import json

        scenario = json.loads(scenario_file.read_text(encoding="utf-8"))
        generated_file = scenario.get("generated_patch_file")
        if not generated_file:
            raise ValueError(
                f"PATCH scenario fixture {scenario_id!r} for family {family_id!r} does not yet declare a generated PATCH XML file."
            )

        xml_path = scenario_dir / generated_file
        if not xml_path.exists():
            raise ValueError(f"Generated PATCH XML file {generated_file!r} was not found for scenario {scenario_id!r}.")

        baseline_fixture, manifest = self._load_patch_baseline_manifest(family_id=family_id)
        registered_device_anchor = self._registered_device_anchor_from_manifest(
            family_id=family_id,
            baseline_fixture=baseline_fixture,
            manifest=manifest,
        )
        self._validate_patch_scenario_identity(
            scenario=scenario,
            registered_device_anchor=registered_device_anchor,
            scenario_id=scenario_id,
        )

        xml_text = xml_path.read_text(encoding="utf-8")
        xml_bytes = xml_text.encode("utf-8")
        validation = self.xml_validation_service.validate_message(xml_bytes)
        return PatchScenarioXmlPreview(
            family_id=family_id,
            scenario_id=scenario_id,
            fixture_status=scenario.get("status", "unknown"),
            product_family=scenario.get("product_family"),
            product_variant=scenario.get("product_variant"),
            catalogue_number=scenario.get("catalogue_number") or manifest["catalogue_number"],
            primary_udi_di=manifest["primary_udi_di"],
            registered_device_anchor=registered_device_anchor,
            baseline_fixture=baseline_fixture,
            file_name=generated_file,
            xml=xml_text,
            validation=validation,
        )

    def download_patch_scenario_fixture(
        self,
        *,
        family_id: str,
        scenario_id: str,
    ) -> tuple[str, bytes]:
        preview = self.preview_patch_scenario_fixture(family_id=family_id, scenario_id=scenario_id)
        return preview.file_name, preview.xml.encode("utf-8")

    def _load_patch_baseline_manifest(self, *, family_id: str) -> tuple[str, dict]:
        baseline_fixture = f"equivalent_baseline/{family_id}"
        manifest_path = (
            self.project_root
            / "backend"
            / "tests"
            / "fixtures"
            / "xml_patch_scenarios"
            / baseline_fixture
            / "manifest.json"
        )
        if not manifest_path.exists():
            raise ValueError(f"Baseline manifest for fixture family {family_id!r} was not found.")

        import json

        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        return baseline_fixture, manifest

    def _registered_device_anchor_from_manifest(
        self,
        *,
        family_id: str,
        baseline_fixture: str,
        manifest: dict,
    ) -> RegisteredDeviceAnchor:
        return RegisteredDeviceAnchor(
            family_id=family_id,
            baseline_fixture=baseline_fixture,
            product_family=manifest["product_family"],
            product_variant=manifest["product_variant"],
            catalogue_number=manifest["catalogue_number"],
            primary_udi_di=manifest["primary_udi_di"],
            post_file_name=manifest["post_file_name"],
            patch_file_name=manifest["patch_file_name"],
            post_valid=bool(manifest.get("post_valid", False)),
            patch_valid=bool(manifest.get("patch_valid", False)),
            eudamed_status="EUDAMED Accepted",
        )

    def _validate_patch_scenario_identity(
        self,
        *,
        scenario: dict,
        registered_device_anchor: RegisteredDeviceAnchor,
        scenario_id: str,
    ) -> None:
        if scenario.get("baseline_fixture") != registered_device_anchor.baseline_fixture:
            raise ValueError(
                f"PATCH scenario fixture {scenario_id!r} is not anchored to baseline fixture "
                f"{registered_device_anchor.baseline_fixture!r}."
            )
        if scenario.get("product_family") != registered_device_anchor.product_family:
            raise ValueError(
                f"PATCH scenario fixture {scenario_id!r} does not match baseline product family "
                f"{registered_device_anchor.product_family!r}."
            )
        if scenario.get("product_variant") != registered_device_anchor.product_variant:
            raise ValueError(
                f"PATCH scenario fixture {scenario_id!r} does not match baseline product variant "
                f"{registered_device_anchor.product_variant!r}."
            )
        if scenario.get("catalogue_number") != registered_device_anchor.catalogue_number:
            raise ValueError(
                f"PATCH scenario fixture {scenario_id!r} does not match baseline catalogue number "
                f"{registered_device_anchor.catalogue_number!r}."
            )

    def _slugify_fixture_family_id(self, product_family: str, product_variant: str, catalogue_number: str) -> str:
        return "-".join(
            [
                product_family.strip().lower().replace(" ", "-"),
                product_variant.strip().lower().replace(" ", "-"),
                catalogue_number.strip(),
            ]
        )

    def download_post_patch_pair(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> tuple[str, bytes]:
        preview = self.preview_post_patch_pair(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        package_file_name = self.package_builder.post_patch_pair_package_file_name(
            product_family=preview.product_family or product_family,
            product_variant=preview.product_variant or product_variant,
            catalogue_number=preview.catalogue_number,
        )
        manifest = {
            "mode": preview.mode,
            "product_family": preview.product_family,
            "product_variant": preview.product_variant,
            "catalogue_number": preview.catalogue_number,
            "primary_udi_di": preview.primary_udi_di,
            "post_file_name": preview.post_file_name,
            "post_valid": preview.post_validation.valid,
            "patch_file_name": preview.patch_file_name,
            "patch_valid": preview.patch_validation.valid,
        }
        return self.package_builder.build_archive(
            package_file_name=package_file_name,
            members=[
                (preview.post_file_name, preview.post_xml.encode("utf-8")),
                (preview.patch_file_name, preview.patch_xml.encode("utf-8")),
            ],
            manifest=manifest,
        )

    def preview_batch(
        self,
        *,
        product_family: str,
        product_variant: str,
        chunk_sequence: int = 1,
    ) -> BatchXmlPreview:
        bundle = self.validation_service.build_validation_bundle()
        records = self.selector.xml_ready_variant_records(
            bundle.records,
            product_family=product_family,
            product_variant=product_variant,
        )
        if not records:
            raise ValueError(
                f"No XML-ready records are currently available for batch generation for "
                f"{product_family} / {product_variant}."
            )

        record_chunks = self.selector.chunk_records(records, self.settings.eudamed_max_batch_records)
        xml_chunks: list[tuple[int, list[CanonicalValidationRecord], bytes]] = []
        chunk_summaries: list[BatchXmlChunkSummary] = []
        total_chunks = len(record_chunks)
        for sequence, chunk_records in enumerate(record_chunks, start=1):
            xml_records = [self.projection_builder.build_device_record(record) for record in chunk_records]
            xml_bytes = self.renderer.render_message_records(xml_records)
            validation = self.xml_validation_service.validate_message(xml_bytes)
            file_name = self.package_builder.batch_file_name(
                product_family=product_family,
                product_variant=product_variant,
                sequence=sequence,
                total_chunks=total_chunks,
            )
            xml_chunks.append((sequence, chunk_records, xml_bytes))
            chunk_summaries.append(
                BatchXmlChunkSummary(
                    sequence=sequence,
                    file_name=file_name,
                    record_count=len(chunk_records),
                    first_catalogue_number=chunk_records[0].catalogue_number if chunk_records else None,
                    last_catalogue_number=chunk_records[-1].catalogue_number if chunk_records else None,
                    validation=validation,
                )
            )

        if chunk_sequence < 1 or chunk_sequence > total_chunks:
            raise ValueError(f"Batch chunk {chunk_sequence} is out of range. Valid chunks are 1 to {total_chunks}.")

        selected_sequence, selected_records, selected_xml_bytes = xml_chunks[chunk_sequence - 1]
        selected_summary = chunk_summaries[chunk_sequence - 1]
        variant_summary = next(
            (
                summary
                for summary in bundle.variant_summaries
                if summary.product_family == product_family and summary.product_variant == product_variant
            ),
            None,
        )
        excluded_records = variant_summary.xml_blocked_records if variant_summary else 0
        return BatchXmlPreview(
            product_family=product_family,
            product_variant=product_variant,
            submission_operation=records[0].submission_operation,
            package_file_name=self.package_builder.batch_package_file_name(
                product_family=product_family,
                product_variant=product_variant,
            ),
            total_ready_records=len(records),
            excluded_records=excluded_records,
            max_records_per_file=self.settings.eudamed_max_batch_records,
            chunk_count=total_chunks,
            selected_chunk_sequence=selected_sequence,
            selected_chunk_file_name=selected_summary.file_name,
            selected_chunk_record_count=len(selected_records),
            selected_chunk_xml=selected_xml_bytes.decode("utf-8"),
            selected_chunk_validation=selected_summary.validation,
            chunks=chunk_summaries,
        )

    def download_batch(
        self,
        *,
        product_family: str,
        product_variant: str,
    ) -> tuple[str, bytes]:
        bundle = self.validation_service.build_validation_bundle()
        records = self.selector.xml_ready_variant_records(
            bundle.records,
            product_family=product_family,
            product_variant=product_variant,
        )
        if not records:
            raise ValueError(
                f"No XML-ready records are currently available for batch generation for "
                f"{product_family} / {product_variant}."
            )

        record_chunks = self.selector.chunk_records(records, self.settings.eudamed_max_batch_records)
        package_file_name = self.package_builder.batch_package_file_name(
            product_family=product_family,
            product_variant=product_variant,
        )
        variant_summary = next(
            (
                summary
                for summary in bundle.variant_summaries
                if summary.product_family == product_family and summary.product_variant == product_variant
            ),
            None,
        )
        excluded_records = variant_summary.xml_blocked_records if variant_summary else 0

        members: list[tuple[str, bytes]] = []
        manifest_chunks = []
        total_chunks = len(record_chunks)
        for sequence, chunk_records in enumerate(record_chunks, start=1):
            file_name = self.package_builder.batch_file_name(
                product_family=product_family,
                product_variant=product_variant,
                sequence=sequence,
                total_chunks=total_chunks,
            )
            xml_records = [self.projection_builder.build_device_record(record) for record in chunk_records]
            xml_bytes = self.renderer.render_message_records(xml_records)
            validation = self.xml_validation_service.validate_message(xml_bytes)
            members.append((file_name, xml_bytes))
            manifest_chunks.append(
                {
                    "sequence": sequence,
                    "file_name": file_name,
                    "record_count": len(chunk_records),
                    "first_catalogue_number": chunk_records[0].catalogue_number if chunk_records else None,
                    "last_catalogue_number": chunk_records[-1].catalogue_number if chunk_records else None,
                    "valid": validation.valid,
                    "error_count": len(validation.errors),
                }
            )

        manifest = {
            "package_file_name": package_file_name,
            "product_family": product_family,
            "product_variant": product_variant,
            "submission_operation": records[0].submission_operation,
            "total_ready_records": len(records),
            "excluded_records": excluded_records,
            "max_records_per_file": self.settings.eudamed_max_batch_records,
            "chunk_count": len(record_chunks),
            "chunks": manifest_chunks,
        }
        return self.package_builder.build_archive(
            package_file_name=package_file_name,
            members=members,
            manifest=manifest,
        )

    @staticmethod
    def _normalized_operation(submission_operation: str | None) -> str:
        return (submission_operation or "POST").upper()
