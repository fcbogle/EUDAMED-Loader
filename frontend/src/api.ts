import type {
  ApplyNormalizationRulesResponse,
  BatchXmlPreview,
  CanonicalValidationBundle,
  CanonicalReviewBundle,
  DistinctValueProfile,
  EquivalentPatchPairPreview,
  GeneratedPatchScenarioPreview,
  MarketInfoPutPreview,
  NormalizationRuleFile,
  RegisteredDeviceAnchor,
  ReferenceWorkbookSummary,
  SchemaInventory,
  SheetProfile,
  SheetSummary,
  SingleRecordXmlPreview,
  WorkbookSummary,
  XmlGenerationScopeBundle,
} from "./types";

const API_ROOT = "http://localhost:8000/api";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
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
    throw new Error(`Request failed: ${response.status}`);
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
    throw new Error(`Request failed: ${response.status}`);
  }
  return {
    blob: await response.blob(),
    fileName: parseFileName(response.headers.get("Content-Disposition")),
  };
}

export const api = {
  workbooks: () => getJson<WorkbookSummary[]>("/workbooks"),
  referenceWorkbooks: () => getJson<ReferenceWorkbookSummary[]>("/reference-workbooks"),
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
  previewXmlRecord: (productFamily: string, productVariant: string, catalogueNumber: string) =>
    sendJson<SingleRecordXmlPreview>("/xml/preview-record", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
    }),
  previewXmlPostPatchPair: (productFamily: string, productVariant: string, catalogueNumber: string) =>
    sendJson<EquivalentPatchPairPreview>("/xml/preview-post-patch-pair", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
    }),
  previewXmlMarketInfoPut: (productFamily: string, productVariant: string, catalogueNumber: string) =>
    sendJson<MarketInfoPutPreview>("/xml/preview-market-info-put", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
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
  downloadXmlRecord: (productFamily: string, productVariant: string, catalogueNumber: string) =>
    sendDownload("/xml/download-record", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
    }),
  downloadXmlPostPatchPair: (productFamily: string, productVariant: string, catalogueNumber: string) =>
    sendDownload("/xml/download-post-patch-pair", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
    }),
  downloadXmlMarketInfoPut: (productFamily: string, productVariant: string, catalogueNumber: string) =>
    sendDownload("/xml/download-market-info-put", "POST", {
      product_family: productFamily,
      product_variant: productVariant,
      catalogue_number: catalogueNumber,
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
  schemas: () => getJson<SchemaInventory>("/schemas"),
};
