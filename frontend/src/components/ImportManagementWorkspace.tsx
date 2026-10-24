import { useState } from "react";

type SourceKind = "templates" | "basicUdi" | "xml";
type SourceField = { id: SourceKind; title: string; help: string; multiple: boolean; accept: string };
const SOURCE_FIELDS: SourceField[] = [
  { id: "templates", title: "Device Templates", help: "Select one or more device Template workbooks.", multiple: true, accept: ".xlsx,.xlsm" },
  { id: "basicUdi", title: "Basic UDI-DI Reference", help: "Select the Basic UDI-DI Excel workbook.", multiple: false, accept: ".xlsx,.xlsm" },
  { id: "xml", title: "EUDAMED XML Extracts", help: "Select all exported XML files for the intended scope.", multiple: true, accept: ".xml" },
];
const EXAMPLE_EXCEPTIONS = [
  { device: "Example Model A / DEMO-021", issue: "Basic UDI-DI missing from reference workbook", action: "Confirm the parent reference before preparing this device." },
  { device: "Example Model B / DEMO-022", issue: "Conflicting device details in Template workbooks", action: "Resolve the source values before preparing this device." },
];

export function ImportManagementWorkspace({ page, onPageChange }: {
  page: "sourceFiles" | "createImportWorkbook" | "assessmentImport";
  onPageChange: (page: "sourceFiles" | "createImportWorkbook" | "assessmentImport") => void;
}) {
  const [files, setFiles] = useState<Record<SourceKind, File[]>>({ templates: [], basicUdi: [], xml: [] });
  const [exampleVisible, setExampleVisible] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const selectedCount = Object.values(files).reduce((total, entries) => total + entries.length, 0);

  return (
    <section className="tab-stack import-management-workspace" aria-label={page === "sourceFiles" ? "Import Source Files workspace" : page === "createImportWorkbook" ? "Create Import Workbook workspace" : "Assess and Import Workbook workspace"}>
      <div className="import-preview-notice" role="note">
        <span className="status-pill warn">UI preview</span>
        <span>Files stay in your browser. Upload, checks, workbook creation and database import are not yet available.</span>
      </div>

      {page === "sourceFiles" ? (
        <>
          <section className="panel">
            <div className="section-heading">
              <div><span className="section-kicker">Step 1 · Inputs</span><h2>Source files</h2></div>
              <span className="status-pill compact">{selectedCount} selected locally</span>
            </div>
            <div className="import-source-grid">
              {SOURCE_FIELDS.map((field) => {
                const entries = files[field.id];
                const invalid = entries.some((file) => !(field.id === "xml" ? /\.xml$/i : /\.(xlsx|xlsm)$/i).test(file.name));
                return (
                  <div className="import-source-field" key={field.id}>
                    <label htmlFor={`import-${field.id}`}>{field.title}</label>
                    <p id={`import-${field.id}-help`} className="panel-copy">{field.help}</p>
                    <input
                      id={`import-${field.id}`}
                      type="file"
                      accept={field.accept}
                      multiple={field.multiple}
                      aria-describedby={`import-${field.id}-help import-${field.id}-status`}
                      aria-invalid={invalid || undefined}
                      onChange={(event) => {
                        setFiles((previous) => ({ ...previous, [field.id]: Array.from(event.target.files ?? []) }));
                        setReviewConfirmed(false);
                      }}
                    />
                    <div id={`import-${field.id}-status`} aria-live="polite">
                      <span className={`status-pill compact ${invalid ? "danger" : ""}`}>
                        {invalid ? "Unsupported file type" : entries.length ? "Selected locally · Not uploaded" : "No files selected"}
                      </span>
                      {entries.length ? <ul className="import-selected-files">{entries.map((file, index) => (
                        <li key={`${file.name}-${index}`}><span>{file.name}</span><small>{Math.ceil(file.size / 1024)} KB</small></li>
                      ))}</ul> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="import-action-row">
              <button className="action-button" type="button" disabled>Upload files</button>
              <span className="panel-copy">Selected files have not been uploaded or checked.</span>
            </div>
            <div className="import-action-row">
              <button className="ghost-button" type="button" onClick={() => onPageChange("createImportWorkbook")}>Continue to Create Import Workbook</button>
            </div>
          </section>
        </>
      ) : page === "createImportWorkbook" ? (
          <section className="panel">
            <div className="section-heading">
              <div><span className="section-kicker">Step 2 · Preparation</span><h2>Source checks and workbook</h2></div>
              <button className="ghost-button" type="button" onClick={() => {
                setExampleVisible((previous) => !previous);
                setReviewConfirmed(false);
              }}>
                {exampleVisible ? "Hide example results" : "View example results"}
              </button>
            </div>
            <p className="panel-copy">Review source checks and exceptions before creating the Excel Import Workbook.</p>
            <p className="panel-copy">{selectedCount} source files selected locally. Upload and checks remain unavailable in this preview.</p>
            <div className="import-action-row">
              <button className="action-button" type="button" disabled>Check source data</button>
            </div>
            {exampleVisible ? <ExampleResults /> : <p className="import-empty-state">No source checks have been run.</p>}
            <div className="import-output-summary">
              <strong>Import Workbook (.xlsx)</strong>
              <p className="panel-copy">To Register, Registered and Summary worksheets, with a linked audit file managed by the application.</p>
            </div>
            <div className="import-action-row">
              <button className="action-button" type="button" disabled>Create Import Workbook</button>
              <button className="ghost-button" type="button" disabled>Download workbook</button>
              <button className="ghost-button" type="button" onClick={() => onPageChange("sourceFiles")}>Back to Import Source Files</button>
              <button className="ghost-button" type="button" onClick={() => onPageChange("assessmentImport")}>Continue to Assess &amp; Import Workbook</button>
            </div>
            <p className="panel-copy">Workbook creation prepares files for review. Database import requires a separate assessment and confirmation.</p>
          </section>
      ) : (
        <>
          <section className="panel">
            <div className="section-heading">
              <div><span className="section-kicker">Step 3 · Prepared input</span><h2>Prepared workbook</h2></div>
            </div>
            <p className="panel-copy">The workbook and its linked audit will appear here after Step 2: Create Import Workbook.</p>
            <div className="import-output-summary">
              <strong>No Import Workbook available</strong>
              <p className="panel-copy">The active environment and file details must be confirmed before assessment.</p>
            </div>
            <div className="import-action-row">
              <button className="ghost-button" type="button" onClick={() => onPageChange("createImportWorkbook")}>Back to Create Import Workbook</button>
              <button className="action-button" type="button" disabled>Assess import</button>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div><span className="section-kicker">Review</span><h2>Import assessment</h2></div>
              <button className="ghost-button" type="button" onClick={() => {
                setExampleVisible((previous) => !previous);
                setReviewConfirmed(false);
              }}>{exampleVisible ? "Hide example results" : "View example assessment"}</button>
            </div>
            <p className="panel-copy">Review new, unchanged and blocked records against the current application state.</p>
            {exampleVisible ? <ExampleResults assessment /> : <p className="import-empty-state">No import assessment has been run.</p>}
            <label className="import-review-confirmation">
              <input type="checkbox" disabled={!exampleVisible} checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} />
              {exampleVisible ? "Example only: I have reviewed the assessment and exceptions." : "I have reviewed the assessment and exceptions."}
            </label>
            <div className="import-action-row">
              <button className="action-button" type="button" disabled>Confirm database import</button>
              <button className="ghost-button" type="button" disabled>Download assessment report</button>
            </div>
            <p className="panel-copy">Confirmation remains unavailable in this preview, including when the example review box is selected.</p>
          </section>
          <section className="panel">
            <div className="section-heading"><div><span className="section-kicker">Outcome</span><h2>Import result</h2></div></div>
            <p className="panel-copy">No database import has been performed. Completed counts and the result report will appear here.</p>
          </section>
        </>
      )}
    </section>
  );
}

function ExampleResults({ assessment = false }: { assessment?: boolean }) {
  return (
    <div className="import-example-results">
      <p className="import-example-label" role="note">Synthetic example — these results do not describe your selected files or application data.</p>
      <div className="import-metric-grid">
        {[
          ["Records", "22"],
          [assessment ? "New" : "To Register", "12"],
          [assessment ? "Unchanged" : "Registered", "8"],
          ["Needs review", "2"],
        ].map(([label, value]) => <div className="import-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="import-exception-table">
        <table>
          <caption>Example exceptions — 2 records excluded pending review</caption>
          <thead><tr><th scope="col">Device</th><th scope="col">Issue</th><th scope="col">Required action</th></tr></thead>
          <tbody>{EXAMPLE_EXCEPTIONS.map((entry) => <tr key={entry.device}><td>{entry.device}</td><td>{entry.issue}</td><td>{entry.action}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="panel-copy">Example position: 20 records eligible; 2 require source correction and reassessment.</p>
    </div>
  );
}
