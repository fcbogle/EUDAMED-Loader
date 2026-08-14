from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class XmlValidationIssue(BaseModel):
    level: Literal["error", "warning"] = "error"
    line: int | None = None
    column: int | None = None
    message: str


class XmlValidationResult(BaseModel):
    valid: bool
    schema_path: str
    errors: list[XmlValidationIssue] = Field(default_factory=list)


class StorageConditionXmlItem(BaseModel):
    code: str
    comment: str | None = None


class CriticalWarningXmlItem(BaseModel):
    code: str
    comment: str | None = None


class SingleRecordXmlPreview(BaseModel):
    mode: Literal["single"] = "single"
    product_family: str | None = None
    product_variant: str | None = None
    submission_operation: str | None = None
    catalogue_number: str
    trade_name: str | None = None
    primary_udi_di: str
    file_name: str
    xml: str
    validation: XmlValidationResult


class RegisteredDeviceAnchor(BaseModel):
    product_family: str
    product_variant: str
    catalogue_number: str
    primary_udi_di: str
    post_file_name: str
    patch_file_name: str
    post_valid: bool
    patch_valid: bool
    eudamed_status: str


class PostRegistrationPreview(BaseModel):
    mode: Literal["post_registration"] = "post_registration"
    product_family: str | None = None
    product_variant: str | None = None
    catalogue_number: str
    primary_udi_di: str
    registered_device_anchor: RegisteredDeviceAnchor
    latest_successful_patch_state: PatchStateSnapshot | None = None
    latest_successful_patch_scenario_id: str | None = None
    post_file_name: str
    post_xml: str
    post_validation: XmlValidationResult


class MarketInfoPutPreview(BaseModel):
    mode: Literal["market_info_put"] = "market_info_put"
    product_family: str | None = None
    product_variant: str | None = None
    catalogue_number: str
    primary_udi_di: str
    registered_device_anchor: RegisteredDeviceAnchor
    file_name: str
    xml: str
    validation: XmlValidationResult


class PatchScenarioFieldDelta(BaseModel):
    field_key: str
    label: str
    target_xpath_hint: str
    before_value: str | None = None
    after_value: str | None = None


class PatchScenarioContext(BaseModel):
    scenario_id: str
    scenario_label: str
    product_family: str
    product_variant: str
    catalogue_number: str
    primary_udi_di: str
    parent_post_version: str
    base_message_type: Literal["POST", "PATCH"]
    base_version: str
    proposed_patch_version: str
    base_state_source: str
    base_state_label: str


class PatchStateSnapshot(BaseModel):
    version: str
    trade_name: str | None = None
    base_quantity: int | None = None
    sterile: bool | None = None
    contains_latex: bool | None = None
    status_code: str | None = None
    storage_conditions: list[StorageConditionXmlItem] = Field(default_factory=list)
    critical_warnings: list[CriticalWarningXmlItem] = Field(default_factory=list)


class GeneratedPatchScenarioPreview(BaseModel):
    mode: Literal["generated_patch_scenario"] = "generated_patch_scenario"
    scenario_id: str
    scenario_label: str
    product_family: str
    product_variant: str
    catalogue_number: str
    primary_udi_di: str
    registered_device_anchor: RegisteredDeviceAnchor
    context: PatchScenarioContext
    field_deltas: list[PatchScenarioFieldDelta] = Field(default_factory=list)
    base_file_name: str
    base_xml: str
    base_validation: XmlValidationResult
    derived_patch_file_name: str
    derived_patch_xml: str
    derived_patch_validation: XmlValidationResult


class XmlGenerationSelectionSummary(BaseModel):
    product_family: str
    product_variant: str
    submission_operation: str | None = None
    total_records: int
    xml_ready_records: int
    xml_blocked_records: int


class XmlGenerationScopeBundle(BaseModel):
    family_scope: str
    scope_note: str
    total_xml_ready_records: int
    families: list[XmlGenerationSelectionSummary] = Field(default_factory=list)


class BatchXmlChunkSummary(BaseModel):
    sequence: int
    file_name: str
    record_count: int
    first_catalogue_number: str | None = None
    last_catalogue_number: str | None = None
    validation: XmlValidationResult


class BatchXmlPreview(BaseModel):
    mode: Literal["batch"] = "batch"
    product_family: str | None = None
    product_variant: str | None = None
    submission_operation: str | None = None
    package_file_name: str
    total_ready_records: int
    excluded_records: int
    max_records_per_file: int
    chunk_count: int
    selected_chunk_sequence: int
    selected_chunk_file_name: str
    selected_chunk_record_count: int
    selected_chunk_xml: str
    selected_chunk_validation: XmlValidationResult
    chunks: list[BatchXmlChunkSummary] = Field(default_factory=list)


class BulkXmlRecordSummary(BaseModel):
    catalogue_number: str
    primary_udi_di: str | None = None
    basic_udi_di: str | None = None
    trade_name: str | None = None
    source_workbook: str | None = None
    source_sheet: str | None = None
    source_row_index: int | None = None
    base_message_type: Literal["POST", "PATCH"] | None = None
    base_version: str | None = None
    derived_version: str | None = None
    accepted_state_source: str | None = None
    scenario_id: str | None = None


class BulkXmlExcludedRecord(BaseModel):
    catalogue_number: str | None = None
    primary_udi_di: str | None = None
    reason_code: str
    reason_message: str


class BulkPostPreview(BaseModel):
    mode: Literal["bulk_post"] = "bulk_post"
    product_family: str
    product_variant: str
    requested_record_count: int
    eligible_post_records: int
    included_record_count: int
    excluded_record_count: int
    package_file_name: str
    max_records_per_file: int
    chunk_count: int
    selected_chunk_sequence: int
    selected_chunk_file_name: str
    selected_chunk_record_count: int
    selected_chunk_xml: str
    selected_chunk_validation: XmlValidationResult
    included_records: list[BulkXmlRecordSummary] = Field(default_factory=list)
    excluded_records: list[BulkXmlExcludedRecord] = Field(default_factory=list)
    chunks: list[BatchXmlChunkSummary] = Field(default_factory=list)


class BulkUdidiPostPreview(BaseModel):
    mode: Literal["bulk_udidi_post"] = "bulk_udidi_post"
    product_family: str
    product_variant: str
    requested_record_count: int
    eligible_child_records: int
    included_record_count: int
    excluded_record_count: int
    package_file_name: str
    max_records_per_file: int
    chunk_count: int
    selected_chunk_sequence: int
    selected_chunk_file_name: str
    selected_chunk_record_count: int
    selected_chunk_xml: str
    selected_chunk_validation: XmlValidationResult
    included_records: list[BulkXmlRecordSummary] = Field(default_factory=list)
    excluded_records: list[BulkXmlExcludedRecord] = Field(default_factory=list)
    chunks: list[BatchXmlChunkSummary] = Field(default_factory=list)


class BulkPatchPreview(BaseModel):
    mode: Literal["bulk_patch"] = "bulk_patch"
    product_family: str
    product_variant: str
    selected_basic_udi_di: str
    requested_record_count: int
    eligible_child_records: int
    scenario_id: str
    scenario_label: str
    package_file_name: str
    max_records_per_file: int
    chunk_count: int
    selected_chunk_sequence: int
    selected_chunk_file_name: str
    selected_chunk_record_count: int
    selected_chunk_xml: str
    selected_chunk_validation: XmlValidationResult
    included_record_count: int
    excluded_record_count: int
    included_records: list[BulkXmlRecordSummary] = Field(default_factory=list)
    excluded_records: list[BulkXmlExcludedRecord] = Field(default_factory=list)
    chunks: list[BatchXmlChunkSummary] = Field(default_factory=list)
