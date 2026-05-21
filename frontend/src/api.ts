import type {
  ApplyNormalizationRulesResponse,
  CanonicalReviewBundle,
  DistinctValueProfile,
  EchelonValidationBundle,
  NormalizationRuleFile,
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

async function sendDownload(path: string, method: string, body: unknown): Promise<Blob> {
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
  return response.blob();
}

export const api = {
  workbooks: () => getJson<WorkbookSummary[]>("/workbooks"),
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
  downloadEchelonXmlRecord: (catalogueNumber: string) =>
    sendDownload("/xml/echelon/download-record", "POST", {
      catalogue_number: catalogueNumber,
    }),
  schemas: () => getJson<SchemaInventory>("/schemas"),
};
