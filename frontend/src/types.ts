export type WorkbookSummary = {
  workbook: string;
  sheet_count: number;
  total_rows: number;
  total_columns: number;
  sheets: string[];
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
};
