import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { StoredDeviceComparison, RetainedExtractStatus } from "../reportingTypes";

function date(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
}

function download(report: StoredDeviceComparison) {
  const bytes = Uint8Array.from(atob(report.excel_base64), character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `model-reconciliation-${report.generated_at.replace(/[:.]/g, "-")}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportingWorkspace({ environment, enabled = true }: {
  environment: "dev" | "prod" | null;
  enabled?: boolean;
}) {
  const [source, setSource] = useState<RetainedExtractStatus | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [report, setReport] = useState<StoredDeviceComparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const sourceGeneration = useRef(0);
  useEffect(() => {
    const current = ++sourceGeneration.current;
    generation.current += 1;
    setReport(null); setError(""); setBusy(false); setSource(null);
    if (environment !== "dev" || !enabled) { setSourceLoading(false); return; }
    setSourceLoading(true);
    void api.storedDeviceComparisonSource().then(result => {
      if (current !== sourceGeneration.current) return;
      if (result.environment !== environment) throw new Error("Extract source environment changed. Reopen Reporting.");
      setSource(result);
    }).catch(reason => {
      if (current === sourceGeneration.current) setError(reason instanceof Error ? reason.message : "Retained extracts could not be checked");
    }).finally(() => { if (current === sourceGeneration.current) setSourceLoading(false); });
    return () => { sourceGeneration.current += 1; generation.current += 1; };
  }, [environment, enabled]);

  async function generate() {
    const current = ++generation.current;
    setBusy(true); setReport(null); setError("");
    try {
      const result = await api.storedDeviceComparison({ summary_only: true, include_device_details: false });
      if (current !== generation.current) return;
      if (result.environment !== environment) throw new Error("Report environment changed. Refresh and generate again.");
      if (result.comparison_basis !== "current_device_data") throw new Error("Current stored device data could not be verified as the comparison basis.");
      setReport(result);
      setSource({ environment: result.environment, available: true, selected: result.extract_source, excluded_sets: result.excluded_extract_sets });
    } catch (reason) {
      if (current === generation.current) setError(reason instanceof Error ? reason.message : "Report could not be generated");
    } finally { if (current === generation.current) setBusy(false); }
  }
  if (!enabled) return null;
  if (environment !== "dev") return <section className="panel"><h2>Model Reconciliation Summary</h2><p>This report is available in Dev / Playground.</p></section>;
  const total = (key: "total" | "compared" | "matching" | "exceptions" | "absent" | "extract_only" | "unresolved") => (report?.models ?? []).reduce((sum, row) => sum + row[key], 0);
  return <section className="tab-stack reporting-workspace" aria-label="Model Reconciliation Summary">
    <section className="panel">
      <h2>Model Reconciliation Summary</h2>
      <p>Compare current stored device attributes with the latest suitable EUDAMED extract retained through Data Import, grouped by model.</p>
      {sourceLoading && <p role="status">Checking retained Data Import extracts…</p>}
      {source?.available && source.selected && <p className="panel-copy">EUDAMED extract: {date(source.selected.exported_from)}{date(source.selected.exported_from) !== date(source.selected.exported_to) ? ` to ${date(source.selected.exported_to)}` : ""} (UTC)</p>}
      {source && !source.available && <p role="status">{source.reason}</p>}
      <div className="import-action-row"><button type="button" className="action-button" disabled={!source?.available || sourceLoading || busy} onClick={() => void generate()}>{busy ? "Reconciling models…" : "Generate summary"}</button></div>
      {error && <p role="alert">{error}</p>}
      {!report && !busy && <p className="import-empty-state">Not yet compared. Generate the summary when a suitable extract is available.</p>}
      {report && <>
        <p>Database import #{report.import_batch_id}{report.imported_at ? ` · ${date(report.imported_at)}` : ""} · Generated {report.generated_at} (UTC)</p>
        <p className="panel-copy">{report.comparison_basis_label}</p>
        <p className="panel-copy">Green means the compared registered data matches. Amber means registered data has exceptions. Models with no devices compared are neutral. Devices not found in the extract are shown as registration coverage; absence alone does not establish unregistration.</p>
        <div className="import-exception-table"><table>
          <caption>Reconciliation by model</caption>
          <thead><tr><th>Model</th><th>Database devices</th><th>Compared</th><th>Matching</th><th>Data exceptions</th><th>Not in extract</th>{total("extract_only") > 0 && <th>EUDAMED only</th>}{total("unresolved") > 0 && <th>Unresolved identity</th>}<th>Status</th></tr></thead>
          <tbody>{report.models.map(row => <tr key={row.key}>
            <td>{row.model}{report.models.some(other => other.model === row.model && other.family !== row.family) && <small> · {row.family}</small>}</td>
            <td>{row.total}</td><td>{row.compared}</td><td>{row.matching}</td><td>{row.exceptions}</td><td>{row.absent}</td>{total("extract_only") > 0 && <td>{row.extract_only}</td>}{total("unresolved") > 0 && <td>{row.unresolved}</td>}
            <td><span className={`status-pill compact ${row.status === "match" ? "ok" : row.status === "not_compared" ? "neutral" : "warn"}`}>{row.status === "match" ? "Registered data matches" : row.status === "not_compared" ? "No devices compared" : "Data exceptions"}</span></td>
          </tr>)}</tbody>
          <tfoot><tr><th>All models</th><td>{total("total")}</td><td>{total("compared")}</td><td>{total("matching")}</td><td>{total("exceptions")}</td><td>{total("absent")}</td>{total("extract_only") > 0 && <td>{total("extract_only")}</td>}{total("unresolved") > 0 && <td>{total("unresolved")}</td>}<td /></tr></tfoot>
        </table></div>
        <p className="panel-copy">Data exceptions count compared database devices with differing or missing attributes. Not in extract is registration coverage and does not make a model amber. EUDAMED-only registered devices, when present, are highlighted separately because their application record is missing.</p>
        <button type="button" className="ghost-button" onClick={() => download(report)}>Download summary Excel</button>
      </>}
      <details><summary>Comparison details</summary>
        {report && <p>Compared-device exceptions: {report.models.reduce((sum, row) => sum + row.different, 0)} with attribute differences · {report.models.reduce((sum, row) => sum + row.exceptions - row.different, 0)} with insufficient comparison data. Registration coverage: {report.models.reduce((sum, row) => sum + row.absent, 0)} absent from the extract.</p>}
        {report && <><p>Compared attributes: {report.comparison_fields.join(", ")}</p><ul>{report.limitations.map(note => <li key={note}>{note}</li>)}</ul></>}
        {source?.selected && <><p>Source batch {source.selected.batch_id}</p><p>{source.selected.selection_reason}. {source.selected.scope}</p><p>{source.selected.source_status}</p><p>{source.selected.file_count} files · Complete declared page set</p></>}
        {!!source?.excluded_sets.length && <ul>{source.excluded_sets.map(item => <li key={item.batch_id}>{item.batch_id}: {item.reason}</li>)}</ul>}
      </details>
    </section>
  </section>;
}
