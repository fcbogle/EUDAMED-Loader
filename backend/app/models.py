from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field


class FileInventoryItem(BaseModel):
    name: str
    path: Path
    size_bytes: int


class WorkbookSummary(BaseModel):
    workbook: str
    sheet_count: int
    total_rows: int
    total_columns: int
    sheets: list[str]
    workbook_role: str = "source_excel"
    in_scope_for_variant_mapping: bool = True
    notes: list[str] = Field(default_factory=list)


class ReferenceWorkbookSummary(BaseModel):
    workbook: str
    sheet_count: int
    total_rows: int
    total_columns: int
    sheets: list[str]
    workbook_role: str = "basic_udi_reference"
    source_status: str
    notes: list[str] = Field(default_factory=list)


class SheetSummary(BaseModel):
    workbook: str
    sheet: str
    header_row: int | None
    data_rows: int
    populated_columns: int
    max_columns: int
    header_labels: list[str]


class ColumnProfile(BaseModel):
    index: int
    header: str
    non_null_count: int
    null_count: int
    distinct_count: int
    sample_values: list[str]


class SheetProfile(BaseModel):
    workbook: str
    sheet: str
    header_row: int | None
    data_rows: int
    columns: list[ColumnProfile]


class DistinctValueItem(BaseModel):
    raw_value: str
    count: int
    normalized_value: str | None = None
    status: str = "unmapped"


class DistinctValueProfile(BaseModel):
    workbook: str | None = None
    sheet: str | None = None
    column: str
    values: list[DistinctValueItem]


class NormalizationRule(BaseModel):
    raw: str
    normalized: str


class NormalizationRuleFile(BaseModel):
    column: str
    description: str
    rules: list[NormalizationRule] = Field(default_factory=list)


class ApplyNormalizationRulesRequest(BaseModel):
    column: str
    rules: list[NormalizationRule] = Field(default_factory=list)


class ApplyNormalizationRulesResponse(BaseModel):
    column: str
    applied_rules: int
    file_path: Path


class SchemaFileSummary(BaseModel):
    relative_path: str
    category: str
    size_bytes: int


class SchemaInventory(BaseModel):
    root: Path
    total_files: int
    device_files: list[SchemaFileSummary]
    service_files: list[SchemaFileSummary]


class WorkbookImportRunRequest(BaseModel):
    imported_by: str | None = None
    label: str | None = None
    notes: str | None = None


class WorkbookImportRunResponse(BaseModel):
    import_batch_id: int
    source_type: str
    label: str
    imported_at: str
    workbook_count: int
    source_row_count: int
    device_subject_count: int


class WorkbookImportBatchSummary(BaseModel):
    import_batch_id: int
    source_type: str
    label: str
    imported_at: str
    imported_by: str | None = None
    notes: str | None = None
    workbook_count: int
    source_row_count: int
    device_subject_count: int


class ImportedWorkbookSummary(BaseModel):
    source_workbook_id: int
    import_batch_id: int
    workbook_name: str
    file_path: str
    file_hash: str
    loaded_at: str
    row_count: int


class WorkbookImportTableCount(BaseModel):
    table_name: str
    row_count: int
    summary_label: str


class WorkbookImportOperationCount(BaseModel):
    submission_operation: str
    device_subject_count: int


class WorkbookImportDuplicateGroup(BaseModel):
    subject_key: str
    source_row_count: int
    product_family: str | None = None
    product_variant: str | None = None
    catalogue_number: str | None = None
    primary_udi_di: str | None = None
    workbook_names: list[str] = Field(default_factory=list)
    sheet_names: list[str] = Field(default_factory=list)
    row_indexes: list[int] = Field(default_factory=list)


WorkbookImportProjectionStatus = Literal["ready", "stale", "missing"]


class WorkbookImportSnapshotSummary(BaseModel):
    import_batch: WorkbookImportBatchSummary
    imported_workbooks: list[ImportedWorkbookSummary] = Field(default_factory=list)
    table_counts: list[WorkbookImportTableCount] = Field(default_factory=list)
    operation_counts: list[WorkbookImportOperationCount] = Field(default_factory=list)
    canonical_projection_status: WorkbookImportProjectionStatus = "missing"
    canonical_projection_import_batch_id: int | None = None
    duplicate_source_row_delta: int = 0
    merged_source_row_count: int = 0
    duplicate_subject_count: int = 0
    workbook_duplicate_row_count: int = 0
    workbook_duplicate_group_count: int = 0
    unresolved_identity_row_count: int = 0
    top_duplicate_groups: list[WorkbookImportDuplicateGroup] = Field(default_factory=list)


class DatabaseColumnSummary(BaseModel):
    name: str
    data_type: str
    nullable: bool
    primary_key_position: int = 0


class DatabaseForeignKeySummary(BaseModel):
    from_column: str
    target_table: str
    target_column: str
    on_delete: str


class DatabaseIndexSummary(BaseModel):
    name: str
    unique: bool
    columns: list[str] = Field(default_factory=list)


class DatabaseTableSchemaSummary(BaseModel):
    table_name: str
    row_count: int
    columns: list[DatabaseColumnSummary] = Field(default_factory=list)
    foreign_keys: list[DatabaseForeignKeySummary] = Field(default_factory=list)
    indexes: list[DatabaseIndexSummary] = Field(default_factory=list)


class DatabaseSchemaSummary(BaseModel):
    db_path: str
    table_count: int
    tables: list[DatabaseTableSchemaSummary] = Field(default_factory=list)


class DatabaseHealthIssue(BaseModel):
    level: str
    code: str
    message: str
    table_name: str | None = None


class DatabaseTableHealthSummary(BaseModel):
    table_name: str
    row_count: int
    orphan_count: int
    identity_gap_count: int


class DatabaseHealthSummary(BaseModel):
    db_path: str
    generated_at: str
    table_summaries: list[DatabaseTableHealthSummary] = Field(default_factory=list)
    issues: list[DatabaseHealthIssue] = Field(default_factory=list)


class WorkbookImportWorkbookDiff(BaseModel):
    workbook_name: str
    change_type: str
    previous_row_count: int | None = None
    current_row_count: int | None = None
    previous_hash: str | None = None
    current_hash: str | None = None


class WorkbookImportDiffSummary(BaseModel):
    current_import_batch_id: int
    previous_import_batch_id: int | None = None
    current_label: str
    previous_label: str | None = None
    source_row_delta: int
    device_subject_delta: int
    workbook_count_delta: int
    changed_workbooks: list[WorkbookImportWorkbookDiff] = Field(default_factory=list)


class DeviceSubjectSummary(BaseModel):
    id: int
    subject_key: str
    product_family: str | None = None
    product_variant: str | None = None
    catalogue_number: str | None = None
    primary_udi_di: str | None = None
    basic_udi_di: str | None = None
    current_source_row_id: int | None = None
    current_import_batch_id: int | None = None
    created_at: str
    updated_at: str


class DeviceSubjectDetail(DeviceSubjectSummary):
    current_source_workbook_name: str | None = None
    current_source_sheet_name: str | None = None
    current_source_row_index: int | None = None


class SourceRowSummary(BaseModel):
    id: int
    source_workbook_id: int
    import_batch_id: int
    workbook_name: str
    sheet_name: str
    row_index: int
    product_family: str | None = None
    product_variant: str | None = None
    catalogue_number: str | None = None
    primary_udi_di: str | None = None
    submission_operation: str | None = None
    canonical_status: str | None = None
    created_at: str


class SourceRowDetail(SourceRowSummary):
    raw_payload_json: str
    linked_device_subject_id: int | None = None
    linked_device_subject_key: str | None = None


class DeviceIdentityIssueSummary(BaseModel):
    id: int
    source_row_id: int
    device_subject_id: int | None = None
    issue_code: str
    severity: str
    created_at: str
    product_family: str | None = None
    product_variant: str | None = None
    catalogue_number: str | None = None
    primary_udi_di: str | None = None
    import_batch_id: int | None = None


class DeviceIdentityIssueDetail(DeviceIdentityIssueSummary):
    details_json: dict[str, Any] = Field(default_factory=dict)
    resolved_at: str | None = None
    resolution_note: str | None = None


class TestingWorkspaceSummary(BaseModel):
    product_family: str | None = None
    product_variant: str | None = None
    subject_count: int
    linked_device_subject_count: int
    reviewed_post_count: int
    successful_device_post_count: int
    successful_child_post_count: int
    successful_patch_count: int
    baseline_patch_success_count: int
    posted_parent_group_count: int
    latest_tested_at: str | None = None


class TestingSubjectReadModelSummary(BaseModel):
    id: int
    device_subject_id: int | None = None
    product_family: str | None = None
    product_variant: str | None = None
    catalogue_number: str | None = None
    primary_udi_di: str | None = None
    basic_udi_di: str | None = None
    post_success: bool = False
    baseline_patch_success: bool = False
    has_successful_device_post: bool = False
    has_successful_child_post_or_patch: bool = False
    latest_successful_version: str | None = None
    latest_tested_at: str | None = None
    reviewed_post_at: str | None = None
    event_count: int = 0


class TestingEventSummary(BaseModel):
    id: int
    event_index: int
    message_type: str | None = None
    status: str | None = None
    version: str | None = None
    scenario_id: str | None = None
    scenario_label: str | None = None
    tested_at: str | None = None
    transaction_id: str | None = None
    submission_id: str | None = None
    correlation_id: str | None = None
    message_id: str | None = None
    changed_fields: list[Any] = Field(default_factory=list)
    retained_fields: list[Any] = Field(default_factory=list)
    unchanged_fields: list[Any] = Field(default_factory=list)


class TestingSubjectHistory(BaseModel):
    subject: TestingSubjectReadModelSummary
    events: list[TestingEventSummary] = Field(default_factory=list)


class SuccessXmlUploadResult(BaseModel):
    summary_message: str
    message_type: Literal["DEVICE.POST", "UDI_DI.POST", "UDI_DI.PATCH"]
    operation_label: Literal["Basic UDI-DI POST", "Device UDI-DI POST", "Device UDI-DI PATCH"]
    entity_code: str
    product_family: str | None = None
    product_variant: str | None = None
    catalogue_number: str | None = None
    primary_udi_di: str | None = None
    basic_udi_di: str | None = None
    tested_at: str | None = None
    correlation_id: str | None = None
    message_id: str | None = None
    source_file_name: str | None = None
    subject_id: int
    created_subject: bool = False
    recorded_event: bool = False
    duplicate_event: bool = False


class SuccessXmlUploadRequest(BaseModel):
    file_name: str | None = None
    xml_content: str


OperationAssessmentType = Literal["single_post", "single_patch", "bulk_post", "bulk_patch"]
OperationAssessmentStatus = Literal["available", "blocked", "attention"]


class OperationAssessmentRequest(BaseModel):
    product_family: str
    product_variant: str


class SinglePostAssessmentRequest(OperationAssessmentRequest):
    catalogue_number: str | None = None


class SinglePatchAssessmentRequest(OperationAssessmentRequest):
    catalogue_number: str | None = None


class BulkPostAssessmentRequest(OperationAssessmentRequest):
    pass


class BulkPatchAssessmentRequest(OperationAssessmentRequest):
    basic_udi_di: str | None = None


class OperationAssessmentIdentityScope(BaseModel):
    product_family: str
    product_variant: str
    catalogue_number: str | None = None
    basic_udi_di: str | None = None


class OperationAssessment(BaseModel):
    operation_type: OperationAssessmentType
    status: OperationAssessmentStatus
    summary_message: str
    blocking_reasons: list[str] = Field(default_factory=list)
    recommended_next_action: str | None = None
    eligible_record_count: int = 0
    identity_scope: OperationAssessmentIdentityScope
    evidence: dict[str, Any] = Field(default_factory=dict)
