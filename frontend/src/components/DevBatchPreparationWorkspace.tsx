import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { DevBatch, DevBatchContext, DevBatchInspection, DevPreparedWorkbook, PlaygroundAssessment } from "../devInputBatchTypes";

function fieldLabel(name: string) {
  const labels: Record<string, string> = { trade_name: "Trade name", base_quantity: "Base quantity", market_info_version: "Market Info version", critical_warnings: "Critical warnings" };
  return labels[name] ?? name.replace(/_/g, " ").replace(/^./, letter => letter.toUpperCase());
}

function acceptedValue(value: unknown): string {
  if (value == null || value === "") return "No value recorded";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function DevBatchPreparationWorkspace({ page, enabled, onPageChange, onContextChange }: {
  page: "sourceFiles" | "createImportWorkbook" | "assessmentImport";
  enabled: boolean;
  onPageChange: (page: "sourceFiles" | "createImportWorkbook" | "assessmentImport") => void;
  onContextChange: (context: DevBatchContext) => void;
}) {
  const [batches, setBatches] = useState<DevBatch[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [inspection, setInspection] = useState<DevBatchInspection | null>(null);
  const [prepared, setPrepared] = useState<DevPreparedWorkbook | null>(null);
  const [assessment, setAssessment] = useState<PlaygroundAssessment | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const loaded = useRef(false);
  const selected = batches.find((batch) => batch.batch_id === selectedId);
  const valid = Boolean(selected && !selected.error);
  const differences = assessment?.records.flatMap(device => device.fields
    .filter(field => field.comparison === "Difference found")
    .map(field => ({ device, field }))) ?? [];
  const changedDevices = new Set(differences.map(({ device }) => `${device.issuer}:${device.udi_di}`)).size;
  const reviewDevices = assessment?.records.filter(device => device.warnings.length || device.outcome === "Review required" || device.outcome === "Unable to compare").length ?? 0;
  const differenceTypes = [...new Set(differences.map(({ field }) => field.field))];

  useEffect(() => { onContextChange({ batchId: selectedId, valid, checked: Boolean(inspection?.inspection_complete), prepared: Boolean(prepared) }); },
    [selectedId, valid, inspection, prepared, onContextChange]);
  useEffect(() => {
    if (enabled && !loaded.current) void refresh();
  }, [enabled]);
  useEffect(() => () => { request.current++; loaded.current = false; }, []);

  async function refresh() {
    const current = ++request.current;
    setBusy("loading"); setError(null); setInspection(null); setPrepared(null); setAssessment(null);
    try {
      const result = await api.devInputBatches();
      if (current === request.current) { loaded.current = true; setBatches(result.batches); setSelectedId(""); }
    } catch (reason) {
      if (current === request.current) { loaded.current = true; setBatches([]); setSelectedId(""); setError(reason instanceof Error ? reason.message : "Could not load Dev batches."); }
    } finally { if (current === request.current) setBusy(""); }
  }
  function select(id: string) {
    request.current++; setSelectedId(id); setInspection(null); setPrepared(null); setAssessment(null); setError(null); setBusy("");
  }
  async function check() {
    if (!valid) return;
    const current = ++request.current;
    setBusy("checking"); setError(null); setInspection(null); setPrepared(null); setAssessment(null);
    try {
      const result = await api.inspectDevInputBatch(selectedId);
      if (current === request.current) setInspection(result);
    } catch (reason) { if (current === request.current) setError(reason instanceof Error ? reason.message : "Source checks failed."); }
    finally { if (current === request.current) setBusy(""); }
  }
  async function create() {
    if (!inspection?.inspection_token || inspection.batch_id !== selectedId) return;
    const current = ++request.current;
    setBusy("preparing"); setError(null); setPrepared(null);
    try {
      const result = await api.prepareDevInputBatch(selectedId, inspection.inspection_token);
      if (current === request.current) setPrepared(result);
    } catch (reason) {
      if (current === request.current) { setInspection(null); setError(reason instanceof Error ? reason.message : "Workbook preparation failed. Check sources again."); }
    } finally { if (current === request.current) setBusy(""); }
  }
  async function download(kind: "workbook" | "audit" | "package") {
    if (!prepared || prepared.batch_id !== selectedId) return;
    const current = ++request.current;
    setBusy("downloading"); setError(null);
    try {
      const result = await api.downloadDevInputWorkbook(selectedId, prepared.artifact_id, kind);
      if (current !== request.current) return;
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.fileName ?? `${selectedId}.zip`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { if (current === request.current) setError(reason instanceof Error ? reason.message : "Download failed."); }
    finally { if (current === request.current) setBusy(""); }
  }

  async function assessBaseline() {
    if (!valid) return;
    const current = ++request.current;
    setBusy("assessing"); setError(null); setAssessment(null);
    try {
      const result = await api.assessPlaygroundBaseline(selectedId);
      if (current === request.current && result.batch_id === selectedId) setAssessment(result);
    } catch (reason) { if (current === request.current) setError(reason instanceof Error ? reason.message : "Baseline assessment failed."); }
    finally { if (current === request.current) setBusy(""); }
  }
  async function downloadAssessment(kind: "json" | "xlsx") {
    if (!assessment || assessment.batch_id !== selectedId) return;
    const current = ++request.current;
    setBusy("downloading"); setError(null);
    try {
      const result = await api.downloadPlaygroundAssessment(selectedId, assessment.report_id, kind);
      if (current !== request.current) return;
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.fileName ?? `playground-assessment.${kind}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { if (current === request.current) setError(reason instanceof Error ? reason.message : "Report download failed."); }
    finally { if (current === request.current) setBusy(""); }
  }

  return (
    <section className="tab-stack import-management-workspace" aria-label="Dev batch workbook preparation">
      <p className="import-batch-notice">Dev file preparation and read-only Playground comparison are available. Database import remains unavailable.</p>
      {error ? <div className="panel error-banner" role="alert">{error}</div> : null}
      <section className="panel">
        <div className="section-heading"><div><span className="section-kicker">Dev inputs</span><h2>{page === "sourceFiles" ? "Select source batch" : "Selected batch"}</h2></div><button className="ghost-button" type="button" disabled={Boolean(busy)} onClick={() => void refresh()}>Refresh batches</button></div>
        <label className="import-batch-selector" htmlFor="dev-input-batch">Input batch
          <select id="dev-input-batch" value={selectedId} onChange={(event) => select(event.target.value)}>
            <option value="">{busy === "loading" ? "Loading batches…" : "Select a Dev batch"}</option>
            {batches.map((batch) => <option key={batch.batch_id} value={batch.batch_id}>{batch.batch_id}{batch.error ? " — needs attention" : ""}</option>)}
          </select>
        </label>
        {!batches.length && !busy && !error ? <p className="import-empty-state">No Dev batches found. Check the configured Dev input batch folder.</p> : null}
        {selected?.error ? <p role="alert" className="error-banner">{selected.error}</p> : null}
        {valid && selected ? (
          <>
            <p className="panel-copy">Dev / Playground · {selected.manufacturer_srn} · Created {selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}</p>
            <span className="status-pill ok compact">File fingerprints verified</span>
            {page === "sourceFiles" ? (
              <div className="import-source-grid import-batch-file-groups">
                {[["templates", "Device Templates"], ["basic-udi", "Basic UDI-DI Reference"], ["eudamed-xml", "EUDAMED XML Extracts"]].map(([role, title]) => (
                  <div className="import-source-field" key={role}><strong>{title}</strong><ul className="import-selected-files">{selected.files?.filter((file) => file.role === role).map((file) => <li key={file.name}><div><span>{file.name}</span>{file.excluded ? <small className="import-retained-file">Retained evidence · Excluded from preparation</small> : null}<small className="import-retained-file">Source date: {new Date(file.source_modified_at).toLocaleDateString()}</small></div><small>{Math.ceil(file.size_bytes / 1024)} KB</small></li>)}</ul></div>
                ))}
              </div>
            ) : null}
            <p className="panel-copy">These are verified copies in the selected Dev batch. Browser upload of new batches is not connected yet.</p>
          </>
        ) : null}
        {page === "sourceFiles" ? <div className="import-action-row"><button className="action-button" type="button" disabled={!valid || Boolean(busy)} onClick={() => onPageChange("createImportWorkbook")}>Continue to Create Import Workbook</button></div> : null}
      </section>

      {page === "createImportWorkbook" ? (
        <section className="panel">
          <div className="section-heading"><div><span className="section-kicker">Step 2 · Preparation</span><h2>Source checks and workbook</h2></div></div>
          <div className="import-action-row"><button className="action-button" type="button" disabled={!valid || Boolean(busy)} onClick={() => void check()}>{busy === "checking" ? "Checking sources…" : "Check source data"}</button></div>
          {inspection ? (
            <div aria-live="polite">
              <span className={`status-pill ${inspection.inspection_complete ? "ok" : "danger"}`}>{inspection.inspection_complete ? "Source checks completed" : "Source checks blocked"}</span>
              {inspection.errors.map((message) => <p className="error-banner" key={message}>{message}</p>)}
              {inspection.requested_inspection_scope ? (
                <>
                  <div className="import-metric-grid import-batch-file-groups">{[
                    ["Active Template devices", inspection.requested_inspection_scope.distinct_device_identities],
                    ["Exported devices", inspection.exports?.device_records ?? 0],
                    ["Active source findings", inspection.requested_inspection_scope.rows_with_findings],
                    ["Duplicate occurrences", inspection.requested_inspection_scope.duplicate_identity_occurrences],
                  ].map(([label, value]) => <div className="import-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
                  <p className="panel-copy">{inspection.requested_inspection_scope.in_exports} active Template identities appear in the XML exports; {inspection.requested_inspection_scope.export_only} export-only identities.</p>
                  {Object.entries(inspection.requested_inspection_scope.finding_counts).length ? <ul>{Object.entries(inspection.requested_inspection_scope.finding_counts).map(([reason, count]) => <li key={reason}>{reason}: {count}</li>)}</ul> : null}
                  {inspection.requested_inspection_scope.excluded_workbook_names.length ? <p className="panel-copy">Existing exclusion retained: {inspection.requested_inspection_scope.excluded_workbook_names.join(", ")}. Findings in this retained file do not enter the preparation scope.</p> : null}
                  <p className="panel-copy">Source checks cover structure and identities. Workbook preparation performs the existing cross-source checks and lists review-required records.</p>
                </>
              ) : null}
            </div>
          ) : <p className="import-empty-state">Select a batch and check its source data before creating the workbook.</p>}
          <div className="import-action-row">
            <button className="action-button" type="button" disabled={!inspection?.inspection_token || Boolean(busy)} onClick={() => void create()}>{busy === "preparing" ? "Creating workbook…" : "Create Import Workbook"}</button>
            <button className="ghost-button" type="button" onClick={() => onPageChange("sourceFiles")}>Back to Import Source Files</button>
          </div>
          {prepared ? (
            <div className="import-output-summary" aria-live="polite">
              <strong>Import Workbook created for review</strong>
              <p className="panel-copy">{prepared.workbook_name}</p>
              <div className="import-metric-grid import-batch-file-groups">{[
                ["To Register rows", prepared.summary.to_register_tab_rows], ["Registered rows", prepared.summary.registered_tab_rows], ["Requires review", prepared.summary.rows_requiring_review],
              ].map(([label, value]) => <div className="import-metric" key={String(label)}><span>{String(label)}</span><strong>{String(value)}</strong></div>)}</div>
              <p className="panel-copy">Review the Summary worksheet and flagged records. This workbook has not been assessed against or imported into the database.</p>
              <p className="panel-copy">To Register groups Template devices not evidenced by the supplied exports; it does not prove non-registration.</p>
              {prepared.review_examples.length ? <div className="import-exception-table"><table><caption>First {prepared.review_examples.length} review-required records · See the workbook for all findings</caption><thead><tr><th scope="col">Model / device</th><th scope="col">Review required</th></tr></thead><tbody>{prepared.review_examples.map((row) => <tr key={row.key}><td>{row.device_type}<br />{row.catalogue || row.key}</td><td>{row.reasons.join("; ")}</td></tr>)}</tbody></table></div> : null}
              <div className="import-action-row">
                <button className="action-button" type="button" disabled={Boolean(busy)} onClick={() => void download("package")}>Download workbook + audit</button>
                <button className="ghost-button" type="button" disabled={Boolean(busy)} onClick={() => void download("workbook")}>Download workbook</button>
                <button className="ghost-button" type="button" disabled={Boolean(busy)} onClick={() => void download("audit")}>Download audit</button>
                <button className="ghost-button" type="button" onClick={() => onPageChange("assessmentImport")}>View Assess &amp; Import Workbook</button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      {page === "assessmentImport" ? (
        <>
          <section className="panel">
            <div className="section-heading"><div><span className="section-kicker">Playground · Current accepted state</span><h2>Review Playground baseline</h2></div><span className="status-pill compact">Read only</span></div>
            <p className="panel-copy">Compare the selected batch’s XML exports with Dev’s accepted registration evidence. This checks the existing baseline separately from importing the prepared workbook.</p>
            <div className="import-action-row"><button className="action-button" type="button" disabled={!valid || Boolean(busy)} onClick={() => void assessBaseline()}>{busy === "assessing" ? "Comparing accepted state…" : "Assess Playground baseline"}</button></div>
            {assessment ? <div aria-live="polite">
              <p className="panel-copy">{assessment.summary.devices} devices · {assessment.summary.parents} parents · Assessed {new Date(assessment.assessed_at).toLocaleString()}</p>
              <div className="import-metric-grid import-batch-file-groups assessment-primary-metrics" aria-label="Assessment review summary">{[
                ["Value differences", differences.length], ["Devices with differences", changedDevices], ["Devices compared", assessment.summary.devices],
              ].map(([label, value]) => <div className="import-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
              <section className="assessment-differences" aria-labelledby="playground-differences-heading">
                <h3 id="playground-differences-heading">Review value differences</h3>
                <p className="panel-copy">These fields have a known local accepted value that differs from the Playground export. No updates have been applied.</p>
                {differences.length ? <>
                  <p className="panel-copy">{differenceTypes.map(name => `${fieldLabel(name)}: ${differences.filter(({ field }) => field.field === name).length}`).join(" · ")}</p>
                  <div className="import-exception-table"><table aria-label="Value differences"><caption>{differences.length} differences across {changedDevices} devices</caption><thead><tr><th scope="col">Device</th><th scope="col">Field</th><th scope="col">Local accepted value</th><th scope="col">Playground export value</th></tr></thead><tbody>{differences.map(({ device, field }) => <tr key={`${device.issuer}:${device.udi_di}:${field.field}`}>
                    <td>{device.catalogue || device.model}<br /><small>{device.issuer} · {device.udi_di}</small></td><td>{fieldLabel(field.field)}</td><td>{acceptedValue(field.local)}</td><td>{acceptedValue(field.exported)}</td>
                  </tr>)}</tbody></table></div>
                </> : <p className="panel-copy">No value differences found in fields with usable local evidence. Missing evidence and version or identity concerns may still need review.</p>}
              </section>
              <p className="panel-copy">Version or identity concerns: {reviewDevices} devices. Review their notes in the full device comparison below before agreeing a baseline update.</p>
              <div className="import-action-row"><button className="ghost-button" disabled={Boolean(busy)} type="button" onClick={() => void downloadAssessment("xlsx")}>Download assessment Excel</button><button className="ghost-button" disabled={Boolean(busy)} type="button" onClick={() => void downloadAssessment("json")}>Download assessment audit</button></div>
              <details className="assessment-supporting-details"><summary>Evidence completeness and assessment scope</summary>
                <p className="panel-copy">Missing local evidence: {assessment.summary.field_comparisons["Missing local evidence"] ?? 0} individual fields. Matching fields: {assessment.summary.field_comparisons.Matches ?? 0}. These are field counts across all {assessment.summary.devices} devices. Missing evidence is not a proven value difference.</p>
                <p className="panel-copy">Local snapshots: {assessment.summary.full_local_snapshots} full, {assessment.summary.partial_local_snapshots} partial, {assessment.summary.missing_local_snapshots} missing or unusable.</p>
                <p className="panel-copy">{assessment.review_markers.note} Current review markers: {assessment.review_markers.current_count}.</p>
                <ul className="panel-copy">{assessment.limitations.map(note => <li key={note}>{note}</li>)}</ul>
              </details>
              <details className="assessment-supporting-details"><summary>Full device comparison and review notes · {assessment.summary.devices} devices · {reviewDevices} with version or identity concerns</summary>
              <div className="import-exception-table"><table><caption>Accepted state comparison · Expand a device to review fields</caption><thead><tr><th scope="col">Device</th><th scope="col">Outcome</th><th scope="col">Review</th></tr></thead><tbody>{assessment.records.map(row => <tr key={`${row.issuer}:${row.udi_di}`}>
                <td>{row.catalogue}<br /><small>{row.issuer} · {row.udi_di}</small></td><td>{row.outcome}</td><td>
                  {row.warnings.map(warning => <p key={warning}>{warning}</p>)}
                  <details><summary>Compare all fields ({row.fields.filter(field => field.comparison === "Difference found").length} differences; {row.fields.filter(field => field.comparison === "Missing local evidence").length} unknown)</summary>
                    <table><thead><tr><th scope="col">Field</th><th scope="col">Comparison</th><th scope="col">Local accepted</th><th scope="col">Playground</th></tr></thead><tbody>{row.fields.map(field => <tr key={field.field}><td>{field.group} · {fieldLabel(field.field)}<br /><small>{field.local_evidence}</small></td><td>{field.comparison}</td><td>{field.comparison === "Missing local evidence" ? "Unknown" : acceptedValue(field.local)}</td><td>{acceptedValue(field.exported)}</td></tr>)}</tbody></table>
                  </details>
                </td></tr>)}</tbody></table></div>
              </details>
            </div> : null}
          </section>
          <section className="panel"><div className="section-heading"><div><span className="section-kicker">Step 3 · Workbook import</span><h2>Prepared workbook</h2></div></div><p className="panel-copy">{prepared ? `Available for file review: ${prepared.workbook_name}.` : "Create the Import Workbook in Step 2 first."} Workbook database assessment and confirmation are not enabled yet.</p><div className="import-action-row"><button className="ghost-button" type="button" onClick={() => onPageChange("createImportWorkbook")}>Back to Create Import Workbook</button><button className="action-button" type="button" disabled>Assess import</button><button className="ghost-button" type="button" disabled>Confirm database import</button></div></section>
        </>
      ) : null}
    </section>
  );
}
