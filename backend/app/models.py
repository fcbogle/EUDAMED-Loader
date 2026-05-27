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
