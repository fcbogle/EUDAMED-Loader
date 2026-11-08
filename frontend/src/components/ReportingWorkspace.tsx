import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { StoredDeviceComparison, ReportDetail, RetainedExtractStatus } from "../reportingTypes";

function download(report: StoredDeviceComparison) {
  const bytes = Uint8Array.from(atob(report.excel_base64), character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  const link = document.createElement("a");
  link.href = url; link.download = `stored-device-comparison-${report.generated_at.replace(/[:.]/g, "-")}.xlsx`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const outcomeLabel: Record<string, string> = {exact: "All compared attributes match", different: "Differences found", unable: "Insufficient stored data / scope", absent: "Absent from extract"};

export function ReportingWorkspace({ environment, enabled = true }: {
  page: "registrationSnapshot" | "eudamedComparison";
  environment: "dev" | "prod" | null;
  enabled?: boolean;
  onPageChange: (page: "registrationSnapshot" | "eudamedComparison") => void;
}) {
  const [source, setSource] = useState<RetainedExtractStatus | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [includeDetails, setIncludeDetails] = useState(false);
  const [report, setReport] = useState<StoredDeviceComparison | null>(null);
  const [model, setModel] = useState("");
  const [showDevices, setShowDevices] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const sourceGeneration = useRef(0);
  useEffect(() => {
    const current = ++sourceGeneration.current;
    generation.current += 1;
    setReport(null); setError(""); setBusy(false); setShowDevices(false); setOffset(0); setSource(null);
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
  useEffect(() => () => { generation.current += 1; sourceGeneration.current += 1; }, []);

  function invalidate() {
    generation.current += 1; setReport(null); setBusy(false); setError(""); setShowDevices(false); setOffset(0);
  }
  async function generate() {
    const current = ++generation.current;
    setBusy(true); setReport(null); setError(""); setShowDevices(false); setOffset(0);
    try {
      const result = await api.storedDeviceComparison({include_device_details: includeDetails});
      if (current !== generation.current) return;
      if (result.environment !== environment) throw new Error("Report environment changed. Refresh and generate again.");
      setReport(result); setSource({environment: result.environment, available: true, selected: result.extract_source, excluded_sets: result.excluded_extract_sets}); setModel("");
    } catch (reason) {
      if (current === generation.current) setError(reason instanceof Error ? reason.message : "Report could not be generated");
    } finally { if (current === generation.current) setBusy(false); }
  }
  const models = report?.models.filter(row => !model || row.key === model) ?? [];
  const findings = report?.findings.filter(row => !model || row.model_key === model) ?? [];
  const details = report?.details.filter(row => !model || row.model_key === model) ?? [];
  const selectedModel = report?.models.find(row => row.key === model);
  function openModel(key: string) { setModel(key); setShowDevices(false); setOffset(0); }
  const total = (key: "total" | "exact" | "different" | "unable" | "absent") => (report?.models ?? []).reduce((sum, row) => sum + row[key], 0);
  if (!enabled) return null;
  if (environment !== "dev") return <section className="panel"><h2>Stored Device Data Comparison</h2><p>This first reporting iteration is available in Dev / Playground.</p></section>;
  return <section className="tab-stack reporting-workspace" aria-label="Stored Device Data Comparison">
    <section className="panel">
      <div className="section-heading"><div><span className="section-kicker">Reporting · Dev / Playground</span><h2>Stored Device Data Comparison</h2></div></div>
      <p>Compare stored accepted device values with a dated EUDAMED extract, grouped by the same models as EUDAMED Submission. This report does not import or update application data.</p>
      <p className="panel-copy">Uses application data and the latest suitable complete EUDAMED extract retained through Data Import. Extracts are added or corrected only in Data Import; registration proof belongs in a separate report.</p>
      {sourceLoading && <p role="status">Checking retained Data Import extracts…</p>}
      {source?.available && source.selected && <div className="panel-copy" role="status">
        <p>Retained extract batch: <strong>{source.selected.batch_id}</strong> · Export dates: {source.selected.exported_from} to {source.selected.exported_to} · {source.selected.file_count} files · Complete declared page set</p>
        <p>{source.selected.selection_reason}. {source.selected.scope}</p>
        <p>{source.selected.source_status}</p>
      </div>}
      {source && !source.available && <p role="status">{source.reason}</p>}
      {!!source?.excluded_sets.length && <details><summary>{source.excluded_sets.length} retained sets excluded</summary><ul>{source.excluded_sets.map(item => <li key={item.batch_id}>{item.batch_id}: {item.reason}</li>)}</ul></details>}
      <label><input type="checkbox" checked={includeDetails} onChange={event => { invalidate(); setIncludeDetails(event.target.checked); }} /> Include individual device details in the Excel download</label>
      <div className="import-action-row"><button type="button" className="action-button" disabled={!source?.available || sourceLoading || busy} onClick={() => { void generate(); }}>{busy ? "Comparing stored values…" : "Generate report"}</button></div>
      {error && <p role="alert">{error}</p>}
      {!report && !busy && <p className="import-empty-state">Not assessed. Reporting uses retained Data Import extracts; generate when suitable evidence is available.</p>}
    </section>
    {report && <>
      <section className="panel">
        <div className="section-heading"><h2>Model summary</h2><button type="button" className="ghost-button" onClick={() => download(report)}>Download full report Excel</button></div>
        <p>Dev / Playground · Manufacturer {report.manufacturer} · Import batch {report.import_batch_id} · Generated {report.generated_at} (UTC)</p>
        <p className="panel-copy">Extract batch {report.extract_source.batch_id} · Complete retained page set. Export dates: {[...new Set(report.export_files.map(file => file.created_at))].join(", ")}. Export scope beyond the supplied pages is not established.</p>

        <div className="import-exception-table"><table><caption>Database entries compared against the selected extract</caption><thead><tr><th>Model</th><th>Database devices</th><th>All compared attributes match</th><th>Differences found</th><th>Insufficient stored data / scope</th><th>Absent from extract</th></tr></thead><tbody>
          {report.models.map(row => <tr key={row.key}><td><a href="#report-model-detail" aria-label={`${row.model} · ${row.family} details`} aria-current={model === row.key ? "true" : undefined} onClick={() => openModel(row.key)}>{row.model}</a></td><td>{row.total}</td><td>{row.exact}</td><td>{row.different}</td><td>{row.unable}</td><td>{row.absent}</td></tr>)}
          <tr><th>All models total</th>{(["total", "exact", "different", "unable", "absent"] as const).map(key => <td key={key}>{total(key)}</td>)}</tr>
        </tbody></table></div>
        <p>{report.extract_only} extract identities have no matching active database identity (whole report).</p>
      </section>
      <section className="panel" id="report-model-detail" tabIndex={-1} aria-labelledby="report-model-detail-title"><h2 id="report-model-detail-title">{selectedModel ? `${selectedModel.model} · ${selectedModel.family} — details` : "All models — details"}</h2>{selectedModel && <p><a href="#report-model-detail" onClick={() => openModel("")}>View details for all models</a></p>}<h3>Grouped exceptions</h3><p className="panel-copy">Counts are unique affected database entries within each finding. Findings overlap. Known differences remain visible even when other stored fields are missing.</p>
        <div className="import-exception-table"><table><thead><tr><th>Model</th><th>Category</th><th>Finding</th><th>Affected entries</th></tr></thead><tbody>{findings.map((row, index) => <tr key={index}><td>{report.models.find(item => item.key === row.model_key)?.model} · {report.models.find(item => item.key === row.model_key)?.family}</td><td>{row.category}</td><td>{row.finding}</td><td>{row.affected}</td></tr>)}</tbody></table></div>
        {!findings.length && <p>No findings in this view.</p>}
      </section>
      <section className="panel"><h2>Comparison coverage</h2><div className="import-exception-table"><table><thead><tr><th>Model</th><th>Entries linked to source workbook</th><th>Entries with stored accepted device values</th><th>Entries matched to extract</th></tr></thead><tbody>{models.map(row => <tr key={row.key}><td>{row.model} · {row.family}</td><td>{row.source_linked} / {row.total}</td><td>{row.stored_available} / {row.total}</td><td>{row.extract_matched} / {row.total}</td></tr>)}</tbody></table></div>
        <p className="panel-copy">Source links are recorded provenance. Stored accepted values support this comparison; they do not, by themselves, establish proof of upload or registration.</p>
        <button type="button" className="ghost-button" onClick={() => setShowEvidence(value => !value)}>{showEvidence ? "Hide comparison sources" : "View comparison sources"}</button>
        {showEvidence && <div className="import-exception-table"><table><caption>Whole-report comparison sources</caption><thead><tr><th>Evidence</th><th>File</th><th>Date</th><th>SHA-256</th></tr></thead><tbody>{report.evidence.map((row, index) => <tr key={index}><td>{row.kind}</td><td>{row.name}</td><td>{row.created_at || "Not recorded"}</td><td>{row.sha256}</td></tr>)}</tbody></table></div>}
      </section>
      <section className="panel"><h2>Comparison scope</h2><p>Compared fields: {report.comparison_fields.join(", ")}</p><ul>{report.limitations.map(note => <li key={note}>{note}</li>)}</ul></section>
      <section className="panel"><button type="button" className="ghost-button" onClick={() => { setShowDevices(value => !value); setOffset(0); }}>{showDevices ? "Hide device details" : "View affected entries"}</button>
        {showDevices && <DeviceDetails rows={details.filter(row => row.outcome !== "exact" || row.notes.length > 0 || row.issues.length > 0)} offset={offset} setOffset={setOffset} />}
      </section>
    </>}
  </section>;
}

function DeviceDetails({rows, offset, setOffset}: {rows: ReportDetail[]; offset: number; setOffset: (value: number) => void}) {
  return <><p>{rows.length} affected entries · showing {rows.length ? offset + 1 : 0}–{Math.min(offset + 25, rows.length)}</p><div className="import-exception-table"><table><thead><tr><th>Model / catalogue</th><th>Issuer / Device UDI-DI</th><th>Outcome</th><th>Stored and extracted values</th></tr></thead><tbody>{rows.slice(offset, offset + 25).map((row, index) => <tr key={index}><td>{row.model}<br />{row.catalogue}</td><td>{row.issuer}: {row.udi_di}</td><td>{outcomeLabel[row.outcome]}</td><td>{row.issues.map(issue => <p key={issue}>{issue}</p>)}{row.differences.map((difference, i) => <details key={i}><summary>{difference.field}</summary><p>Stored: {JSON.stringify(difference.stored)}</p><p>Extract: {JSON.stringify(difference.extracted)}</p></details>)}<p>Missing stored fields: {row.missing_fields.join(", ") || "None"}</p>{row.notes.map(note => <p key={note}>{note}</p>)}<p>Stored state source: {row.state_source}</p></td></tr>)}</tbody></table></div>
    <button type="button" className="ghost-button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous entries</button><button type="button" className="ghost-button" disabled={offset + 25 >= rows.length} onClick={() => setOffset(offset + 25)}>Next entries</button></>;
}
