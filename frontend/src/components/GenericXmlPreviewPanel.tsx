import type { XmlValidationResult } from "../types";

type GenericXmlPreviewPanelProps = {
  title: string;
  useBulkMetaLayout: boolean;
  activePreviewLabel: string;
  selectedBatchValidation: XmlValidationResult | null;
  validationStatusLabel: string;
  selectedSchemaLabel: string | null;
  activePreviewFileName: string | null;
  previewStatusMessage: string;
  xmlPreviewLines: string;
};

export function GenericXmlPreviewPanel({
  title,
  useBulkMetaLayout,
  activePreviewLabel,
  selectedBatchValidation,
  validationStatusLabel,
  selectedSchemaLabel,
  activePreviewFileName,
  previewStatusMessage,
  xmlPreviewLines,
}: GenericXmlPreviewPanelProps) {
  return (
    <>
      <div>
        <div className="section-heading xml-preview-heading">
          <div>
            <span className="section-kicker">Preview</span>
            <h2>{title}</h2>
          </div>
        </div>
        <div className={useBulkMetaLayout ? "xml-preview-meta bulk-patch-preview-meta" : "xml-preview-meta"}>
          <div className="xml-preview-meta-block">
            <span className="summary-label">Active view</span>
            <strong>{activePreviewLabel}</strong>
          </div>
          <div className="xml-preview-meta-block">
            <span className="summary-label">Validation</span>
            <span className={selectedBatchValidation?.valid ? "status-pill ok compact" : "status-pill warn compact"}>
              {validationStatusLabel}
            </span>
          </div>
          <div className="xml-preview-meta-block">
            <span className="summary-label">Schema</span>
            <strong>{selectedSchemaLabel ?? "Message.xsd pending"}</strong>
          </div>
          <div className="xml-preview-meta-block">
            <span className="summary-label">File</span>
            <strong>{activePreviewFileName ?? "Not generated yet"}</strong>
          </div>
        </div>
        <div className="workflow-note">
          <strong>Preview status</strong>
          <span>{previewStatusMessage}</span>
        </div>
      </div>
      <pre className="xml-preview-block">
        <code>{xmlPreviewLines}</code>
      </pre>
    </>
  );
}
