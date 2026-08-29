import type {
  ApplyNormalizationRulesResponse,
  BatchXmlPreview,
  BulkPatchPreview,
  BulkPatchPostedEntriesResponse,
  BulkMarketInfoPreview,
  BulkPatchPostedParentsResponse,
  BulkPostPreview,
  BulkUdidiPostPreview,
  CanonicalValidationBundle,
  CanonicalReviewBundle,
  CriticalWarningCodeOption,
  DeviceIdentityIssueDetail,
  DeviceIdentityIssueSummary,
  DeviceSubjectDetail,
  DeviceSubjectSummary,
  DatabaseHealthSummary,
  DatabaseSchemaSummary,
  DistinctValueProfile,
  GeneratedPatchScenarioPreview,
  MarketInfoPutPreview,
  MarketCountryReferenceEntry,
  NormalizationRuleFile,
  OperationAssessment,
  PostRegistrationPreview,
  RegisteredDeviceAnchor,
  ReferenceWorkbookSummary,
  SchemaInventory,
  SheetProfile,
  SheetSummary,
  SingleRecordXmlPreview,
  SourceRowDetail,
  SourceRowSummary,
  TestingSubjectReadModelSummary,
  TestingEventReadModelEntry,
  TestingWorkspaceSummary,
  WorkbookImportDiffSummary,
  WorkbookImportRunResponse,
  WorkbookImportSnapshotSummary,
  WorkbookSummary,
  XmlGenerationScopeBundle,
  SuccessXmlUploadResult,
} from "./types";

const API_ROOT = "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string };
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  } catch {
    // Ignore JSON parsing failures and fall back to the status line.
  }
  return `Request failed: ${response.status}`;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`);
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }
  return response.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function sendJson<T>(path: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }
  return response.json() as Promise<T>;
}

function parseFileName(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? null;
}

async function sendDownload(path: string, method: string, body?: unknown): Promise<{ blob: Blob; fileName: string | null }> {
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }
  return {
    blob: await response.blob(),
    fileName: parseFileName(response.headers.get("Content-Disposition")),
  };
}

export const api = {
  workbooks: () => getJson<WorkbookSummary[]>("/workbooks"),
  referenceWorkbooks: () => getJson<ReferenceWorkbookSummary[]>("/reference-workbooks"),
  latestWorkbookImportSummary: () => getJson<WorkbookImportSnapshotSummary>("/workbook-imports/latest/summary"),
  workbookImportSchemaSummary: () => getJson<DatabaseSchemaSummary>("/workbook-imports/schema-summary"),
  workbookImportHealthSummary: () => getJson<DatabaseHealthSummary>("/workbook-imports/health"),
  latestWorkbookImportDiff: () => getJson<WorkbookImportDiffSummary>("/workbook-imports/latest/diff"),
  workbookImportDeviceSubjects: (params?: {
    product_family?: string;
    product_variant?: string;
    catalogue_number?: string;
    import_batch_id?: number;
    limit?: number;
  }) =>
    getJson<DeviceSubjectSummary[]>(
      `/workbook-imports/device-subjects${buildQuery({
        product_family: params?.product_family,
        product_variant: params?.product_variant,
        catalogue_number: params?.catalogue_number,
        import_batch_id: params?.import_batch_id,
        limit: params?.limit ?? 20,
      })}`,
    ),
  workbookImportDeviceSubject: (subjectId: number) =>
    getJson<DeviceSubjectDetail>(`/workbook-imports/device-subjects/${subjectId}`),
  workbookImportSourceRows: (params?: {
    product_family?: string;
    product_variant?: string;
    catalogue_number?: string;
    submission_operation?: string;
    import_batch_id?: number;
    limit?: number;
  }) =>
    getJson<SourceRowSummary[]>(
      `/workbook-imports/source-rows${buildQuery({
        product_family: params?.product_family,
        product_variant: params?.product_variant,
        catalogue_number: params?.catalogue_number,
        submission_operation: params?.submission_operation,
        import_batch_id: params?.import_batch_id,
        limit: params?.limit ?? 20,
      })}`,
    ),
  workbookImportSourceRow: (sourceRowId: number) =>
    getJson<SourceRowDetail>(`/workbook-imports/source-rows/${sourceRowId}`),
  workbookImportIdentityIssues: (params?: {
    issue_code?: string;
    product_family?: string;
    product_variant?: string;
    catalogue_number?: string;
    import_batch_id?: number;
    limit?: number;
  }) =>
    getJson<DeviceIdentityIssueSummary[]>(
      `/workbook-imports/identity-issues${buildQuery({
        issue_code: params?.issue_code,
        product_family: params?.product_family,
        product_variant: params?.product_variant,
        catalogue_number: params?.catalogue_number,
        import_batch_id: params?.import_batch_id,
        limit: params?.limit ?? 20,
      })}`,
    ),
  workbookImportIdentityIssue: (issueId: number) =>
    getJson<DeviceIdentityIssueDetail>(`/workbook-imports/identity-issues/${issueId}`),
  runWorkbookImport: (payload?: { imported_by?: string; label?: string; notes?: string }) =>
    sendJson<WorkbookImportRunResponse>("/workbook-imports/run", "POST", payload ?? {}),
  sheets: () => getJson<SheetSummary[]>("/sheets"),
  sheetProfile: (workbook: string, sheet: string) =>
    getJson<SheetProfile>(
      `/sheet-profile?workbook=${encodeURIComponent(workbook)}&sheet=${encodeURIComponent(sheet)}`,
    ),
  distinctValues: (column: string, workbook?: string, sheet?: string) => {
    const params = new URLSearchParams({ column });
    if (workbook) {
      params.set("workbook", workbook);
    }
    if (sheet) {
      params.set("sheet", sheet);
    }
    return getJson<DistinctValueProfile>(`/distinct-values?${params.toString()}`);
  },
  normalizationRules: () => getJson<NormalizationRuleFile[]>("/normalization-rules"),
  applyNormalizationRules: (column: string, rules: { raw: string; normalized: string }[]) =>
    sendJson<ApplyNormalizationRulesResponse>("/normalization-rules/apply", "POST", {
      column,
      rules,
    }),
  canonicalReview: () => getJson<CanonicalReviewBundle>("/canonical-review"),
  canonicalValidation: () => getJson<CanonicalValidationBundle>("/canonical-validation"),
  xmlGenerationScope: () => getJson<XmlGenerationScopeBundle>("/xml/scope"),
  marketCountryReference: () => getJson<MarketCountryReferenceEntry[]>("/xml/market-country-reference"),
  previewXmlRecord: (productFamily: string, productVariant: string, catalogueNumber: string) =>
    sendJson<SingleRecordXmlPreview>("/xml/preview-record", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
    }),
  previewXmlPostRegistration: (productFamily: string, productVariant: string, catalogueNumber: string) =>
    sendJson<PostRegistrationPreview>("/xml/preview-post-registration", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
    }),
  previewNextXmlPostRegistration: (productFamily: string, productVariant: string) =>
    sendJson<PostRegistrationPreview>("/xml/preview-next-post-registration", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
    }),
  previewXmlMarketInfoPut: (
    productFamily: string,
    productVariant: string,
    catalogueNumber: string,
    marketInfoVersion: string,
    marketCountries?: Array<{ country: string; original_placed_on_market: boolean }>,
  ) =>
    sendJson<MarketInfoPutPreview>("/xml/preview-market-info-put", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
      market_info_version: marketInfoVersion,
      market_countries: marketCountries,
    }),
  previewGeneratedPatchScenario: (
    productFamily: string,
    productVariant: string,
    catalogueNumber: string,
    scenarioId: string,
    patchVersion: string,
    scenarioInputs: unknown,
  ) =>
    sendJson<GeneratedPatchScenarioPreview>("/xml/preview-generated-patch-scenario", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
      scenario_id: scenarioId,
      patch_version: patchVersion,
      scenario_inputs: scenarioInputs,
    }),
  previewXmlBatch: (productFamily: string, productVariant: string, chunkSequence = 1) =>
    sendJson<BatchXmlPreview>("/xml/preview-batch", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      chunk_sequence: chunkSequence,
    }),
  previewBulkPost: (productFamily: string, productVariant: string, recordCount: number, chunkSequence = 1) =>
    sendJson<BulkPostPreview>("/xml/preview-bulk-post", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      record_count: recordCount,
      chunk_sequence: chunkSequence,
    }),
  previewBulkUdidiPost: (productFamily: string, productVariant: string, recordCount: number, chunkSequence = 1) =>
    sendJson<BulkUdidiPostPreview>("/xml/preview-bulk-udidi-post", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      record_count: recordCount,
      chunk_sequence: chunkSequence,
    }),
  previewBulkPatch: (
    productFamily: string,
    productVariant: string,
    basicUdiDi: string,
    recordCount: number,
    scenarioId: string,
    scenarioInputs: unknown,
    selectedCatalogueNumbers: string[],
    chunkSequence = 1,
  ) =>
    sendJson<BulkPatchPreview>("/xml/preview-bulk-patch", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      basic_udi_di: basicUdiDi,
      record_count: recordCount,
      scenario_id: scenarioId,
      scenario_inputs: scenarioInputs,
      selected_catalogue_numbers: selectedCatalogueNumbers,
      chunk_sequence: chunkSequence,
    }),
  previewBulkMarketInfo: (
    productFamily: string,
    productVariant: string,
    basicUdiDi: string,
    recordCount: number,
    marketCountries: Array<{ country: string; original_placed_on_market: boolean }>,
    selectedCatalogueNumbers: string[],
    chunkSequence = 1,
  ) =>
    sendJson<BulkMarketInfoPreview>("/xml/preview-bulk-market-info", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      basic_udi_di: basicUdiDi,
      record_count: recordCount,
      market_countries: marketCountries,
      selected_catalogue_numbers: selectedCatalogueNumbers,
      chunk_sequence: chunkSequence,
    }),
  bulkPatchPostedEntries: (productFamily: string, productVariant: string, basicUdiDi: string) =>
    sendJson<BulkPatchPostedEntriesResponse>("/xml/bulk-patch-posted-entries", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      basic_udi_di: basicUdiDi,
    }),
  bulkPatchPostedParents: (productFamily: string, productVariant: string) =>
    sendJson<BulkPatchPostedParentsResponse>("/xml/bulk-patch-posted-parents", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
    }),
  testingWorkspaceSummary: (params?: { product_family?: string; product_variant?: string }) =>
    sendJson<TestingWorkspaceSummary>("/xml/testing-workspace-summary", "POST", {
      product_family: params?.product_family,
      product_variant: params?.product_variant,
    }),
  testingSubjectSummaries: (params?: {
    product_family?: string;
    product_variant?: string;
    limit?: number;
  }) =>
    sendJson<TestingSubjectReadModelSummary[]>("/xml/testing-subject-summaries", "POST", {
      product_family: params?.product_family,
      product_variant: params?.product_variant,
      limit: params?.limit ?? 200,
    }),
  testingEvents: (params?: {
    product_family?: string;
    product_variant?: string;
    limit?: number;
  }) =>
    sendJson<TestingEventReadModelEntry[]>("/xml/testing-events", "POST", {
      product_family: params?.product_family,
      product_variant: params?.product_variant,
      limit: params?.limit ?? 500,
    }),
  assessSinglePost: (productFamily: string, productVariant: string, catalogueNumber?: string | null) =>
    sendJson<OperationAssessment>("/xml/assess-single-post", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber ?? undefined,
    }),
  assessSinglePatch: (productFamily: string, productVariant: string, catalogueNumber?: string | null) =>
    sendJson<OperationAssessment>("/xml/assess-single-patch", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber ?? undefined,
    }),
  assessBulkPost: (productFamily: string, productVariant: string) =>
    sendJson<OperationAssessment>("/xml/assess-bulk-post", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
    }),
  assessBulkPatch: (productFamily: string, productVariant: string, basicUdiDi?: string | null) =>
    sendJson<OperationAssessment>("/xml/assess-bulk-patch", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      basic_udi_di: basicUdiDi ?? undefined,
    }),
  uploadSuccessXml: (fileName: string, xmlContent: string) =>
    sendJson<SuccessXmlUploadResult>("/xml/upload-success-xml", "POST", {
      file_name: fileName,
      xml_content: xmlContent,
    }),
  downloadXmlRecord: (productFamily: string, productVariant: string, catalogueNumber: string) =>
    sendDownload("/xml/download-record", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
    }),
  downloadXmlPostPackage: (productFamily: string, productVariant: string, catalogueNumber: string) =>
    sendDownload("/xml/download-post-package", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
    }),
  downloadXmlMarketInfoPut: (
    productFamily: string,
    productVariant: string,
    catalogueNumber: string,
    marketInfoVersion: string,
    marketCountries?: Array<{ country: string; original_placed_on_market: boolean }>,
  ) =>
    sendDownload("/xml/download-market-info-put", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
      market_info_version: marketInfoVersion,
      market_countries: marketCountries,
    }),
  downloadGeneratedPatchScenario: (
    productFamily: string,
    productVariant: string,
    catalogueNumber: string,
    scenarioId: string,
    patchVersion: string,
    scenarioInputs: unknown,
  ) =>
    sendDownload("/xml/download-generated-patch-scenario", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
      scenario_id: scenarioId,
      patch_version: patchVersion,
      scenario_inputs: scenarioInputs,
    }),
  downloadXmlBatch: (productFamily: string, productVariant: string) =>
    sendDownload("/xml/download-batch", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
    }),
  downloadBulkPost: (productFamily: string, productVariant: string, recordCount: number) =>
    sendDownload("/xml/download-bulk-post", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      record_count: recordCount,
    }),
  downloadBulkUdidiPost: (productFamily: string, productVariant: string, recordCount: number) =>
    sendDownload("/xml/download-bulk-udidi-post", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      record_count: recordCount,
    }),
  downloadBulkPatch: (
    productFamily: string,
    productVariant: string,
    basicUdiDi: string,
    recordCount: number,
    scenarioId: string,
    scenarioInputs: unknown,
    selectedCatalogueNumbers: string[],
  ) =>
    sendDownload("/xml/download-bulk-patch", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      basic_udi_di: basicUdiDi,
      record_count: recordCount,
      scenario_id: scenarioId,
      scenario_inputs: scenarioInputs,
      selected_catalogue_numbers: selectedCatalogueNumbers,
    }),
  downloadBulkMarketInfo: (
    productFamily: string,
    productVariant: string,
    basicUdiDi: string,
    recordCount: number,
    marketCountries: Array<{ country: string; original_placed_on_market: boolean }>,
    selectedCatalogueNumbers: string[],
  ) =>
    sendDownload("/xml/download-bulk-market-info", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      basic_udi_di: basicUdiDi,
      record_count: recordCount,
      market_countries: marketCountries,
      selected_catalogue_numbers: selectedCatalogueNumbers,
    }),
  schemas: () => getJson<SchemaInventory>("/schemas"),
  criticalWarningCodes: () => getJson<CriticalWarningCodeOption[]>("/schemas/critical-warning-codes"),
};
