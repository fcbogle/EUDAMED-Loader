from __future__ import annotations

"""
Canonical domain models for the EUDAMED preparation workspace.

Current QMS-aligned first-phase scope:
- MDR devices only
- UDI-DI device details and market information only
- Basic UDI records already exist outside this load and are treated as context
- UDIDIType.xsd is the primary schema focus for the first upload phase
"""

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
SubmissionOperation = Literal["POST", "PATCH", "PUT", "GET"]
VariantMatchStatus = Literal["matched", "excluded", "unmatched"]


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
    """Manufacturer and issuer context needed to support device-level UDI-DI records."""

    issuing_entity: str | None = None
    manufacturer_srn: str | None = None
    designed_by_another_legal_entity: bool | None = None
    source_refs: list[SourceReference] = Field(default_factory=list)


class BasicDevice(BaseModel):
    """Basic UDI context retained for linkage and audit, not the primary first-phase upload object."""

    basic_udi_di: str | None = None
    regulation: str = "MDR"
    device_model: str | None = None
    device_type: str | None = None
    special_device_type: str | None = None
    nomenclature_code: str | None = None
    intended_purpose_summary: str | None = None
    annex_xvi_other_purpose: bool | None = None
    clinical_investigation: bool | None = None
    risk_class: str | None = None
    implantable: bool | None = None
    measuring_function: bool | None = None
    reusable_surgical_instrument: bool | None = None
    active: bool | None = None
    administering_medicinal_product: bool | None = None
    device_model_applicable: bool | None = None
    additional_information_url: str | None = None
    submission_operation: SubmissionOperation | None = None
    source_version_marker: str | None = None
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
    country: str | None = None
    market_status: str | None = None
    first_eu_market_country: str | None = None
    original_placed_on_market: bool | None = None
    start_date: str | None = None
    end_date: str | None = None
    source_refs: list[SourceReference] = Field(default_factory=list)


class DeviceRecord(BaseModel):
    """Primary first-phase canonical entity for MDR UDI-DI upload preparation."""

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
    market_availabilities: list[MarketAvailability] = Field(default_factory=list)
    normalization_log: list[NormalizationEvidence] = Field(default_factory=list)
    source_refs: list[SourceReference] = Field(default_factory=list)


class ValidationIssue(BaseModel):
    severity: ValidationSeverity
    code: str
    message: str
    canonical_path: str
    source_ref: SourceReference | None = None


class CanonicalDeviceBundle(BaseModel):
    """Combined canonical view used for review before mapping and XML work proceeds."""

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
    """Reviewable field-level mapping metadata, including assumptions and schema alignment."""

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


class VariantMappingSummary(BaseModel):
    workbook: str
    sheet: str
    device_model: str | None = None
    basic_udi_di: str | None = None
    submission_operation: SubmissionOperation | None = None
    source_version_marker: str | None = None
    first_eu_market_country: str | None = None
    available_market_country_count: int = 0
    match_status: VariantMatchStatus
    notes: list[str] = Field(default_factory=list)


class CanonicalReviewBundle(BaseModel):
    """Top-level review bundle for canonical design and QMS decisions."""

    phase_assumptions: list[str] = Field(default_factory=list)
    device_bundle: CanonicalDeviceBundle
    entity_reviews: list[CanonicalEntityReview] = Field(default_factory=list)
    variant_mappings: list[VariantMappingSummary] = Field(default_factory=list)
