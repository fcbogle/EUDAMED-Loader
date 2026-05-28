from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

CompletenessStatus = Literal["complete", "incomplete"]
MatchStatus = Literal["matched", "excluded", "unmatched"]
ValueSourceType = Literal[
    "workbook",
    "basic_udi_reference",
    "legacy_basic_udi_reference",
    "derived",
    "normalized",
    "missing",
]
SourceFieldCoverageStatus = Literal[
    "represented",
    "partially_represented",
    "not_yet_represented",
    "deferred_by_design",
]


class CompletenessSnapshot(BaseModel):
    mapped_required_fields: int
    total_required_fields: int
    missing_required_fields: int
    status: CompletenessStatus


class ValidationFieldValue(BaseModel):
    canonical_path: str
    business_label: str
    required: bool = True
    before_value: str | None = None
    after_value: str | None = None
    before_source: ValueSourceType
    after_source: ValueSourceType
    source_detail: str | None = None
    update_reason: str | None = None


class ExcludedSheetSummary(BaseModel):
    sheet_name: str
    record_count: int
    reason: str


class BlockerSummary(BaseModel):
    canonical_path: str
    business_label: str
    before_missing_count: int
    after_missing_count: int


class SheetValidationSummary(BaseModel):
    sheet_name: str
    record_count: int
    before_complete_records: int
    after_complete_records: int
    before_missing_field_total: int
    after_missing_field_total: int


class SourceFieldCoverageSummary(BaseModel):
    status: SourceFieldCoverageStatus
    label: str
    field_count: int


class SourceFieldCoverageEntry(BaseModel):
    source_field: str
    source_sheets: list[str] = Field(default_factory=list)
    coverage_status: SourceFieldCoverageStatus
    canonical_targets: list[str] = Field(default_factory=list)
    schema_targets: list[str] = Field(default_factory=list)
    notes: str


class StructuredListItemPreview(BaseModel):
    sequence: int
    item_type: str | None = None
    normalized_code: str | None = None
    description: str | None = None
    source_fields: list[str] = Field(default_factory=list)


class EchelonValidationRecord(BaseModel):
    source_workbook: str
    source_sheet: str
    source_row_index: int
    trade_name: str | None = None
    primary_udi_di: str | None = None
    catalogue_number: str | None = None
    issuing_entity: str | None = None
    reference_match_status: MatchStatus
    basic_reference_material_number: str | None = None
    basic_reference_name: str | None = None
    before_completeness: CompletenessSnapshot
    after_completeness: CompletenessSnapshot
    before_blockers: list[str] = Field(default_factory=list)
    after_blockers: list[str] = Field(default_factory=list)
    storage_condition_items: list[StructuredListItemPreview] = Field(default_factory=list)
    critical_warning_items: list[StructuredListItemPreview] = Field(default_factory=list)
    fields: list[ValidationFieldValue] = Field(default_factory=list)


class EchelonValidationBundle(BaseModel):
    family_scope: str
    scope_note: str
    validation_note: str
    source_workbook: str
    total_source_records: int
    validation_subset_records: int
    excluded_records: int
    matched_reference_records: int
    tracked_required_fields: int
    before_complete_records: int
    after_complete_records: int
    blocker_summaries: list[BlockerSummary] = Field(default_factory=list)
    sheet_summaries: list[SheetValidationSummary] = Field(default_factory=list)
    source_field_total: int = 0
    source_field_coverage_summaries: list[SourceFieldCoverageSummary] = Field(default_factory=list)
    source_field_coverage: list[SourceFieldCoverageEntry] = Field(default_factory=list)
    sample_records: list[EchelonValidationRecord] = Field(default_factory=list)
    excluded_sheet_summaries: list[ExcludedSheetSummary] = Field(default_factory=list)
    records: list[EchelonValidationRecord] = Field(default_factory=list)


class CanonicalValidationFieldValue(BaseModel):
    canonical_path: str
    business_label: str
    required: bool = True
    xml_required: bool = False
    value: str | None = None
    source: ValueSourceType
    source_detail: str | None = None
    review_note: str | None = None


class MarketAvailabilityItemPreview(BaseModel):
    sequence: int
    country: str
    original_placed_on_market: bool = False


class CanonicalValidationRecord(BaseModel):
    source_workbook: str
    product_family: str
    product_variant: str
    source_sheet: str
    source_row_index: int
    trade_name: str | None = None
    primary_udi_di: str | None = None
    catalogue_number: str | None = None
    issuing_entity: str | None = None
    submission_operation: str | None = None
    reference_match_status: MatchStatus
    completeness: CompletenessSnapshot
    xml_readiness: CompletenessSnapshot
    blockers: list[str] = Field(default_factory=list)
    xml_blockers: list[str] = Field(default_factory=list)
    storage_condition_items: list[StructuredListItemPreview] = Field(default_factory=list)
    critical_warning_items: list[StructuredListItemPreview] = Field(default_factory=list)
    market_availability_items: list[MarketAvailabilityItemPreview] = Field(default_factory=list)
    fields: list[CanonicalValidationFieldValue] = Field(default_factory=list)


class ValidationBlockerSummary(BaseModel):
    canonical_path: str
    business_label: str
    missing_count: int


class FamilyValidationSummary(BaseModel):
    product_family: str
    variant_count: int
    total_records: int
    ready_records: int
    blocked_records: int
    xml_ready_records: int
    xml_blocked_records: int
    post_records: int
    patch_records: int


class VariantValidationSummary(BaseModel):
    product_family: str
    product_variant: str
    source_workbook: str
    source_sheet: str
    submission_operation: str | None = None
    total_records: int
    ready_records: int
    blocked_records: int
    xml_ready_records: int
    xml_blocked_records: int
    missing_required_field_total: int
    missing_xml_required_field_total: int
    common_blockers: list[str] = Field(default_factory=list)
    common_xml_blockers: list[str] = Field(default_factory=list)


class DeferredValidationScopeSummary(BaseModel):
    workbook: str
    sheet_name: str
    record_count: int
    reason: str


class CanonicalValidationBundle(BaseModel):
    family_scope: str
    scope_note: str
    validation_note: str
    total_source_records: int
    validation_subset_records: int
    excluded_records: int
    matched_reference_records: int
    tracked_required_fields: int
    tracked_xml_required_fields: int
    ready_records: int
    blocked_records: int
    xml_ready_records: int
    xml_blocked_records: int
    family_summaries: list[FamilyValidationSummary] = Field(default_factory=list)
    variant_summaries: list[VariantValidationSummary] = Field(default_factory=list)
    blocker_summaries: list[ValidationBlockerSummary] = Field(default_factory=list)
    source_field_total: int = 0
    source_field_coverage_summaries: list[SourceFieldCoverageSummary] = Field(default_factory=list)
    source_field_coverage: list[SourceFieldCoverageEntry] = Field(default_factory=list)
    sample_records: list[CanonicalValidationRecord] = Field(default_factory=list)
    deferred_scope_summaries: list[DeferredValidationScopeSummary] = Field(default_factory=list)
    records: list[CanonicalValidationRecord] = Field(default_factory=list)
