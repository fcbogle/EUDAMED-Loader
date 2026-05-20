from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

MappingClassification = Literal["direct", "normalized", "derived", "repeated", "gap"]
QmsDecisionStatus = Literal[
    "proposed",
    "accepted",
    "accepted_with_note",
    "needs_clarification",
    "rejected",
    "out_of_scope",
]
ValidationSeverity = Literal["info", "warning", "error", "critical"]


class SourceReference(BaseModel):
    workbook: str
    sheet: str
    row_index: int | None = None
    source_column: str | None = None


class NormalizationEvidence(BaseModel):
    source_field: str
    raw_value: str
    normalized_value: str
    rule_file: str | None = None


class Manufacturer(BaseModel):
    issuing_entity: str | None = None
    manufacturer_srn: str | None = None
    designed_by_another_legal_entity: bool | None = None
    source_refs: list[SourceReference] = Field(default_factory=list)


class BasicDevice(BaseModel):
    basic_udi_di: str | None = None
    regulation: str = "MDR"
    nomenclature_code: str | None = None
    intended_purpose_summary: str | None = None
    annex_xvi_other_purpose: bool | None = None
    clinical_investigation: bool | None = None
    source_refs: list[SourceReference] = Field(default_factory=list)


class StorageCondition(BaseModel):
    condition_type: str | None = None
    description: str | None = None
    sequence: int | None = None
    source_refs: list[SourceReference] = Field(default_factory=list)


class CriticalWarning(BaseModel):
    warning_type: str | None = None
    description: str | None = None
    source_refs: list[SourceReference] = Field(default_factory=list)


class MarketAvailability(BaseModel):
    market_status: str | None = None
    first_eu_market_country: str | None = None
    source_refs: list[SourceReference] = Field(default_factory=list)


class DeviceRecord(BaseModel):
    basic_device_ref: str | None = None
    primary_udi_di: str | None = None
    catalogue_number: str | None = None
    secondary_udi_di_applicable: bool | None = None
    trade_name: str | None = None
    language: str | None = None
    quantity: int | None = None
    direct_marking: bool | None = None
    udi_pi_type: str | None = None
    clinical_size_applicable: bool | None = None
    single_use: bool | None = None
    max_reuses_applicable: bool | None = None
    sterilisation_before_use: bool | None = None
    sterile: bool | None = None
    contains_latex: bool | None = None
    cmr_present: bool | None = None
    endocrine_disruptor_present: bool | None = None
    reprocessed_single_use: bool | None = None
    human_tissue_present: bool | None = None
    animal_tissue_present: bool | None = None
    medicinal_substance_present: bool | None = None
    blood_plasma_derivative_present: bool | None = None
    storage_conditions: list[StorageCondition] = Field(default_factory=list)
    warnings: list[CriticalWarning] = Field(default_factory=list)
    market_availability: MarketAvailability | None = None
    normalization_log: list[NormalizationEvidence] = Field(default_factory=list)
    source_refs: list[SourceReference] = Field(default_factory=list)


class ValidationIssue(BaseModel):
    severity: ValidationSeverity
    code: str
    message: str
    canonical_path: str
    source_ref: SourceReference | None = None


class CanonicalDeviceBundle(BaseModel):
    manufacturer: Manufacturer
    basic_device: BasicDevice
    device_record: DeviceRecord
    validation_issues: list[ValidationIssue] = Field(default_factory=list)


class SchemaAlignmentEntry(BaseModel):
    schema_path: str
    required: bool = False
    status: MappingClassification
    notes: str | None = None


class CanonicalFieldMapping(BaseModel):
    canonical_path: str
    business_label: str
    classification: MappingClassification
    source_columns: list[str] = Field(default_factory=list)
    normalized_by: list[str] = Field(default_factory=list)
    derivation_logic: str | None = None
    assumptions: list[str] = Field(default_factory=list)
    schema_targets: list[SchemaAlignmentEntry] = Field(default_factory=list)
    example_source_values: list[str] = Field(default_factory=list)
    example_canonical_value: str | None = None


class QmsDecision(BaseModel):
    status: QmsDecisionStatus = "proposed"
    rationale: str | None = None
    decided_by: str | None = None
    decided_at: str | None = None


class CanonicalFieldReview(BaseModel):
    mapping: CanonicalFieldMapping
    decision: QmsDecision = Field(default_factory=QmsDecision)
    validation_issues: list[ValidationIssue] = Field(default_factory=list)


class CanonicalEntityReview(BaseModel):
    entity_name: str
    entity_path: str
    qms_decision: QmsDecision = Field(default_factory=QmsDecision)
    field_reviews: list[CanonicalFieldReview] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)


class CanonicalReviewBundle(BaseModel):
    device_bundle: CanonicalDeviceBundle
    entity_reviews: list[CanonicalEntityReview] = Field(default_factory=list)
