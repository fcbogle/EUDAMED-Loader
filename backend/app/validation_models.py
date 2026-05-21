from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

CompletenessStatus = Literal["complete", "incomplete"]
MatchStatus = Literal["matched", "excluded"]
ValueSourceType = Literal["workbook", "basic_udi_reference", "derived", "missing"]


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
    excluded_sheet_summaries: list[ExcludedSheetSummary] = Field(default_factory=list)
    records: list[EchelonValidationRecord] = Field(default_factory=list)
