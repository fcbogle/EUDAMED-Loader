import type { BulkPatchPostedEntry } from "./types";

function summarizeValues(label: string, values: Array<string | null | undefined>, selectedCount: number): string {
  const distinctValues = Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
  if (!distinctValues.length) return `${label}: unavailable`;
  if (distinctValues.length === 1) return `${label}: ${distinctValues[0]}`;
  return `${label}: mixed (${distinctValues.length} values across ${selectedCount} devices)`;
}

function storageConditionValues(entries: BulkPatchPostedEntry[], code: string): string[] {
  return entries.map((entry) => entry.current_state?.storage_conditions?.find((item) => item.code === code)?.comment ?? "");
}

export function buildBulkPatchBaselineSummary(args: {
  scenarioId: string;
  entries: BulkPatchPostedEntry[];
}): string[] {
  const { scenarioId, entries } = args;
  if (!entries.length || scenarioId === "equivalent_first_patch") return [];

  if (scenarioId === "trade_name_edit") {
    return [summarizeValues("Current trade name", entries.map((entry) => entry.current_state?.trade_name), entries.length)];
  }
  if (scenarioId === "base_quantity_edit") {
    return [summarizeValues("Current base quantity", entries.map((entry) => String(entry.current_state?.base_quantity ?? "")), entries.length)];
  }
  if (scenarioId === "sterile_edit") {
    return [summarizeValues("Current sterile value", entries.map((entry) => entry.current_state?.sterile === undefined ? "" : String(entry.current_state.sterile)), entries.length)];
  }
  if (scenarioId === "latex_edit") {
    return [summarizeValues("Current latex value", entries.map((entry) => entry.current_state?.contains_latex === undefined ? "" : String(entry.current_state.contains_latex)), entries.length)];
  }
  if (scenarioId === "status_code_edit") {
    return [summarizeValues("Current status", entries.map((entry) => entry.current_state?.status_code), entries.length)];
  }
  if (scenarioId === "warning_add") {
    return [
      summarizeValues(
        "Current warnings",
        entries.map((entry) => entry.current_state?.critical_warnings?.map((warning) => warning.code).filter(Boolean).join(", ") ?? ""),
        entries.length,
      ),
    ];
  }
  if (scenarioId === "storage_condition_edit") {
    return [
      summarizeValues("Current SHC006", storageConditionValues(entries, "SHC006"), entries.length),
      summarizeValues("Current SHC007", storageConditionValues(entries, "SHC007"), entries.length),
    ];
  }
  return [];
}
