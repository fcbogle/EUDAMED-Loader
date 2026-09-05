import { useState } from "react";

export type BulkScopeMode =
  | "all_posted"
  | "next_10"
  | "next_25"
  | "selected_catalogue_numbers"
  | "import_catalogue_list";

function useScopeSelectionState() {
  const [scopeMode, setScopeMode] = useState<BulkScopeMode>("all_posted");
  const [catalogueNumbers, setCatalogueNumbers] = useState<string[]>([]);
  const [catalogueFilter, setCatalogueFilter] = useState<string>("");
  const [importText, setImportText] = useState<string>("");

  return {
    scopeMode,
    setScopeMode,
    catalogueNumbers,
    setCatalogueNumbers,
    catalogueFilter,
    setCatalogueFilter,
    importText,
    setImportText,
  };
}

export function useBulkScopeState() {
  const patch = useScopeSelectionState();
  const marketInfo = useScopeSelectionState();
  const udidiPost = useScopeSelectionState();

  return { patch, marketInfo, udidiPost };
}
