from __future__ import annotations

from pathlib import Path

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


class WorkbookImportSnapshotSummary(BaseModel):
    import_batch: WorkbookImportBatchSummary
    imported_workbooks: list[ImportedWorkbookSummary] = Field(default_factory=list)
    table_counts: list[WorkbookImportTableCount] = Field(default_factory=list)
    operation_counts: list[WorkbookImportOperationCount] = Field(default_factory=list)
    duplicate_source_row_delta: int
    duplicate_subject_count: int
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
