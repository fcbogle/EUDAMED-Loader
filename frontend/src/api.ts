import type {
  BulkPatchPostedEntriesResponse,
  BulkPatchPostedParentsResponse,
  BulkPatchPreview,
  BulkMarketInfoPreview,
  BulkUdidiPostPreview,
  CanonicalValidationBundle,
  CanonicalReviewBundle,
  CriticalWarningCodeOption,
  DeviceSubjectSummary,
  DatabaseHealthSummary,
  DatabaseSchemaSummary,
  GeneratedPatchScenarioPreview,
  MarketInfoPutPreview,
  MarketCountryReferenceEntry,
  OperationAssessment,
  PostRegistrationPreview,
  TestingSubjectReadModelSummary,
  TestingBatchHistory,
  TestingBatchPage,
  TestingEventReadModelEntry,
  TestingWorkspaceSummary,
  RegistrationSummary,
  WorkbookImportRunResponse,
  WorkbookImportSnapshotSummary,
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

export type RecordReadiness = {
  product_family: string;
  product_variant: string;
  catalogue_number: string | null;
  primary_udi_di: string | null;
  basic_udi_di: string | null;
  parent_registered: boolean;
  post_ready: boolean;
  child_post_ready: boolean;
  patch_ready: boolean;
  market_info_ready: boolean;
};

export const api = {
  async environment(signal?: AbortSignal): Promise<{ environment: string; message_schema_version: string; schema_package: string }> {
    const response = await fetch(`${API_ROOT}/environment`, { signal });
    if (!response.ok) throw new ApiError(await readErrorMessage(response), response.status);
    return response.json();
  },
  bulkPatchPostedParents: (productFamily: string, productVariant: string) =>
    sendJson<BulkPatchPostedParentsResponse>("/xml/bulk-patch-posted-parents", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
    }),
  bulkPatchPostedEntries: (productFamily: string, productVariant: string, basicUdiDi: string) =>
    sendJson<BulkPatchPostedEntriesResponse>("/xml/bulk-patch-posted-entries", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      basic_udi_di: basicUdiDi,
    }),
  registrationSummary: (params: { product_family?: string; product_variant?: string; search?: string; status?: string; actionable_only?: boolean }) =>
    sendJson<RegistrationSummary>("/xml/registration-summary", "POST", params),
  operationReadiness: () => getJson<RecordReadiness[]>("/xml/operation-readiness"),
  latestWorkbookImportSummary: () => getJson<WorkbookImportSnapshotSummary>("/workbook-imports/latest/summary"),
  workbookImportSchemaSummary: () => getJson<DatabaseSchemaSummary>("/workbook-imports/schema-summary"),
  workbookImportHealthSummary: () => getJson<DatabaseHealthSummary>("/workbook-imports/health"),
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
  runWorkbookImport: (payload?: { imported_by?: string; label?: string; notes?: string }) =>
    sendJson<WorkbookImportRunResponse>("/workbook-imports/run", "POST", payload ?? {}),
  canonicalReview: () => getJson<CanonicalReviewBundle>("/canonical-review"),
  canonicalValidation: () => getJson<CanonicalValidationBundle>("/canonical-validation"),
  marketCountryReference: () => getJson<MarketCountryReferenceEntry[]>("/xml/market-country-reference"),
  previewXmlPostRegistration: (productFamily: string, productVariant: string, catalogueNumber: string, acceptedBaseline = false) =>
    sendJson<PostRegistrationPreview>("/xml/preview-post-registration", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
      accepted_baseline: acceptedBaseline,
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
  previewBulkUdidiPost: (productFamily: string, productVariant: string, recordCount: number, chunkSequence = 1, selectedCatalogueNumbers: string[] = []) =>
    sendJson<BulkUdidiPostPreview>("/xml/preview-bulk-udidi-post", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      record_count: recordCount,
      chunk_sequence: chunkSequence,
      selected_catalogue_numbers: selectedCatalogueNumbers,
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
  testingBatches: (params?: {
    product_family?: string;
    product_variant?: string;
    basic_udi_di?: string;
    catalogue_numbers?: string;
    date_from?: string;
    date_to?: string;
    message_type?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }) =>
    getJson<TestingBatchPage>(
      `/xml/testing-batches${buildQuery({
        product_family: params?.product_family,
        product_variant: params?.product_variant,
        basic_udi_di: params?.basic_udi_di,
        catalogue_numbers: params?.catalogue_numbers,
        date_from: params?.date_from,
        date_to: params?.date_to,
        message_type: params?.message_type,
        status: params?.status,
        page: params?.page ?? 1,
        page_size: params?.page_size ?? 25,
      })}`,
    ),
  testingBatchHistory: (batchId: string) => getJson<TestingBatchHistory>(`/xml/testing-batches/${encodeURIComponent(batchId)}`),
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
  assessSingleMarketInfo: (productFamily: string, productVariant: string, catalogueNumber?: string | null) =>
    sendJson<OperationAssessment>("/xml/assess-single-market-info", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber ?? undefined,
    }),
  assessBulkPost: (productFamily: string, productVariant: string) =>
    sendJson<OperationAssessment>("/xml/assess-bulk-post", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
    }),
  assessBulkMarketInfo: (productFamily: string, productVariant: string, basicUdiDi?: string | null) =>
    sendJson<OperationAssessment>("/xml/assess-bulk-market-info", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      basic_udi_di: basicUdiDi ?? undefined,
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
  downloadBulkUdidiPost: (productFamily: string, productVariant: string, recordCount: number, selectedCatalogueNumbers: string[] = []) =>
    sendDownload("/xml/download-bulk-udidi-post", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      record_count: recordCount,
      selected_catalogue_numbers: selectedCatalogueNumbers,
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
  criticalWarningCodes: () => getJson<CriticalWarningCodeOption[]>("/schemas/critical-warning-codes"),
};
