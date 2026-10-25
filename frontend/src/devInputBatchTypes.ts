export type DevBatch = {
  batch_id: string; error?: string; environment?: string; created_at?: string; manufacturer_srn?: string; file_integrity?: string;
  files?: { name: string; role: string; size_bytes: number; sha256: string; source_modified_at: string; excluded: boolean }[];
};
export type DevBatchInspection = {
  batch_id: string; inspection_complete: boolean; inspection_token: string | null; errors: string[];
  requested_inspection_scope?: { distinct_device_identities: number; rows_with_findings: number; duplicate_identity_occurrences: number; excluded_workbook_names: string[]; finding_counts: Record<string, number>; in_exports: number; export_only: number };
  templates?: { rows_with_findings: number; finding_counts: Record<string, number> };
  exports?: { device_records: number; finding_counts: Record<string, number> };
};
export type DevPreparedWorkbook = {
  batch_id: string; artifact_id: string; created_at: string; workbook_name: string; audit_name: string;
  workbook_sha256: string; audit_sha256: string; summary: Record<string, number | Record<string, number>>;
  excluded_workbooks: string[]; database_changed: boolean;
  review_examples: { key: string; catalogue: string; device_type: string; reasons: string[] }[];
};
export type DevBatchContext = { batchId: string; valid: boolean; checked: boolean; prepared: boolean };

export type PlaygroundAssessment = {
  batch_id: string; report_id: string; assessed_at: string; read_only: boolean;
  summary: { devices: number; parents: number; outcomes: Record<string, number>; field_comparisons: Record<string, number>; full_local_snapshots: number; partial_local_snapshots: number; missing_local_snapshots: number };
  review_markers: { current_count: number; note: string }; limitations: string[];
  records: { issuer: string; udi_di: string; catalogue: string; model: string; outcome: string; local_snapshot: string; warnings: string[];
    fields: { group: string; field: string; comparison: string; local: unknown; exported: unknown; local_evidence: string }[] }[];
};
