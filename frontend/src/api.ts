import type {
  ApplyNormalizationRulesResponse,
  BatchXmlPreview,
  CanonicalReviewBundle,
  DistinctValueProfile,
  EchelonValidationBundle,
  NormalizationRuleFile,
  ReferenceWorkbookSummary,
  SchemaInventory,
  SheetProfile,
  SheetSummary,
  SingleRecordXmlPreview,
  WorkbookSummary,
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
  echelonCanonicalValidation: () => getJson<EchelonValidationBundle>("/canonical-validation/echelon"),
  previewEchelonXmlRecord: (catalogueNumber: string) =>
    sendJson<SingleRecordXmlPreview>("/xml/echelon/preview-record", "POST", {
      catalogue_number: catalogueNumber,
    }),
  previewEchelonXmlBatch: (chunkSequence = 1) =>
    sendJson<BatchXmlPreview>("/xml/echelon/preview-batch", "POST", {
      chunk_sequence: chunkSequence,
    }),
  downloadEchelonXmlRecord: (catalogueNumber: string) =>
    sendDownload("/xml/echelon/download-record", "POST", {
      catalogue_number: catalogueNumber,
    }),
  downloadEchelonXmlBatch: () => sendDownload("/xml/echelon/download-batch", "POST"),
  schemas: () => getJson<SchemaInventory>("/schemas"),
};
