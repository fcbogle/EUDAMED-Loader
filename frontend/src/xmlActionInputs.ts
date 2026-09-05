export function buildPatchScenarioInputs(args: {
  scenarioId: string;
  implemented: boolean;
  tradeName: string;
  warningCode: string;
  warningComment: string;
  baseQuantity: string;
  sterile: string;
  containsLatex: string;
  statusCode: string;
  storageConditions: Record<string, string>;
}): Record<string, unknown> {
  if (args.scenarioId === "equivalent_first_patch" || !args.implemented) return {};
  if (args.scenarioId === "trade_name_edit") return { new_trade_name: args.tradeName };
  if (args.scenarioId === "warning_add") return { new_warning_code: args.warningCode, new_warning_comment: args.warningComment || null };
  if (args.scenarioId === "base_quantity_edit") return { new_base_quantity: Number(args.baseQuantity) };
  if (args.scenarioId === "sterile_edit") return { new_sterile: args.sterile };
  if (args.scenarioId === "latex_edit") return { new_contains_latex: args.containsLatex };
  if (args.scenarioId === "status_code_edit") return { new_status_code: args.statusCode };
  return {
    updated_conditions: Object.entries(args.storageConditions)
      .filter(([, replacementComment]) => replacementComment.trim())
      .map(([conditionCode, replacementComment]) => ({ condition_code: conditionCode, replacement_comment: replacementComment.trim() })),
  };
}
