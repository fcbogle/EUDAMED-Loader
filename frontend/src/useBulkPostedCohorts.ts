import { useEffect, useState } from "react";
import { api } from "./api";
import type { BulkPatchPostedEntry, BulkPatchPostedParentGroup, TestingSubjectReadModelSummary } from "./types";

export function useBulkPostedCohorts(
  productFamily: string | undefined,
  productVariant: string | undefined,
  patchParent: string,
  marketParent: string,
  subjects: TestingSubjectReadModelSummary[],
  setError: (message: string | null) => void,
) {
  const scopeKey = JSON.stringify([productFamily, productVariant]);
  const [parentState, setParentState] = useState<{ key: string; parents: BulkPatchPostedParentGroup[] } | null>(null);
  const [entryState, setEntryState] = useState<{ key: string; patchEntries: BulkPatchPostedEntry[]; marketEntries: BulkPatchPostedEntry[] } | null>(null);
  const entryKey = JSON.stringify([scopeKey, patchParent, marketParent]);
  useEffect(() => {
    let cancelled = false;
    if (!productFamily || !productVariant) return;
    void api.bulkPatchPostedParents(productFamily, productVariant).then((result) => {
      if (!cancelled) setParentState({ key: scopeKey, parents: result.parents });
    }).catch((error: unknown) => {
      if (cancelled) return;
      setParentState(null);
      setError(error instanceof Error ? error.message : "Posted parent selection is unavailable.");
    });
    return () => { cancelled = true; };
  }, [productFamily, productVariant, scopeKey, subjects, setError]);
  useEffect(() => {
    let cancelled = false;
    if (!productFamily || !productVariant) return;
    void Promise.all([
      patchParent ? api.bulkPatchPostedEntries(productFamily, productVariant, patchParent) : Promise.resolve({ entries: [] }),
      marketParent ? api.bulkPatchPostedEntries(productFamily, productVariant, marketParent) : Promise.resolve({ entries: [] }),
    ]).then(([patch, market]) => {
      if (!cancelled) setEntryState({ key: entryKey, patchEntries: patch.entries, marketEntries: market.entries });
    }).catch((error: unknown) => {
      if (cancelled) return;
      setEntryState(null);
      setError(error instanceof Error ? error.message : "Posted device selection is unavailable.");
    });
    return () => { cancelled = true; };
  }, [productFamily, productVariant, patchParent, marketParent, entryKey, subjects, setError]);
  return {
    parents: parentState?.key === scopeKey ? parentState.parents : [],
    patchEntries: entryState?.key === entryKey ? entryState.patchEntries : [],
    marketEntries: entryState?.key === entryKey ? entryState.marketEntries : [],
  };
}
