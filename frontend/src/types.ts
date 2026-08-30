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

export type MarketCountryReferenceEntry = {
  name: string;
  code: string;
  aliases: string[];
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

export type WorkbookImportRunResponse = {
  import_batch_id: number;
  source_type: string;
  label: string;
  imported_at: string;
  workbook_count: number;
  source_row_count: number;
  device_subject_count: number;
};

export type WorkbookImportBatchSummary = {
  import_batch_id: number;
  source_type: string;
  label: string;
  imported_at: string;
  imported_by: string | null;
  notes: string | null;
  workbook_count: number;
  source_row_count: number;
  device_subject_count: number;
};

export type ImportedWorkbookSummary = {
  source_workbook_id: number;
  import_batch_id: number;
  workbook_name: string;
  file_path: string;
  file_hash: string;
  loaded_at: string;
  row_count: number;
};

export type WorkbookImportTableCount = {
  table_name: string;
  row_count: number;
  summary_label: string;
};

export type WorkbookImportOperationCount = {
  submission_operation: string;
  device_subject_count: number;
};

export type WorkbookImportDuplicateGroup = {
  subject_key: string;
  source_row_count: number;
  product_family: string | null;
  product_variant: string | null;
  catalogue_number: string | null;
  primary_udi_di: string | null;
  workbook_names: string[];
  sheet_names: string[];
  row_indexes: number[];
};

export type WorkbookImportSnapshotSummary = {
  import_batch: WorkbookImportBatchSummary;
  imported_workbooks: ImportedWorkbookSummary[];
  table_counts: WorkbookImportTableCount[];
  operation_counts: WorkbookImportOperationCount[];
  canonical_projection_status: "ready" | "stale" | "missing";
  canonical_projection_import_batch_id: number | null;
  duplicate_source_row_delta: number;
  merged_source_row_count: number;
  duplicate_subject_count: number;
  workbook_duplicate_row_count: number;
  workbook_duplicate_group_count: number;
  unresolved_identity_row_count: number;
  top_duplicate_groups: WorkbookImportDuplicateGroup[];
};

export type DatabaseColumnSummary = {
  name: string;
  data_type: string;
  nullable: boolean;
  primary_key_position: number;
};

export type DatabaseForeignKeySummary = {
  from_column: string;
  target_table: string;
  target_column: string;
  on_delete: string;
};

export type DatabaseIndexSummary = {
  name: string;
  unique: boolean;
  columns: string[];
};

export type DatabaseTableSchemaSummary = {
  table_name: string;
  row_count: number;
  columns: DatabaseColumnSummary[];
  foreign_keys: DatabaseForeignKeySummary[];
  indexes: DatabaseIndexSummary[];
};

export type DatabaseSchemaSummary = {
  db_path: string;
  table_count: number;
  tables: DatabaseTableSchemaSummary[];
};

export type DatabaseHealthIssue = {
  level: string;
  code: string;
  message: string;
  table_name: string | null;
};

export type DatabaseTableHealthSummary = {
  table_name: string;
  row_count: number;
  orphan_count: number;
  identity_gap_count: number;
};

export type DatabaseHealthSummary = {
  db_path: string;
  generated_at: string;
  table_summaries: DatabaseTableHealthSummary[];
  issues: DatabaseHealthIssue[];
};

export type WorkbookImportWorkbookDiff = {
  workbook_name: string;
  change_type: string;
  previous_row_count: number | null;
  current_row_count: number | null;
  previous_hash: string | null;
  current_hash: string | null;
};

export type WorkbookImportDiffSummary = {
  current_import_batch_id: number;
  previous_import_batch_id: number | null;
  current_label: string;
  previous_label: string | null;
  source_row_delta: number;
  device_subject_delta: number;
  workbook_count_delta: number;
  changed_workbooks: WorkbookImportWorkbookDiff[];
};

export type DeviceSubjectSummary = {
  id: number;
  subject_key: string;
  product_family: string | null;
  product_variant: string | null;
  catalogue_number: string | null;
  primary_udi_di: string | null;
  basic_udi_di: string | null;
  current_source_row_id: number | null;
  current_import_batch_id: number | null;
  created_at: string;
  updated_at: string;
};

export type DeviceSubjectDetail = DeviceSubjectSummary & {
  current_source_workbook_name: string | null;
  current_source_sheet_name: string | null;
  current_source_row_index: number | null;
};

export type SourceRowSummary = {
  id: number;
  source_workbook_id: number;
  import_batch_id: number;
  workbook_name: string;
  sheet_name: string;
  row_index: number;
  product_family: string | null;
  product_variant: string | null;
  catalogue_number: string | null;
  primary_udi_di: string | null;
  submission_operation: string | null;
  canonical_status: string | null;
  created_at: string;
};

export type SourceRowDetail = SourceRowSummary & {
  raw_payload_json: string;
  linked_device_subject_id: number | null;
  linked_device_subject_key: string | null;
};

export type DeviceIdentityIssueSummary = {
  id: number;
  source_row_id: number;
  device_subject_id: number | null;
  issue_code: string;
  severity: string;
  created_at: string;
  product_family: string | null;
  product_variant: string | null;
  catalogue_number: string | null;
  primary_udi_di: string | null;
  import_batch_id: number | null;
};

export type DeviceIdentityIssueDetail = DeviceIdentityIssueSummary & {
  details_json: Record<string, unknown>;
  resolved_at: string | null;
  resolution_note: string | null;
};

export type CriticalWarningCodeOption = {
  code: string;
  description: string;
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
  persistence_source: "sqlite_projection";
  projection_status: "ready" | "rebuilt";
  source_import_batch_id: number | null;
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

export type PostRegistrationPreview = {
  mode: "post_registration";
  product_family: string | null;
  product_variant: string | null;
  catalogue_number: string;
  primary_udi_di: string;
  registered_device_anchor: RegisteredDeviceAnchor;
  latest_successful_patch_state: PatchStateSnapshot | null;
  latest_successful_patch_scenario_id: string | null;
  post_file_name: string;
  post_xml: string;
  post_validation: XmlValidationResult;
};

export type PatchStateSnapshot = {
  version: string;
  trade_name: string | null;
  base_quantity: number | null;
  sterile: boolean | null;
  contains_latex: boolean | null;
  status_code: string | null;
  storage_conditions: Array<{ code: string; comment: string | null }>;
  critical_warnings: Array<{ code: string; comment: string | null }>;
};

export type MarketInfoPutPreview = {
  mode: "market_info_put";
  product_family: string | null;
  product_variant: string | null;
  catalogue_number: string;
  primary_udi_di: string;
  market_info_version: string;
  registered_device_anchor: RegisteredDeviceAnchor;
  file_name: string;
  xml: string;
  validation: XmlValidationResult;
};

export type RegisteredDeviceAnchor = {
  product_family: string;
  product_variant: string;
  catalogue_number: string;
  primary_udi_di: string;
  post_file_name: string;
  patch_file_name: string;
  post_valid: boolean;
  patch_valid: boolean;
  eudamed_status: string;
};

export type PatchScenarioFieldDelta = {
  field_key: string;
  label: string;
  target_xpath_hint: string;
  before_value: string | null;
  after_value: string | null;
};

export type PatchScenarioContext = {
  scenario_id: string;
  scenario_label: string;
  product_family: string;
  product_variant: string;
  catalogue_number: string;
  primary_udi_di: string;
  parent_post_version: string;
  base_message_type: "POST" | "PATCH";
  base_version: string;
  proposed_patch_version: string;
  base_state_source: string;
  base_state_label: string;
};

export type GeneratedPatchScenarioPreview = {
  mode: "generated_patch_scenario";
  scenario_id: string;
  scenario_label: string;
  product_family: string;
  product_variant: string;
  catalogue_number: string;
  primary_udi_di: string;
  registered_device_anchor: RegisteredDeviceAnchor;
  context: PatchScenarioContext;
  field_deltas: PatchScenarioFieldDelta[];
  base_file_name: string;
  base_xml: string;
  base_validation: XmlValidationResult;
  derived_patch_file_name: string;
  derived_patch_xml: string;
  derived_patch_validation: XmlValidationResult;
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

export type OperationAssessmentType =
  | "single_post"
  | "single_patch"
  | "single_market_info"
  | "bulk_post"
  | "bulk_patch"
  | "bulk_market_info";
export type OperationAssessmentStatus = "available" | "blocked" | "attention";

export type OperationAssessmentIdentityScope = {
  product_family: string;
  product_variant: string;
  catalogue_number: string | null;
  basic_udi_di: string | null;
};

export type OperationAssessment = {
  operation_type: OperationAssessmentType;
  status: OperationAssessmentStatus;
  summary_message: string;
  blocking_reasons: string[];
  recommended_next_action: string | null;
  eligible_record_count: number;
  identity_scope: OperationAssessmentIdentityScope;
  evidence: Record<string, unknown>;
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

export type BulkXmlRecordSummary = {
  catalogue_number: string;
  primary_udi_di: string | null;
  basic_udi_di: string | null;
  trade_name: string | null;
  source_workbook: string | null;
  source_sheet: string | null;
  source_row_index: number | null;
  base_message_type: "POST" | "PATCH" | null;
  base_version: string | null;
  derived_version: string | null;
  accepted_state_source: string | null;
  scenario_id: string | null;
};

export type BulkXmlExcludedRecord = {
  catalogue_number: string | null;
  primary_udi_di: string | null;
  reason_code: string;
  reason_message: string;
};

export type BulkPostPreview = {
  mode: "bulk_post";
  product_family: string;
  product_variant: string;
  requested_record_count: number;
  eligible_post_records: number;
  included_record_count: number;
  excluded_record_count: number;
  package_file_name: string;
  max_records_per_file: number;
  chunk_count: number;
  selected_chunk_sequence: number;
  selected_chunk_file_name: string;
  selected_chunk_record_count: number;
  selected_chunk_xml: string;
  selected_chunk_validation: XmlValidationResult;
  included_records: BulkXmlRecordSummary[];
  excluded_records: BulkXmlExcludedRecord[];
  chunks: BatchXmlChunkSummary[];
};

export type BulkUdidiPostPreview = {
  mode: "bulk_udidi_post";
  product_family: string;
  product_variant: string;
  requested_record_count: number;
  eligible_child_records: number;
  included_record_count: number;
  excluded_record_count: number;
  package_file_name: string;
  max_records_per_file: number;
  chunk_count: number;
  selected_chunk_sequence: number;
  selected_chunk_file_name: string;
  selected_chunk_record_count: number;
  selected_chunk_xml: string;
  selected_chunk_validation: XmlValidationResult;
  included_records: BulkXmlRecordSummary[];
  excluded_records: BulkXmlExcludedRecord[];
  chunks: BatchXmlChunkSummary[];
};

export type BulkPatchPreview = {
  mode: "bulk_patch";
  product_family: string;
  product_variant: string;
  selected_basic_udi_di: string;
  requested_record_count: number;
  eligible_child_records: number;
  scenario_id: string;
  scenario_label: string;
  package_file_name: string;
  max_records_per_file: number;
  chunk_count: number;
  selected_chunk_sequence: number;
  selected_chunk_file_name: string;
  selected_chunk_record_count: number;
  selected_chunk_xml: string;
  selected_chunk_validation: XmlValidationResult;
  included_record_count: number;
  excluded_record_count: number;
  included_records: BulkXmlRecordSummary[];
  excluded_records: BulkXmlExcludedRecord[];
  chunks: BatchXmlChunkSummary[];
};

export type BulkMarketInfoPreview = {
  mode: "bulk_market_info";
  product_family: string;
  product_variant: string;
  selected_basic_udi_di: string;
  requested_record_count: number;
  eligible_child_records: number;
  package_file_name: string;
  max_records_per_file: number;
  chunk_count: number;
  selected_chunk_sequence: number;
  selected_chunk_file_name: string;
  selected_chunk_record_count: number;
  selected_chunk_xml: string;
  selected_chunk_validation: XmlValidationResult;
  included_record_count: number;
  excluded_record_count: number;
  included_records: BulkXmlRecordSummary[];
  excluded_records: BulkXmlExcludedRecord[];
  chunks: BatchXmlChunkSummary[];
};

export type BulkPatchPostedEntry = {
  catalogue_number: string | null;
  primary_udi_di: string | null;
  basic_udi_di: string | null;
  latest_version: string | null;
  latest_market_info_version?: string | null;
  baseline_patch_success: boolean;
};

export type BulkPatchPostedEntriesResponse = {
  product_family: string;
  product_variant: string;
  basic_udi_di: string;
  entries: BulkPatchPostedEntry[];
};

export type BulkPatchPostedParentGroup = {
  basic_udi_di: string;
  posted_child_count: number;
  sample_catalogue_numbers: string[];
};

export type BulkPatchPostedParentsResponse = {
  product_family: string;
  product_variant: string;
  parents: BulkPatchPostedParentGroup[];
};

export type TestingWorkspaceSummary = {
  product_family: string | null;
  product_variant: string | null;
  subject_count: number;
  linked_device_subject_count: number;
  reviewed_post_count: number;
  successful_device_post_count: number;
  successful_child_post_count: number;
  successful_patch_count: number;
  baseline_patch_success_count: number;
  posted_parent_group_count: number;
  latest_tested_at: string | null;
};

export type TestingEventReadModelEntry = {
  id: number;
  subject_id: number;
  product_family: string | null;
  product_variant: string | null;
  catalogue_number: string | null;
  primary_udi_di: string | null;
  basic_udi_di: string | null;
  message_type: string | null;
  status: string | null;
  version: string | null;
  scenario_id: string | null;
  scenario_label: string | null;
  tested_at: string | null;
  transaction_id: string | null;
  submission_id: string | null;
  correlation_id: string | null;
  message_id: string | null;
  details_summary: string | null;
  added_countries: string[];
  removed_countries: string[];
  original_market_before: string | null;
  original_market_after: string | null;
};

export type TestingSubjectReadModelSummary = {
  id: number;
  device_subject_id: number | null;
  product_family: string | null;
  product_variant: string | null;
  catalogue_number: string | null;
  primary_udi_di: string | null;
  basic_udi_di: string | null;
  post_success: boolean;
  baseline_patch_success: boolean;
  has_successful_device_post: boolean;
  has_successful_child_post_or_patch: boolean;
  latest_successful_version: string | null;
  latest_successful_market_info_version: string | null;
  latest_successful_market_info_state: {
    version?: string;
    market_countries?: Array<{
      country: string;
      original_placed_on_market: boolean;
    }>;
  } | null;
  latest_success_message_type: string | null;
  latest_tested_at: string | null;
  reviewed_post_at: string | null;
  event_count: number;
};

export type SuccessXmlUploadResult = {
  summary_message: string;
  message_type: "DEVICE.POST" | "UDI_DI.POST" | "UDI_DI.PATCH" | "MARKET_INFO.PUT";
  operation_label: "Basic UDI-DI POST" | "Device UDI-DI POST" | "Device UDI-DI PATCH" | "Market Info PUT";
  entity_code: string;
  product_family: string | null;
  product_variant: string | null;
  catalogue_number: string | null;
  primary_udi_di: string | null;
  basic_udi_di: string | null;
  tested_at: string | null;
  correlation_id: string | null;
  message_id: string | null;
  source_file_name: string | null;
  subject_id: number;
  created_subject: boolean;
  recorded_event: boolean;
  duplicate_event: boolean;
  entity_count?: number;
  recorded_event_count?: number;
  duplicate_event_count?: number;
  created_subject_count?: number;
};
