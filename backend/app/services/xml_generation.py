from __future__ import annotations

from typing import Any

from app.config import get_settings
from app.services.canonical_validation import CanonicalValidationService
from app.services.xml_packaging import XmlPackageBuilder
from app.services.xml_projection import DeviceXmlProjectionBuilder
from app.services.xml_rendering import EudamedMessageRenderer
from app.services.xml_selection import ValidationRecordSelector
from app.services.testing_state_store import TestingStateStore
from app.services.xml_validation import XmlValidationService
from app.validation_models import CanonicalValidationRecord
from app.xml_models import (
    BatchXmlChunkSummary,
    BatchXmlPreview,
    GeneratedPatchScenarioPreview,
    MarketInfoPutPreview,
    PatchScenarioContext,
    PatchScenarioFieldDelta,
    PostRegistrationPreview,
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
        self.testing_state_store = TestingStateStore()

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

    def preview_generated_patch_scenario(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
        scenario_id: str,
        patch_version: str,
        scenario_inputs: dict[str, Any] | None = None,
    ) -> GeneratedPatchScenarioPreview:
        scenario_data = scenario_inputs or {}
        post_source_record = self.selector.find_post_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        post_record = self.projection_builder.build_device_record(post_source_record)
        patch_state_resolution = self.testing_state_store.latest_successful_patch_state(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        normalized_version = self._validate_patch_version(patch_version)
        registered_device_anchor = self._registered_device_anchor(post_record)

        if normalized_version == "2":
            scenario_base_record = post_record
            base_message_type = "POST"
            base_version = "1"
            base_state_source = "accepted_post"
            base_state_label = "Accepted POST version 1"
        else:
            if not patch_state_resolution:
                raise ValueError(
                    "PATCH versions above 2 require a tracked latest successful PATCH state for this device."
                )
            scenario_base_record = self.projection_builder.build_patch_record_from_state(
                post_record,
                patch_state_resolution.state,
            )
            base_message_type = "PATCH"
            base_version = patch_state_resolution.state.version
            base_state_source = patch_state_resolution.source
            base_state_label = f"Latest successful PATCH version {patch_state_resolution.state.version}"

        base_xml_bytes = self.renderer.render_message(scenario_base_record)
        base_validation = self.xml_validation_service.validate_message(base_xml_bytes)

        derived_patch_record, scenario_label, field_deltas = self._build_generated_patch_scenario(
            post_record=post_record,
            scenario_base_record=scenario_base_record,
            base_message_type=base_message_type,
            scenario_id=scenario_id,
            patch_version=normalized_version,
            scenario_inputs=scenario_data,
        )
        derived_patch_xml_bytes = self.renderer.render_message(derived_patch_record)
        derived_patch_validation = self.xml_validation_service.validate_message(derived_patch_xml_bytes)
        derived_patch_file_name = self._scenario_patch_file_name(
            product_family=post_record.product_family,
            product_variant=post_record.product_variant,
            catalogue_number=post_record.catalogue_number,
            scenario_id=scenario_id,
        )

        return GeneratedPatchScenarioPreview(
            scenario_id=scenario_id,
            scenario_label=scenario_label,
            product_family=post_record.product_family,
            product_variant=post_record.product_variant,
            catalogue_number=post_record.catalogue_number,
            primary_udi_di=post_record.primary_udi_di,
            registered_device_anchor=registered_device_anchor,
            context=PatchScenarioContext(
                scenario_id=scenario_id,
                scenario_label=scenario_label,
                product_family=post_record.product_family,
                product_variant=post_record.product_variant,
                catalogue_number=post_record.catalogue_number,
                primary_udi_di=post_record.primary_udi_di,
                parent_post_version="1",
                base_message_type=base_message_type,
                base_version=base_version,
                proposed_patch_version=normalized_version,
                base_state_source=base_state_source,
                base_state_label=base_state_label,
            ),
            field_deltas=field_deltas,
            base_file_name=(
                registered_device_anchor.post_file_name
                if base_message_type == "POST"
                else registered_device_anchor.patch_file_name
            ),
            base_xml=base_xml_bytes.decode("utf-8"),
            base_validation=base_validation,
            derived_patch_file_name=derived_patch_file_name,
            derived_patch_xml=derived_patch_xml_bytes.decode("utf-8"),
            derived_patch_validation=derived_patch_validation,
        )

    def download_generated_patch_scenario(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
        scenario_id: str,
        patch_version: str,
        scenario_inputs: dict[str, Any] | None = None,
    ) -> tuple[str, bytes]:
        preview = self.preview_generated_patch_scenario(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
            scenario_id=scenario_id,
            patch_version=patch_version,
            scenario_inputs=scenario_inputs,
        )
        package_file_name = self.package_builder.scenario_package_file_name(
            product_family=preview.product_family or product_family,
            product_variant=preview.product_variant or product_variant,
            scenario_id=preview.scenario_id,
            catalogue_number=preview.catalogue_number,
        )
        manifest = {
            "mode": preview.mode,
            "message_type": "UDI_DI.PATCH",
            "scenario_id": preview.scenario_id,
            "scenario_label": preview.scenario_label,
            "product_family": preview.product_family,
            "product_variant": preview.product_variant,
            "catalogue_number": preview.catalogue_number,
            "primary_udi_di": preview.primary_udi_di,
            "base_file_name": preview.base_file_name,
            "derived_patch_file_name": preview.derived_patch_file_name,
            "base_message_type": preview.context.base_message_type,
            "base_version": preview.context.base_version,
            "proposed_patch_version": preview.context.proposed_patch_version,
            "valid": preview.derived_patch_validation.valid,
        }
        return self.package_builder.build_archive(
            package_file_name=package_file_name,
            members=[(preview.derived_patch_file_name, preview.derived_patch_xml.encode("utf-8"))],
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

    def preview_post_registration(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> PostRegistrationPreview:
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
        patch_state_resolution = self.testing_state_store.latest_successful_patch_state(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=post_record.catalogue_number,
        )
        post_xml_bytes = self.renderer.render_message(post_record)
        post_file_name = self.package_builder.operation_file_name(
            product_family=record.product_family,
            product_variant=record.product_variant,
            operation="POST",
            catalogue_number=post_record.catalogue_number,
        )
        registered_device_anchor = self._registered_device_anchor(post_record)
        return PostRegistrationPreview(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=post_record.catalogue_number,
            primary_udi_di=post_record.primary_udi_di,
            registered_device_anchor=registered_device_anchor,
            latest_successful_patch_state=patch_state_resolution.state if patch_state_resolution else None,
            post_file_name=post_file_name,
            post_xml=post_xml_bytes.decode("utf-8"),
            post_validation=self.xml_validation_service.validate_message(post_xml_bytes),
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
        return MarketInfoPutPreview(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=market_info_record.catalogue_number,
            primary_udi_di=market_info_record.primary_udi_di,
            registered_device_anchor=RegisteredDeviceAnchor(
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

    def _registered_device_anchor(
        self,
        post_record,
    ) -> RegisteredDeviceAnchor:
        return RegisteredDeviceAnchor(
            product_family=post_record.product_family,
            product_variant=post_record.product_variant,
            catalogue_number=post_record.catalogue_number,
            primary_udi_di=post_record.primary_udi_di,
            post_file_name=self.package_builder.operation_file_name(
                product_family=post_record.product_family,
                product_variant=post_record.product_variant,
                operation="POST",
                catalogue_number=post_record.catalogue_number,
            ),
            patch_file_name=self.package_builder.operation_file_name(
                product_family=post_record.product_family,
                product_variant=post_record.product_variant,
                operation="PATCH",
                catalogue_number=post_record.catalogue_number,
            ),
            post_valid=True,
            patch_valid=True,
            eudamed_status="EUDAMED Accepted",
        )

    def _build_generated_patch_scenario(
        self,
        *,
        post_record,
        scenario_base_record,
        base_message_type: str,
        scenario_id: str,
        patch_version: str,
        scenario_inputs: dict[str, Any],
    ) -> tuple[Any, str, list[PatchScenarioFieldDelta]]:
        if scenario_id == "equivalent_first_patch":
            if patch_version != "2":
                raise ValueError("equivalent_first_patch must use patch_version 2.")
            derived_record = self.projection_builder.build_equivalent_first_patch(post_record)
            return (
                derived_record,
                "Equivalent First Patch",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value="1",
                        after_value="2",
                    ),
                ],
            )
        if scenario_id == "trade_name_edit":
            new_trade_name = self._required_string_input(scenario_inputs, "new_trade_name")
            derived_record = self.projection_builder.build_trade_name_edit_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                new_trade_name=new_trade_name,
                patch_version=patch_version,
            )
            return (
                derived_record,
                "Trade Name Edit",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                        after_value=patch_version,
                    ),
                    PatchScenarioFieldDelta(
                        field_key="trade_name",
                        label="Trade Name",
                        target_xpath_hint="udidi:tradeNames/lsn:name/lsn:textValue",
                        before_value=scenario_base_record.trade_name,
                        after_value=new_trade_name,
                    ),
                ],
            )
        if scenario_id == "warning_add":
            new_warning_code = self._required_string_input(scenario_inputs, "new_warning_code")
            new_warning_comment = self._optional_string_input(scenario_inputs, "new_warning_comment")
            derived_record = self.projection_builder.build_warning_add_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                new_warning_code=new_warning_code,
                new_warning_comment=new_warning_comment,
                patch_version=patch_version,
            )
            return (
                derived_record,
                "Critical Warnings",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                        after_value=patch_version,
                    ),
                    PatchScenarioFieldDelta(
                        field_key="critical_warning_replace",
                        label="Critical Warning",
                        target_xpath_hint="udidi:criticalWarnings/commondi:warning",
                        before_value=", ".join(item.code for item in scenario_base_record.critical_warnings) or "None",
                        after_value=(
                            f"{new_warning_code} ({new_warning_comment})"
                            if new_warning_comment
                            else new_warning_code
                        ),
                    ),
                ],
            )
        if scenario_id == "storage_condition_edit":
            raw_updates = scenario_inputs.get("updated_conditions")
            if not isinstance(raw_updates, list) or not raw_updates:
                raise ValueError("updated_conditions must contain at least one condition update.")
            condition_updates: dict[str, str] = {}
            for item in raw_updates:
                if not isinstance(item, dict):
                    raise ValueError("Each updated_conditions item must be an object.")
                code = self._required_string_input(item, "condition_code")
                replacement_comment = self._required_string_input(item, "replacement_comment")
                condition_updates[code] = replacement_comment
            baseline_by_code = {item.code: item.comment for item in scenario_base_record.storage_conditions}
            missing_codes = sorted(code for code in condition_updates if code not in baseline_by_code)
            if missing_codes:
                raise ValueError(
                    f"Unknown storage condition codes for scenario editing: {', '.join(missing_codes)}."
                )
            derived_record = self.projection_builder.build_storage_condition_edit_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                condition_updates=condition_updates,
                patch_version=patch_version,
            )
            field_deltas = [
                PatchScenarioFieldDelta(
                    field_key="patch_version",
                    label="PATCH Version",
                    target_xpath_hint="e:version",
                    before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                    after_value=patch_version,
                )
            ]
            for code, replacement_comment in condition_updates.items():
                field_deltas.append(
                    PatchScenarioFieldDelta(
                        field_key=f"storage_condition_{code}",
                        label=f"Storage Condition {code}",
                        target_xpath_hint="udidi:storageHandlingConditions/commondi:condition/commondi:comments/lsn:name/lsn:textValue",
                        before_value=baseline_by_code.get(code),
                        after_value=replacement_comment,
                    )
                )
            return derived_record, "Storage Condition Edit", field_deltas
        if scenario_id == "base_quantity_edit":
            new_base_quantity = self._required_positive_int_input(scenario_inputs, "new_base_quantity")
            derived_record = self.projection_builder.build_base_quantity_edit_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                new_base_quantity=new_base_quantity,
                patch_version=patch_version,
            )
            return (
                derived_record,
                "Base Quantity",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                        after_value=patch_version,
                    ),
                    PatchScenarioFieldDelta(
                        field_key="base_quantity",
                        label="Base Quantity",
                        target_xpath_hint="udidi:baseQuantity",
                        before_value=self._stringify_optional(scenario_base_record.base_quantity),
                        after_value=str(new_base_quantity),
                    ),
                ],
            )
        if scenario_id == "sterile_edit":
            new_sterile = self._required_bool_input(scenario_inputs, "new_sterile")
            derived_record = self.projection_builder.build_sterile_edit_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                new_sterile=new_sterile,
                patch_version=patch_version,
            )
            return (
                derived_record,
                "Sterile",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                        after_value=patch_version,
                    ),
                    PatchScenarioFieldDelta(
                        field_key="sterile",
                        label="Sterile",
                        target_xpath_hint="udidi:sterile",
                        before_value=self._bool_label(scenario_base_record.sterile),
                        after_value=self._bool_label(new_sterile),
                    ),
                ],
            )
        if scenario_id == "latex_edit":
            new_contains_latex = self._required_bool_input(scenario_inputs, "new_contains_latex")
            derived_record = self.projection_builder.build_latex_edit_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                new_contains_latex=new_contains_latex,
                patch_version=patch_version,
            )
            return (
                derived_record,
                "Latex",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                        after_value=patch_version,
                    ),
                    PatchScenarioFieldDelta(
                        field_key="latex",
                        label="Latex",
                        target_xpath_hint="udidi:latex",
                        before_value=self._bool_label(scenario_base_record.contains_latex),
                        after_value=self._bool_label(new_contains_latex),
                    ),
                ],
            )
        if scenario_id == "status_code_edit":
            new_status_code = self._required_choice_input(
                scenario_inputs,
                "new_status_code",
                {
                    "NOT_INTENDED_FOR_EU_MARKET",
                    "ON_THE_MARKET",
                    "NO_LONGER_PLACED_ON_THE_MARKET",
                },
            )
            derived_record = self.projection_builder.build_status_code_edit_patch(
                self._patch_edit_base_record(post_record, scenario_base_record, base_message_type),
                new_status_code=new_status_code,
                patch_version=patch_version,
            )
            return (
                derived_record,
                "Status Code",
                [
                    PatchScenarioFieldDelta(
                        field_key="patch_version",
                        label="PATCH Version",
                        target_xpath_hint="e:version",
                        before_value=self._scenario_before_version(base_message_type, scenario_base_record),
                        after_value=patch_version,
                    ),
                    PatchScenarioFieldDelta(
                        field_key="status_code",
                        label="Status Code",
                        target_xpath_hint="udidi:status/commondi:code",
                        before_value=scenario_base_record.status_code,
                        after_value=new_status_code,
                    ),
                ],
            )
        raise ValueError(f"Unsupported generated PATCH scenario {scenario_id!r}.")

    @staticmethod
    def _validate_patch_version(patch_version: str) -> str:
        normalized = str(patch_version).strip()
        if not normalized:
            raise ValueError("patch_version is required.")
        try:
            parsed = int(normalized)
        except ValueError as exc:
            raise ValueError("patch_version must be an integer.") from exc
        if parsed < 2:
            raise ValueError("patch_version must be an integer greater than or equal to 2.")
        return str(parsed)

    def _patch_edit_base_record(self, post_record, scenario_base_record, base_message_type: str):
        if base_message_type == "POST":
            return self.projection_builder.build_equivalent_first_patch(post_record)
        return scenario_base_record

    @staticmethod
    def _scenario_before_version(base_message_type: str, scenario_base_record) -> str:
        if base_message_type == "POST":
            return "1"
        return scenario_base_record.patch_version_override or "2"

    @staticmethod
    def _required_string_input(payload: dict[str, Any], key: str) -> str:
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{key} is required.")
        return value.strip()

    @staticmethod
    def _optional_string_input(payload: dict[str, Any], key: str) -> str | None:
        value = payload.get(key)
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError(f"{key} must be a string when provided.")
        normalized = value.strip()
        return normalized or None

    @staticmethod
    def _required_positive_int_input(payload: dict[str, Any], key: str) -> int:
        value = payload.get(key)
        if isinstance(value, bool):
            raise ValueError(f"{key} must be a positive integer.")
        if not isinstance(value, (int, str)):
            raise ValueError(f"{key} must be a positive integer.")
        try:
            parsed = int(value)
        except ValueError as exc:
            raise ValueError(f"{key} must be a positive integer.") from exc
        if parsed <= 0:
            raise ValueError(f"{key} must be a positive integer.")
        return parsed

    @staticmethod
    def _required_bool_input(payload: dict[str, Any], key: str) -> bool:
        value = payload.get(key)
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized == "true":
                return True
            if normalized == "false":
                return False
        raise ValueError(f"{key} must be true or false.")

    @staticmethod
    def _required_choice_input(payload: dict[str, Any], key: str, allowed: set[str]) -> str:
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{key} is required.")
        normalized = value.strip()
        if normalized not in allowed:
            raise ValueError(f"{key} must be one of: {', '.join(sorted(allowed))}.")
        return normalized

    @staticmethod
    def _bool_label(value: bool) -> str:
        return "true" if value else "false"

    @staticmethod
    def _stringify_optional(value: object) -> str | None:
        if value is None:
            return None
        return str(value)

    def _scenario_patch_file_name(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
        scenario_id: str,
    ) -> str:
        return (
            f"{self.package_builder._slugify(product_family)}-"
            f"{self.package_builder._slugify(product_variant)}-"
            f"patch-{scenario_id.replace('_', '-')}-"
            f"{self.package_builder._safe_catalogue_number(catalogue_number)}.xml"
        )

    def download_post_package(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> tuple[str, bytes]:
        preview = self.preview_post_registration(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        package_file_name = self.package_builder.operation_package_file_name(
            product_family=preview.product_family or product_family,
            product_variant=preview.product_variant or product_variant,
            operation="POST",
            catalogue_number=preview.catalogue_number,
        )
        manifest = {
            "mode": preview.mode,
            "message_type": "DEVICE.POST",
            "product_family": preview.product_family,
            "product_variant": preview.product_variant,
            "catalogue_number": preview.catalogue_number,
            "primary_udi_di": preview.primary_udi_di,
            "file_name": preview.post_file_name,
            "valid": preview.post_validation.valid,
        }
        return self.package_builder.build_archive(
            package_file_name=package_file_name,
            members=[(preview.post_file_name, preview.post_xml.encode("utf-8"))],
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
