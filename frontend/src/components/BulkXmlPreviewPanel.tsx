import type { ChangeEvent, MutableRefObject } from "react";

import type { XmlValidationResult } from "../types";

type BulkXmlPreviewPanelProps = {
  successXmlInputRef: MutableRefObject<HTMLInputElement | null>;
  handleSuccessXmlSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  title: string;
  generateButtonLabel: string;
  downloadButtonLabel: string;
  canGenerateCurrentXml: boolean;
  canDownloadCurrentXml: boolean;
  isGeneratingXml: boolean;
  isDownloadingXml: boolean;
  isUploadingSuccessXml: boolean;
  onGeneratePreview: () => void;
  onDownload: () => void;
  onUploadClick: () => void;
  xmlActionMessage: string | null;
  isRefreshing: boolean;
  activePreviewLabel: string;
  selectedBatchValidation: XmlValidationResult | null;
  validationStatusLabel: string;
  selectedSchemaLabel: string | null;
  activePreviewFileName: string | null;
  previewStatusMessage: string;
  xmlPreviewLines: string;
};

export function BulkXmlPreviewPanel({
  successXmlInputRef,
  handleSuccessXmlSelected,
  title,
  generateButtonLabel,
  downloadButtonLabel,
  canGenerateCurrentXml,
  canDownloadCurrentXml,
  isGeneratingXml,
  isDownloadingXml,
  isUploadingSuccessXml,
  onGeneratePreview,
  onDownload,
  onUploadClick,
  xmlActionMessage,
  isRefreshing,
  activePreviewLabel,
  selectedBatchValidation,
  validationStatusLabel,
  selectedSchemaLabel,
  activePreviewFileName,
  previewStatusMessage,
  xmlPreviewLines,
}: BulkXmlPreviewPanelProps) {
  return (
    <div className="post-preview-card bulk-preview-card">
      <div className="post-preview-layout">
        <div className="post-preview-topbar">
          <div className="post-preview-title-block">
            <h2>{title}</h2>
          </div>
          <div className="draft-actions-bar xml-actions-bar post-actions-bar">
            <input
              ref={successXmlInputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="visually-hidden"
              onChange={handleSuccessXmlSelected}
            />
            <button
              className="action-button"
              type="button"
              onClick={onGeneratePreview}
              disabled={!canGenerateCurrentXml || isGeneratingXml || isDownloadingXml || isUploadingSuccessXml}
            >
              {isGeneratingXml ? "Generating..." : generateButtonLabel}
            </button>
            <button
              className="ghost-button post-secondary-action"
              type="button"
              onClick={onGeneratePreview}
              disabled={!canGenerateCurrentXml || isGeneratingXml || isDownloadingXml || isUploadingSuccessXml}
            >
              Validate Against XSD
            </button>
            <button
              className="ghost-button post-tertiary-action"
              type="button"
              onClick={onDownload}
              disabled={!canDownloadCurrentXml || isGeneratingXml || isDownloadingXml || isUploadingSuccessXml}
            >
              {isDownloadingXml ? "Preparing ZIP..." : downloadButtonLabel}
            </button>
            <button
              className="ghost-button post-tertiary-action"
              type="button"
              onClick={onUploadClick}
              disabled={isGeneratingXml || isDownloadingXml || isUploadingSuccessXml}
            >
              {isUploadingSuccessXml ? "Uploading Success XML..." : "Upload Success XML"}
            </button>
          </div>
        </div>
        {xmlActionMessage ? <div className="save-message post-preview-action-message">{xmlActionMessage}</div> : null}
        {isRefreshing ? (
          <div className="xml-refresh-indicator post-preview-refresh-indicator" aria-live="polite">
            <strong>Refreshing...</strong>
            <span>Updating the bulk preview context for the selected family and variant.</span>
          </div>
        ) : null}
        <div className="post-preview-summary-row bulk-preview-summary-row">
          <div className="workflow-note post-preview-status">
            <strong>Preview status</strong>
            <span>{previewStatusMessage}</span>
            {isRefreshing ? <span className="xml-refresh-inline">Refreshing...</span> : null}
          </div>
          <div className="xml-preview-meta post-preview-meta">
            <div className="xml-preview-meta-block">
              <span className="summary-label">Active view</span>
              <strong>{activePreviewLabel}</strong>
              {isRefreshing ? <span className="xml-refresh-inline">Refreshing...</span> : null}
            </div>
            <div className="xml-preview-meta-block">
              <span className="summary-label">Validation</span>
              <span className={selectedBatchValidation?.valid ? "status-pill ok compact" : "status-pill warn compact"}>
                {validationStatusLabel}
              </span>
              {isRefreshing ? <span className="xml-refresh-inline">Refreshing...</span> : null}
            </div>
            <div className="xml-preview-meta-block">
              <span className="summary-label">Schema</span>
              <strong>{selectedSchemaLabel ?? "Message.xsd pending"}</strong>
              {isRefreshing ? <span className="xml-refresh-inline">Refreshing...</span> : null}
            </div>
            <div className="xml-preview-meta-block">
              <span className="summary-label">File</span>
              <strong>{activePreviewFileName ?? "Not generated yet"}</strong>
              {isRefreshing ? <span className="xml-refresh-inline">Refreshing...</span> : null}
            </div>
          </div>
        </div>
        <div className="post-preview-xml-panel bulk-preview-xml-panel">
          <div className="post-preview-subhead">
            <strong>Raw XML preview</strong>
            <span>Inspect the generated XML package for the current chunk before validation or download.</span>
          </div>
          <pre className="xml-preview-block post-preview-block">
            <code>{xmlPreviewLines}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
