export const PATCH_BUSINESS_OPTIONS = [
  { id: "trade_name_edit", label: "Trade Name" },
  { id: "warning_add", label: "Critical Warnings" },
  { id: "storage_condition_edit", label: "Storage Conditions" },
  { id: "status_code_edit", label: "Device Market Status" },
] as const;

export function marketStatusLabel(code: string | null): string {
  if (code === "ON_THE_MARKET") return "On the EU market";
  if (code === "NO_LONGER_PLACED_ON_THE_MARKET") return "No longer placed on the EU market";
  if (code === "NOT_INTENDED_FOR_EU_MARKET") return "Not intended for the EU market";
  return code || "Not recorded";
}

export function withdrawalBlocker(environment: "dev" | "prod" | null, before: string | null, after: string): string | null {
  if (environment === null) return "Select a confirmed application environment before generating a withdrawal PATCH.";
  if (before !== "ON_THE_MARKET") return "This withdrawal requires an accepted status of On the EU market.";
  if (after !== "NO_LONGER_PLACED_ON_THE_MARKET") return "Select No longer placed on the EU market as the new status.";
  return null;
}

export function bulkPatchScenarioOptions(environment: "dev" | "prod" | null) {
  return PATCH_BUSINESS_OPTIONS.filter(option => environment !== null || option.id !== "status_code_edit");
}
