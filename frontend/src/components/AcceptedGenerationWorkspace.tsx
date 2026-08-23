import type { XmlWorkspaceRecord } from "../xmlWorkspace";

type AcceptedXmlMode = {
  id: string;
  label: string;
  status: string;
  summary: string;
};

type AcceptedGenerationWorkspaceProps = {
  acceptedXmlModes: AcceptedXmlMode[];
  patchScenarioCount: number;
  xmlReadyRecordCount: number;
  selectedPostWorkspaceRecord: XmlWorkspaceRecord | null;
  xmlPairPreviewPostXml: string | null;
  acceptedPreviewPlaceholder: string;
  isGeneratingXml: boolean;
  isDownloadingXml: boolean;
  xmlActionMessage: string | null;
  onGeneratePreview: () => void;
  onDownload: () => void;
};

export function AcceptedGenerationWorkspace({
  acceptedXmlModes,
  patchScenarioCount,
  xmlReadyRecordCount,
  selectedPostWorkspaceRecord,
  xmlPairPreviewPostXml,
  acceptedPreviewPlaceholder,
  isGeneratingXml,
  isDownloadingXml,
  xmlActionMessage,
  onGeneratePreview,
  onDownload,
}: AcceptedGenerationWorkspaceProps) {
  return (
    <section className="tab-stack">
      <section className="summary-grid">
        <div className="summary-card">
          <span className="summary-label">Accepted XML patterns</span>
          <strong>{acceptedXmlModes.length}</strong>
          <p>Only user-confirmed EUDAMED accepted patterns appear in this workspace.</p>
        </div>
        <div className="summary-card">
          <span className="summary-label">Current accepted mode</span>
          <strong>POST</strong>
          <p>The accepted baseline POST remains the operationally enabled XML generation path.</p>
        </div>
        <div className="summary-card">
          <span className="summary-label">Candidate PATCH scenarios</span>
          <strong>{patchScenarioCount}</strong>
          <p>Candidate PATCH scenarios remain available in EUDAMED Testing until promoted.</p>
        </div>
        <div className="summary-card">
          <span className="summary-label">Validation-ready rows</span>
          <strong>{xmlReadyRecordCount}</strong>
          <p>Accepted generation is still downstream of canonical validation.</p>
        </div>
      </section>

      <section className="panel xml-full-workspace-panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Accepted XML Only</span>
            <h2>EUDAMED Generation Workspace</h2>
          </div>
        </div>
        <p className="panel-copy">
          Only `EUDAMED Accepted` XML patterns are available here. Use `EUDAMED Testing` to review and promote candidate patterns.
        </p>
        <div className="draft-list xml-record-stack">
          {acceptedXmlModes.map((mode) => (
            <div className="draft-card xml-record-card" key={mode.id}>
              <div className="draft-card-head">
                <strong>{mode.label}</strong>
                <span className="status-pill ok compact">{mode.status}</span>
              </div>
              <p className="panel-copy">{mode.summary}</p>
            </div>
          ))}
        </div>
        {selectedPostWorkspaceRecord ? (
          <div className="xml-focus-layout">
            <div className="xml-preview-surface">
              <div className="section-heading xml-preview-heading">
                <div>
                  <span className="section-kicker">Accepted Preview</span>
                  <h2>POST</h2>
                </div>
              </div>
              <pre className="xml-preview-block">
                <code>{xmlPairPreviewPostXml ?? acceptedPreviewPlaceholder}</code>
              </pre>
            </div>
            <div className="xml-sidebar-surface">
              <div className="draft-actions-bar xml-actions-bar">
                <button
                  className="action-button"
                  type="button"
                  onClick={onGeneratePreview}
                  disabled={!selectedPostWorkspaceRecord || isGeneratingXml || isDownloadingXml}
                >
                  {isGeneratingXml ? "Generating..." : "Generate Accepted POST"}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={onGeneratePreview}
                  disabled={!selectedPostWorkspaceRecord || isGeneratingXml || isDownloadingXml}
                >
                  Validate Against XSD
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={onDownload}
                  disabled={!selectedPostWorkspaceRecord || isGeneratingXml || isDownloadingXml}
                >
                  {isDownloadingXml ? "Preparing ZIP..." : "Download POST Package"}
                </button>
                {xmlActionMessage ? <span className="save-message">{xmlActionMessage}</span> : null}
              </div>
              <div className="draft-list xml-record-stack">
                <div className="draft-card xml-record-card">
                  <div className="draft-card-head">
                    <strong>{selectedPostWorkspaceRecord.catalogue_number}</strong>
                    <span className="status-pill ok compact">EUDAMED Accepted</span>
                  </div>
                  <p className="draft-meta">
                    {selectedPostWorkspaceRecord.product_family} / {selectedPostWorkspaceRecord.product_variant}
                  </p>
                  <p className="panel-copy">Generate only the accepted baseline `POST` in this workspace.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="panel-copy">No XML-ready POST record is currently available for accepted `POST` generation for the selected family and variant.</p>
        )}
      </section>
    </section>
  );
}
