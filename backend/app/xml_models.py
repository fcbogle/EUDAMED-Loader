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


class EchelonXmlRecord(BaseModel):
    catalogue_number: str
    trade_name: str | None = None
    primary_udi_di: str
    issuing_entity: str
    language_code: str
    basic_udi_di: str
    basic_identifier_code: str
    basic_identifier_issuing_entity: str
    device_identifier_code: str
    device_identifier_issuing_entity: str
    risk_class: str
    model: str | None = None
    model_name: str
    manufacturer_srn: str
    authorised_representative_srn: str | None = None
    human_tissues_cells: bool
    animal_tissues_cells: bool
    human_product_check: bool
    medicinal_product_check: bool
    basic_device_type: str
    active: bool
    administering_medicine: bool
    implantable: bool
    measuring_function: bool
    reusable: bool
    nomenclature_codes: list[str] = Field(default_factory=list)
    status_code: str
    production_identifier: str | None = None
    reference_number: str
    secondary_identifier_code: str | None = None
    secondary_identifier_issuing_entity: str | None = None
    sterile: bool
    sterilization: bool
    number_of_reuses: int
    contains_latex: bool
    reprocessed: bool
    first_eu_market_country: str | None = None
    base_quantity: int | None = None
    storage_conditions: list[StorageConditionXmlItem] = Field(default_factory=list)
    critical_warnings: list[CriticalWarningXmlItem] = Field(default_factory=list)


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
