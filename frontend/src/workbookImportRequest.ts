import { api } from "./api";

// The backend owns profile and file selection; this only chooses the UI step.
export async function requestWorkbookImport(environment: "dev" | "prod" | null, assessmentToken?: string) {
  if (environment === null) throw new Error("Confirm the backend environment before importing.");
  if (environment === "prod" && !assessmentToken) {
    return { kind: "assessment" as const, result: await api.assessProductionImport() };
  }
  return { kind: "import" as const, result: await api.runWorkbookImport({
    imported_by: "ui",
    label: `UI import ${new Date().toISOString()}`,
    ...(environment === "prod" ? { assessment_token: assessmentToken } : {}),
  }) };
}
