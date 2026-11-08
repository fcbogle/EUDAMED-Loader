export type RetainedExtractSource = { batch_id: string; set_sha256: string; manifest_sha256: string; exported_from: string; exported_to: string; file_count: number; device_count: number; complete_pages: boolean; retained_batches: string[]; selection_reason: string; scope: string; source_status: string };
export type RetainedExtractStatus = { environment: "dev" | "prod"; available: boolean; selected: RetainedExtractSource | null; excluded_sets: {batch_id: string; reason: string}[]; reason?: string };
export type ReportModel = { key: string; family: string; model: string; total: number; exact: number; different: number; unable: number; absent: number; source_linked: number; stored_available: number; extract_matched: number; source_files: string[] };
export type ReportDetail = { model_key: string; model: string; family: string; issuer: string; udi_di: string; catalogue: string | null; outcome: string; issues: string[]; differences: {field: string; stored: unknown; extracted: unknown}[]; missing_fields: string[]; notes: string[]; state_source: string };
export type StoredDeviceComparison = {
  report_type: string; comparison_fields: string[]; environment: 'dev' | 'prod'; manufacturer: string; generated_at: string; import_batch_id: number;
  extract_source: RetainedExtractSource; excluded_extract_sets: {batch_id: string; reason: string}[];
  models: ReportModel[]; findings: {model_key: string; category: string; finding: string; affected: number}[];
  extract_only: number; evidence: {kind: string; name: string; sha256: string; created_at: string | null}[];
  export_files: {file: string; created_at: string; page: string; number_of_pages: string; devices: number}[];
  details: ReportDetail[]; limitations: string[]; excel_base64: string;
};
