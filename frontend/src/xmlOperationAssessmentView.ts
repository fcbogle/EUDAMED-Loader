import type { OperationAssessment } from "./types";

export function operationAssessmentStatusClass(status: OperationAssessment["status"]): string {
  return status === "available" ? "ok" : status === "attention" ? "warn" : "danger";
}

export function operationAssessmentStatusLabel(status: OperationAssessment["status"]): string {
  return status === "available" ? "Available" : status === "attention" ? "Attention" : "Blocked";
}

export function assessmentEvidenceNumber(assessment: OperationAssessment | null, key: string): number | null {
  const value = assessment?.evidence[key];
  return typeof value === "number" ? value : null;
}

export function assessmentEvidenceString(assessment: OperationAssessment | null, key: string): string | null {
  const value = assessment?.evidence[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function assessmentEvidenceBoolean(assessment: OperationAssessment | null, key: string): boolean | null {
  const value = assessment?.evidence[key];
  return typeof value === "boolean" ? value : null;
}

export function assessmentEvidenceStringArray(assessment: OperationAssessment | null, key: string): string[] {
  const value = assessment?.evidence[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}
