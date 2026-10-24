import { useState } from "react";

type RegistrationStatus = "Registered" | "Unregistered" | "Unknown";
type ExampleDevice = { model: string; catalogue: string; parent: RegistrationStatus; device: RegistrationStatus; parentVersion: string; version: string; marketVersion: string };
const EXAMPLE_DEVICES: ExampleDevice[] = [
  { model: "Example Model A", catalogue: "DEMO-001", parent: "Registered", device: "Registered", parentVersion: "1", version: "2", marketVersion: "1" },
  { model: "Example Model A", catalogue: "DEMO-002", parent: "Registered", device: "Unregistered", parentVersion: "1", version: "—", marketVersion: "—" },
  { model: "Example Model A", catalogue: "DEMO-003", parent: "Unknown", device: "Unknown", parentVersion: "Unknown", version: "—", marketVersion: "—" },
  { model: "Example Model B", catalogue: "DEMO-004", parent: "Registered", device: "Registered", parentVersion: "1", version: "1", marketVersion: "Unknown" },
  { model: "Example Model B", catalogue: "DEMO-005", parent: "Unregistered", device: "Unregistered", parentVersion: "—", version: "—", marketVersion: "—" },
  { model: "Example Model B", catalogue: "DEMO-006", parent: "Registered", device: "Registered", parentVersion: "1", version: "3", marketVersion: "2" },
];
type ComparisonOutcome = "Matches" | "Difference found" | "Unable to compare";
const EXAMPLE_COMPARISON: { model: string; catalogue: string; outcome: ComparisonOutcome; detail: string; action: string; owner: string }[] = [
  { model: "Example Model A", catalogue: "DEMO-001", outcome: "Matches", detail: "Device version and recorded market information agree.", action: "No action for the compared fields.", owner: "—" },
  { model: "Example Model B", catalogue: "DEMO-006", outcome: "Difference found", detail: "Device version: snapshot 3; XML extract 4.", action: "Review the response history and the dates of both inputs.", owner: "Enterprise Solutions" },
  { model: "Example Model A", catalogue: "DEMO-003", outcome: "Unable to compare", detail: "Device absent from the supplied export; export coverage is unconfirmed.", action: "Confirm export scope and obtain missing pages if needed.", owner: "Enterprise Solutions" },
];

export function ReportingWorkspace({ page, environment, onPageChange }: {
  page: "registrationSnapshot" | "eudamedComparison";
  environment: "dev" | "prod" | null;
  onPageChange: (page: "registrationSnapshot" | "eudamedComparison") => void;
}) {
  const [model, setModel] = useState("");
  const [status, setStatus] = useState("");
  const [snapshotExample, setSnapshotExample] = useState(false);
  const [comparisonExample, setComparisonExample] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState("");
  const [xmlFiles, setXmlFiles] = useState<File[]>([]);
  const [outcome, setOutcome] = useState("");
  const rows = EXAMPLE_DEVICES.filter((row) => (!model || row.model === model) && (!status || row.device === status));
  const comparisonRows = EXAMPLE_COMPARISON.filter((row) => !outcome || row.outcome === outcome);
  const invalidXml = xmlFiles.some((file) => !/\.xml$/i.test(file.name));
  const environmentLabel = environment === "dev" ? "Dev / Playground" : environment === "prod" ? "Production" : "Unconfirmed";

  return (
    <section className="tab-stack reporting-workspace" aria-label={page === "registrationSnapshot" ? "Registration Snapshot workspace" : "EUDAMED Comparison workspace"}>
      <div className="import-preview-notice" role="note">
        <span className="status-pill warn">UI preview</span>
        <span>Examples are synthetic. Snapshot creation, XML upload, comparison and report downloads are not yet available.</span>
      </div>
      {page === "registrationSnapshot" ? (
        <>
          <section className="panel">
            <div className="section-heading">
              <div><span className="section-kicker">Scope</span><h2>Snapshot scope</h2></div>
              <span className="status-pill compact">{environmentLabel}</span>
            </div>
            <p className="panel-copy">Choose the models and registration position to include in a dated Excel snapshot.</p>
            <div className="reporting-controls">
              <label htmlFor="snapshot-model">Device model
                <select id="snapshot-model" value={model} onChange={(event) => setModel(event.target.value)}>
                  <option value="">All models</option>
                  <option value="Example Model A">Example Model A (synthetic)</option>
                  <option value="Example Model B">Example Model B (synthetic)</option>
                </select>
              </label>
              <label htmlFor="snapshot-status">Device registration
                <select id="snapshot-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">All statuses</option>
                  <option>Registered</option><option>Unregistered</option><option>Unknown</option>
                </select>
              </label>
            </div>
            <div className="import-action-row">
              <button className="action-button" type="button" disabled>Create Excel Snapshot</button>
              <button className="ghost-button" type="button" onClick={() => setSnapshotExample((previous) => !previous)}>{snapshotExample ? "Hide example snapshot" : "View example snapshot"}</button>
              <button className="ghost-button" type="button" onClick={() => { setModel(""); setStatus(""); }}>Reset filters</button>
            </div>
            <p className="panel-copy">One worksheet per device model, using its Template layout. Parent and device registration remain separate.</p>
          </section>
          <section className="panel">
            <div className="section-heading"><div><span className="section-kicker">Preview</span><h2>Registration position</h2></div></div>
            {snapshotExample ? (
              <>
                <p className="import-example-label" role="note">Synthetic example — these devices and counts are not application records.</p>
                <Metrics values={[
                  ["Visible devices", rows.length],
                  ["Registered", rows.filter((row) => row.device === "Registered").length],
                  ["Unregistered", rows.filter((row) => row.device === "Unregistered").length],
                  ["Unknown", rows.filter((row) => row.device === "Unknown").length],
                ]} />
                <div className="reporting-status-legend" aria-label="Registration status legend">
                  {(["Registered", "Unregistered", "Unknown"] as const).map((value) => <RegistrationBadge key={value} value={value} />)}
                </div>
                <div className="import-exception-table">
                  <table>
                    <caption>Illustrative preview — Excel worksheets will retain each model’s Template columns</caption>
                    <thead><tr><th scope="col">Model</th><th scope="col">Catalogue</th><th scope="col">Basic UDI-DI status</th><th scope="col">Device UDI-DI status</th><th scope="col">Parent version</th><th scope="col">Device version</th><th scope="col">Market Info version</th></tr></thead>
                    <tbody>{rows.map((row) => <tr key={row.catalogue}><td>{row.model}</td><td>{row.catalogue}</td><td><RegistrationBadge value={row.parent} /></td><td><RegistrationBadge value={row.device} /></td><td>{row.parentVersion}</td><td>{row.version}</td><td>{row.marketVersion}</td></tr>)}</tbody>
                  </table>
                </div>
                {!rows.length ? <p className="import-empty-state">No example devices match these filters.</p> : null}
                <p className="panel-copy">Unknown means evidence is unresolved. A registered parent can have unregistered children.</p>
              </>
            ) : <p className="import-empty-state">No snapshot generated. View the synthetic example to explore the layout.</p>}
          </section>
          <section className="panel">
            <div className="section-heading"><div><span className="section-kicker">Saved reports</span><h2>Snapshot history</h2></div></div>
            <p className="panel-copy">Saved snapshots will retain the date, environment, manufacturer, scope and source references for reproducible comparison.</p>
            <p className="import-empty-state">No saved snapshots are connected in this preview.</p>
            <div className="import-action-row"><button className="ghost-button" type="button" onClick={() => onPageChange("eudamedComparison")}>Go to EUDAMED Comparison</button></div>
          </section>
        </>
      ) : (
        <>
          <section className="panel">
            <div className="section-heading">
              <div><span className="section-kicker">Inputs</span><h2>Select snapshot and XML extracts</h2></div>
              <span className="status-pill compact">{environmentLabel}</span>
            </div>
            <div className="reporting-controls">
              <label htmlFor="comparison-snapshot">Saved application snapshot
                <select id="comparison-snapshot" value={selectedSnapshot} onChange={(event) => setSelectedSnapshot(event.target.value)}>
                  <option value="">Select a snapshot</option>
                  <option value="synthetic">Synthetic example snapshot (not a saved report)</option>
                </select>
              </label>
              <div className="reporting-file-field">
                <label htmlFor="comparison-xml">EUDAMED XML extracts</label>
                <input id="comparison-xml" type="file" accept=".xml" multiple aria-invalid={invalidXml || undefined} aria-describedby="comparison-xml-status" onChange={(event) => setXmlFiles(Array.from(event.target.files ?? []))} />
                <p id="comparison-xml-status" className="panel-copy" aria-live="polite">{invalidXml ? "Unsupported file type. Select XML files." : xmlFiles.length ? `${xmlFiles.length} selected locally · Not uploaded` : "No XML files selected."}</p>
                {xmlFiles.length ? <ul className="import-selected-files">{xmlFiles.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><small>{Math.ceil(file.size / 1024)} KB</small></li>)}</ul> : null}
              </div>
            </div>
            <div className="import-action-row">
              <button className="action-button" type="button" disabled>Upload and compare</button>
              <button className="ghost-button" type="button" onClick={() => setComparisonExample((previous) => !previous)}>{comparisonExample ? "Hide example comparison" : "View example comparison"}</button>
              <button className="ghost-button" type="button" onClick={() => onPageChange("registrationSnapshot")}>Go to Registration Snapshot</button>
            </div>
            <p className="panel-copy">Use exports from the same environment and manufacturer. Retain all pages and record export dates and filters.</p>
          </section>
          <section className="panel">
            <div className="section-heading"><div><span className="section-kicker">Results</span><h2>Comparison outcomes</h2></div><button className="ghost-button" type="button" disabled>Download comparison report</button></div>
            {comparisonExample ? (
              <>
                <p className="import-example-label" role="note">Synthetic example — results are independent of the selected snapshot and XML files.</p>
                <Metrics values={[["Records reviewed", 3], ["Matches", 1], ["Differences found", 1], ["Unable to compare", 1]]} />
                <div className="reporting-controls">
                  <label htmlFor="comparison-outcome">Outcome
                    <select id="comparison-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)}>
                      <option value="">All outcomes</option><option>Matches</option><option>Difference found</option><option>Unable to compare</option>
                    </select>
                  </label>
                </div>
                <div className="import-exception-table">
                  <table>
                    <caption>Example comparison details · {comparisonRows.length} visible</caption>
                    <thead><tr><th scope="col">Model / device</th><th scope="col">Outcome</th><th scope="col">Finding</th><th scope="col">Required action</th><th scope="col">Owner</th></tr></thead>
                    <tbody>{comparisonRows.map((row) => <tr key={row.catalogue}><td>{row.model}<br />{row.catalogue}</td><td><span className={`status-pill compact ${row.outcome === "Matches" ? "ok" : row.outcome === "Difference found" ? "warn" : "reporting-status-unknown"}`}>{row.outcome}</span></td><td>{row.detail}</td><td>{row.action}</td><td>{row.owner}</td></tr>)}</tbody>
                  </table>
                </div>
                <p className="panel-copy">Missing export coverage means Unable to compare, not proof of non-registration. Unknown versions remain unknown.</p>
              </>
            ) : <p className="import-empty-state">No comparison has been performed. View the synthetic example to explore the results.</p>}
          </section>
        </>
      )}
    </section>
  );
}

function RegistrationBadge({ value }: { value: RegistrationStatus }) {
  return <span className={`status-pill compact reporting-status-${value.toLowerCase()}`}>{value}</span>;
}

function Metrics({ values }: { values: [string, number][] }) {
  return <div className="import-metric-grid">{values.map(([label, value]) => <div className="import-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}
