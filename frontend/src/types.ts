export type WorkbookSummary = {
  workbook: string;
  sheet_count: number;
  total_rows: number;
  total_columns: number;
  sheets: string[];
  workbook_role: string;
  in_scope_for_variant_mapping: boolean;
  notes: string[];
};

export type ReferenceWorkbookSummary = {
  workbook: string;
  sheet_count: number;
  total_rows: number;
  total_columns: number;
  sheets: string[];
  workbook_role: string;
  source_status: string;
  notes: string[];
};

export type SheetSummary = {
  workbook: string;
  sheet: string;
  header_row: number | null;
  data_rows: number;
  populated_columns: number;
  max_columns: number;
  header_labels: string[];
};

export type ColumnProfile = {
  index: number;
  header: string;
  non_null_count: number;
  null_count: number;
  distinct_count: number;
  sample_values: string[];
};

export type SheetProfile = {
  workbook: string;
  sheet: string;
  header_row: number | null;
  data_rows: number;
  columns: ColumnProfile[];
};

export type DistinctValueItem = {
  raw_value: string;
  count: number;
  normalized_value: string | null;
  status: string;
};

export type DistinctValueProfile = {
  workbook: string | null;
  sheet: string | null;
  column: string;
  values: DistinctValueItem[];
};

export type NormalizationRule = {
  raw: string;
  normalized: string;
};

export type NormalizationRuleFile = {
  column: string;
  description: string;
  rules: NormalizationRule[];
};

export type ApplyNormalizationRulesResponse = {
  column: string;
  applied_rules: number;
  file_path: string;
};

export type SchemaFileSummary = {
  relative_path: string;
  category: string;
  size_bytes: number;
};

export type SchemaInventory = {
  root: string;
  total_files: number;
  device_files: SchemaFileSummary[];
  service_files: SchemaFileSummary[];
};

export type QmsDecision = {
  status: string;
  rationale: string | null;
  decided_by: string | null;
  decided_at: string | null;
};

export type SchemaAlignmentEntry = {
  schema_path: string;
  required: boolean;
  status: string;
  notes: string | null;
};

export type ValidationIssue = {
  severity: string;
  code: string;
  message: string;
  canonical_path: string;
};

export type CanonicalFieldMapping = {
  canonical_path: string;
  business_label: string;
  classification: string;
  source_columns: string[];
  normalized_by: string[];
  derivation_logic: string | null;
  assumptions: string[];
  schema_targets: SchemaAlignmentEntry[];
  example_source_values: string[];
  example_canonical_value: string | null;
};

export type CanonicalFieldReview = {
  mapping: CanonicalFieldMapping;
  decision: QmsDecision;
  validation_issues: ValidationIssue[];
};

export type CanonicalEntityReview = {
  entity_name: string;
  entity_path: string;
  qms_decision: QmsDecision;
  field_reviews: CanonicalFieldReview[];
  assumptions: string[];
};

export type CanonicalReviewBundle = {
  phase_assumptions: string[];
  entity_reviews: CanonicalEntityReview[];
  variant_mappings: VariantMappingSummary[];
};

export type VariantMappingSummary = {
  workbook: string;
  sheet: string;
  device_model: string | null;
  basic_udi_di: string | null;
  submission_operation: "POST" | "PATCH" | "PUT" | "GET" | null;
  source_version_marker: string | null;
  first_eu_market_country: string | null;
  available_market_country_count: number;
  match_status: "matched" | "excluded" | "unmatched";
  notes: string[];
};

export type CompletenessSnapshot = {
  mapped_required_fields: number;
  total_required_fields: number;
  missing_required_fields: number;
  status: string;
};

export type ValidationFieldValue = {
  canonical_path: string;
  business_label: string;
  required: boolean;
  before_value: string | null;
  after_value: string | null;
  before_source: string;
  after_source: string;
  source_detail: string | null;
  update_reason: string | null;
};

export type ExcludedSheetSummary = {
  sheet_name: string;
  record_count: number;
  reason: string;
};

export type BlockerSummary = {
  canonical_path: string;
  business_label: string;
  before_missing_count: number;
  after_missing_count: number;
};

export type SheetValidationSummary = {
  sheet_name: string;
  record_count: number;
  before_complete_records: number;
  after_complete_records: number;
  before_missing_field_total: number;
  after_missing_field_total: number;
};

export type SourceFieldCoverageSummary = {
  status: string;
  label: string;
  field_count: number;
};

export type SourceFieldCoverageEntry = {
  source_field: string;
  source_sheets: string[];
  coverage_status: string;
  canonical_targets: string[];
  schema_targets: string[];
  notes: string;
};

export type StructuredListItemPreview = {
  sequence: number;
  item_type: string | null;
  normalized_code: string | null;
  description: string | null;
  source_fields: string[];
};

export type EchelonValidationRecord = {
  source_workbook: string;
  source_sheet: string;
  source_row_index: number;
  trade_name: string | null;
  primary_udi_di: string | null;
  catalogue_number: string | null;
  issuing_entity: string | null;
  reference_match_status: string;
  basic_reference_material_number: string | null;
  basic_reference_name: string | null;
  before_completeness: CompletenessSnapshot;
  after_completeness: CompletenessSnapshot;
  before_blockers: string[];
  after_blockers: string[];
  storage_condition_items: StructuredListItemPreview[];
  critical_warning_items: StructuredListItemPreview[];
  fields: ValidationFieldValue[];
};

export type EchelonValidationBundle = {
  family_scope: string;
  scope_note: string;
  validation_note: string;
  source_workbook: string;
  total_source_records: number;
  validation_subset_records: number;
  excluded_records: number;
  matched_reference_records: number;
  tracked_required_fields: number;
  before_complete_records: number;
  after_complete_records: number;
  blocker_summaries: BlockerSummary[];
  sheet_summaries: SheetValidationSummary[];
  source_field_total: number;
  source_field_coverage_summaries: SourceFieldCoverageSummary[];
  source_field_coverage: SourceFieldCoverageEntry[];
  sample_records: EchelonValidationRecord[];
  excluded_sheet_summaries: ExcludedSheetSummary[];
  records: EchelonValidationRecord[];
};

export type CanonicalValidationFieldValue = {
  canonical_path: string;
  business_label: string;
  required: boolean;
  xml_required: boolean;
  value: string | null;
  source: string;
  source_detail: string | null;
  review_note: string | null;
};

export type MarketAvailabilityItemPreview = {
  sequence: number;
  country: string;
  original_placed_on_market: boolean;
};

export type CanonicalValidationRecord = {
  source_workbook: string;
  product_family: string;
  product_variant: string;
  source_sheet: string;
  source_row_index: number;
  trade_name: string | null;
  primary_udi_di: string | null;
  catalogue_number: string | null;
  issuing_entity: string | null;
  submission_operation: string | null;
  reference_match_status: string;
  completeness: CompletenessSnapshot;
  xml_readiness: CompletenessSnapshot;
  blockers: string[];
  xml_blockers: string[];
  storage_condition_items: StructuredListItemPreview[];
  critical_warning_items: StructuredListItemPreview[];
  market_availability_items: MarketAvailabilityItemPreview[];
  fields: CanonicalValidationFieldValue[];
};

export type ValidationBlockerSummary = {
  canonical_path: string;
  business_label: string;
  missing_count: number;
};

export type FamilyValidationSummary = {
  product_family: string;
  variant_count: number;
  total_records: number;
  ready_records: number;
  blocked_records: number;
  xml_ready_records: number;
  xml_blocked_records: number;
  post_records: number;
  patch_records: number;
};

export type VariantValidationSummary = {
  product_family: string;
  product_variant: string;
  source_workbook: string;
  source_sheet: string;
  submission_operation: string | null;
  total_records: number;
  ready_records: number;
  blocked_records: number;
  xml_ready_records: number;
  xml_blocked_records: number;
  missing_required_field_total: number;
  missing_xml_required_field_total: number;
  common_blockers: string[];
  common_xml_blockers: string[];
};

export type DeferredValidationScopeSummary = {
  workbook: string;
  sheet_name: string;
  record_count: number;
  reason: string;
};

export type CanonicalValidationBundle = {
  family_scope: string;
  scope_note: string;
  validation_note: string;
  total_source_records: number;
  validation_subset_records: number;
  excluded_records: number;
  matched_reference_records: number;
  tracked_required_fields: number;
  tracked_xml_required_fields: number;
  ready_records: number;
  blocked_records: number;
  xml_ready_records: number;
  xml_blocked_records: number;
  family_summaries: FamilyValidationSummary[];
  variant_summaries: VariantValidationSummary[];
  blocker_summaries: ValidationBlockerSummary[];
  source_field_total: number;
  source_field_coverage_summaries: SourceFieldCoverageSummary[];
  source_field_coverage: SourceFieldCoverageEntry[];
  sample_records: CanonicalValidationRecord[];
  deferred_scope_summaries: DeferredValidationScopeSummary[];
  records: CanonicalValidationRecord[];
};

export type XmlValidationIssue = {
  level: "error" | "warning";
  line: number | null;
  column: number | null;
  message: string;
};

export type XmlValidationResult = {
  valid: boolean;
  schema_path: string;
  errors: XmlValidationIssue[];
};

export type SingleRecordXmlPreview = {
  mode: "single";
  product_family: string | null;
  product_variant: string | null;
  submission_operation: string | null;
  catalogue_number: string;
  trade_name: string | null;
  primary_udi_di: string;
  file_name: string;
  xml: string;
  validation: XmlValidationResult;
};

export type XmlGenerationSelectionSummary = {
  product_family: string;
  product_variant: string;
  submission_operation: string | null;
  total_records: number;
  xml_ready_records: number;
  xml_blocked_records: number;
};

export type XmlGenerationScopeBundle = {
  family_scope: string;
  scope_note: string;
  total_xml_ready_records: number;
  families: XmlGenerationSelectionSummary[];
};

export type BatchXmlChunkSummary = {
  sequence: number;
  file_name: string;
  record_count: number;
  first_catalogue_number: string | null;
  last_catalogue_number: string | null;
  validation: XmlValidationResult;
};

export type BatchXmlPreview = {
  mode: "batch";
  product_family: string | null;
  product_variant: string | null;
  submission_operation: string | null;
  package_file_name: string;
  total_ready_records: number;
  excluded_records: number;
  max_records_per_file: number;
  chunk_count: number;
  selected_chunk_sequence: number;
  selected_chunk_file_name: string;
  selected_chunk_record_count: number;
  selected_chunk_xml: string;
  selected_chunk_validation: XmlValidationResult;
  chunks: BatchXmlChunkSummary[];
};
