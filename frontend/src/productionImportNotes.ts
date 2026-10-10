type WorkbookNote = Record<string, string | number>;

/** Brief display notes; the assessment report retains every original entry. */
export function productionImportNotes(entries: WorkbookNote[]): string[] {
  const notes: string[] = [];
  const removed = new Map<string, number>();
  let omittedUrls = 0;
  const auditOnly = new Set(["Counts", "Device exception", "Recorded encoding override", "Later verification"]);
  for (const entry of entries) {
    const count = Number(entry["Affected Rows"]) || 0;
    if (entry.Category === "Removed from current templates") {
      const scope = String(entry.Scope).replace(/_/g, " ");
      removed.set(scope, (removed.get(scope) ?? 0) + count);
    } else if (entry.Category === "Included with optional URL omitted") {
      omittedUrls += count;
    } else if (entry.Category === "Owner-approved exclusion") {
      notes.push(`${count} device rows intentionally excluded from import.`);
    } else if (entry.Category === "Approved setting") {
      notes.push(`${entry.Scope}: ${entry.Details}`);
    } else if (!auditOnly.has(String(entry.Category))) {
      notes.push(`${entry.Category}: ${entry.Scope} — ${entry.Details}`);
    }
  }
  if (omittedUrls) notes.push(`Optional URLs omitted for ${omittedUrls.toLocaleString()} rows; omission does not block import.`);
  if (removed.size) {
    const total = [...removed.values()].reduce((sum, count) => sum + count, 0);
    notes.push(`${total} identities removed from templates (${[...removed].map(([scope, count]) => `${scope}: ${count}`).join("; ")}). Confirm these exclusions.`);
  }
  return notes;
}
