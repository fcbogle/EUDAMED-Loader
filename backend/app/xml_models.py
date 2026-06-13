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


class EquivalentPatchPairPreview(BaseModel):
    mode: Literal["post_patch_pair"] = "post_patch_pair"
    product_family: str | None = None
    product_variant: str | None = None
    catalogue_number: str
    primary_udi_di: str
    post_file_name: str
    post_xml: str
    post_validation: XmlValidationResult
    patch_file_name: str
    patch_xml: str
    patch_validation: XmlValidationResult


class MarketInfoPutPreview(BaseModel):
    mode: Literal["market_info_put"] = "market_info_put"
    product_family: str | None = None
    product_variant: str | None = None
    catalogue_number: str
    primary_udi_di: str
    file_name: str
    xml: str
    validation: XmlValidationResult


class PatchScenarioXmlPreview(BaseModel):
    mode: Literal["patch_scenario"] = "patch_scenario"
    family_id: str
    scenario_id: str
    fixture_status: str
    product_family: str | None = None
    product_variant: str | None = None
    catalogue_number: str
    primary_udi_di: str
    baseline_fixture: str
    file_name: str
    xml: str
    validation: XmlValidationResult


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
