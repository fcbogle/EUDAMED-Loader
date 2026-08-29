import type { ChangeEvent, MutableRefObject } from "react";

import type { XmlValidationResult } from "../types";
import { PanelRefreshShell } from "./PanelRefreshShell";

type XmlStructureSection = {
  id: string;
  label: string;
  detail: string;
  lineStart: number;
  lineEnd: number;
};

type BulkMarketInfoPreviewPanelProps = {
  successXmlInputRef: MutableRefObject<HTMLInputElement | null>;
  handleSuccessXmlSelected: (event: ChangeEvent<HTMLInputElement>) => void;
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
  previewStatusMessage: string;
  activePreviewLabel: string;
  selectedBatchValidation: XmlValidationResult | null;
  validationStatusLabel: string;
  selectedSchemaLabel: string | null;
  activePreviewFileName: string | null;
  marketInfoXmlStructureSections: XmlStructureSection[];
  selectedMarketInfoXmlSection: XmlStructureSection | null;
  onSelectSection: (id: string) => void;
  xmlPreviewLines: string;
  marketInfoXmlPreviewLineRefs: MutableRefObject<Record<number, HTMLSpanElement | null>>;
  marketInfoXmlPreviewContainerRef: MutableRefObject<HTMLPreElement | null>;
};

export function BulkMarketInfoPreviewPanel({
  successXmlInputRef,
  handleSuccessXmlSelected,
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
  previewStatusMessage,
  activePreviewLabel,
  selectedBatchValidation,
  validationStatusLabel,
  selectedSchemaLabel,
  activePreviewFileName,
  marketInfoXmlStructureSections,
  selectedMarketInfoXmlSection,
  onSelectSection,
  xmlPreviewLines,
  marketInfoXmlPreviewLineRefs,
  marketInfoXmlPreviewContainerRef,
}: BulkMarketInfoPreviewPanelProps) {
  return (
    <div className="post-preview-card market-info-preview-card bulk-market-info-preview-card">
      <PanelRefreshShell
        isRefreshing={isRefreshing}
        className="post-preview-layout"
        message="Updating the Bulk Market Info preview context for the selected family and variant."
      >
        <div className="post-preview-topbar">
          <div className="post-preview-title-block">
            <h2>Bulk Market Info Preview</h2>
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
              {isGeneratingXml ? "Generating..." : "Generate Bulk Market Info"}
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
              {isDownloadingXml ? "Preparing ZIP..." : "Download Bulk Market Info ZIP"}
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
        <div className="post-preview-summary-row">
          <div className="workflow-note post-preview-status">
            <strong>Preview status</strong>
            <span>{previewStatusMessage}</span>
          </div>
          <div className="xml-preview-meta post-preview-meta">
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
        </div>
        <div className="post-preview-content-grid">
          <div className="post-preview-structure-panel">
            <div className="post-preview-subhead">
              <strong>Bulk Market Info structure</strong>
              <span>Navigate the main Market Info batch message sections.</span>
            </div>
            <div className="post-preview-structure-list">
              {marketInfoXmlStructureSections.map((section) => (
                <button
                  key={section.id}
                  className={selectedMarketInfoXmlSection?.id === section.id ? "post-structure-item active" : "post-structure-item"}
                  type="button"
                  onClick={() => onSelectSection(section.id)}
                >
                  <span className="post-structure-line-range">
                    Lines {section.lineStart + 1}-{section.lineEnd + 1}
                  </span>
                  <strong>{section.label}</strong>
                  <span>{section.detail}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="post-preview-xml-panel">
            <div className="post-preview-subhead">
              <strong>Raw XML preview</strong>
              <span>
                {selectedMarketInfoXmlSection
                  ? `Focused on ${selectedMarketInfoXmlSection.label.toLowerCase()}.`
                  : "Inspect the generated bulk Market Info XML payload."}
              </span>
            </div>
            <pre ref={marketInfoXmlPreviewContainerRef} className="xml-preview-block post-preview-block">
              <code>
                {xmlPreviewLines.split("\n").map((line, index) => {
                  const isInSelectedSection =
                    selectedMarketInfoXmlSection !== null &&
                    index >= selectedMarketInfoXmlSection.lineStart &&
                    index <= selectedMarketInfoXmlSection.lineEnd;
                  return (
                    <span
                      key={`bulk-market-info-xml-line-${index}`}
                      ref={(element) => {
                        marketInfoXmlPreviewLineRefs.current[index] = element;
                      }}
                      className={isInSelectedSection ? "xml-preview-line xml-preview-line-highlight" : "xml-preview-line"}
                    >
                      <span className="xml-preview-line-number">{index + 1}</span>
                      <span className="xml-preview-line-text">{line}</span>
                    </span>
                  );
                })}
              </code>
            </pre>
          </div>
        </div>
      </PanelRefreshShell>
    </div>
  );
}
