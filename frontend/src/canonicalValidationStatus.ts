import type { CanonicalValidationRecord } from "./types";

export function canonicalCompletenessNotes(
  record: CanonicalValidationRecord,
  environment: "dev" | "prod" | null,
): string[] {
  if (environment !== "prod") return record.blockers;
  const xmlGaps = new Set(record.fields
    .filter(field => field.xml_required && field.value === null)
    .map(field => `${field.business_label} is not populated.`));
  return record.blockers.filter(message => !xmlGaps.has(message));
}

export function canonicalValidationStatus(
  environment: "dev" | "prod" | null,
  total: number,
  incomplete: number,
  xmlReady: number,
): { label: string; className: string } {
  if (total === 0) return { label: "Stop", className: "danger" };
  if (environment === "prod") {
    return total > xmlReady
      ? { label: "XML blocked", className: "warn" }
      : { label: "XML ready", className: "ok" };
  }
  return incomplete > 0
    ? { label: "Warning", className: "warn" }
    : { label: "Ready", className: "ok" };
}
