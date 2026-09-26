import { useState } from "react";

export type BulkScopeMode =
  | "all_posted"
  | "next_10"
  | "next_25"
  | "selected_catalogue_numbers"
  | "import_catalogue_list";

export type BulkPostScopeMode = BulkScopeMode | "next_100";

function useScopeSelectionState<ExtraScopeMode extends string = never>() {
  const [scopeMode, setScopeMode] = useState<BulkScopeMode | ExtraScopeMode>("all_posted");
  const [catalogueNumbers, setCatalogueNumbers] = useState<string[]>([]);
  const [importText, setImportText] = useState<string>("");

  return {
    scopeMode,
    setScopeMode,
    catalogueNumbers,
    setCatalogueNumbers,
    importText,
    setImportText,
  };
}

export function useBulkScopeState() {
  const patch = useScopeSelectionState();
  const marketInfo = useScopeSelectionState();
  const udidiPost = useScopeSelectionState<"next_100">();

  return { patch, marketInfo, udidiPost };
}
