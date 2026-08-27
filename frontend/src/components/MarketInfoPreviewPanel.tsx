import type { MutableRefObject } from "react";

import type { XmlValidationResult } from "../types";

type XmlStructureSection = {
  id: string;
  label: string;
  detail: string;
  lineStart: number;
  lineEnd: number;
};

type MarketInfoPreviewPanelProps = {
  canGenerateCurrentXml: boolean;
  canDownloadCurrentXml: boolean;
  isGeneratingXml: boolean;
  isDownloadingXml: boolean;
  onGeneratePreview: () => void;
  onDownload: () => void;
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

export function MarketInfoPreviewPanel({
  canGenerateCurrentXml,
  canDownloadCurrentXml,
  isGeneratingXml,
  isDownloadingXml,
  onGeneratePreview,
  onDownload,
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
}: MarketInfoPreviewPanelProps) {
  return (
    <div className="post-preview-card market-info-preview-card">
      <div className="post-preview-layout">
        <div className="post-preview-topbar">
          <div className="post-preview-title-block">
            <h2>Market Info Preview</h2>
          </div>
          <div className="draft-actions-bar xml-actions-bar post-actions-bar">
            <button
              className="action-button"
              type="button"
              onClick={onGeneratePreview}
              disabled={!canGenerateCurrentXml || isGeneratingXml || isDownloadingXml}
            >
              {isGeneratingXml ? "Generating..." : "Generate Market Info"}
            </button>
            <button
              className="ghost-button post-secondary-action"
              type="button"
              onClick={onGeneratePreview}
              disabled={!canGenerateCurrentXml || isGeneratingXml || isDownloadingXml}
            >
              Validate Against XSD
            </button>
            <button
              className="ghost-button post-tertiary-action"
              type="button"
              onClick={onDownload}
              disabled={!canDownloadCurrentXml || isGeneratingXml || isDownloadingXml}
            >
              {isDownloadingXml ? "Preparing ZIP..." : "Download Market Info ZIP"}
            </button>
          </div>
        </div>
        {xmlActionMessage ? <div className="save-message post-preview-action-message">{xmlActionMessage}</div> : null}
        {isRefreshing ? (
          <div className="xml-refresh-indicator post-preview-refresh-indicator" aria-live="polite">
            <strong>Refreshing...</strong>
            <span>Updating the Market Info preview context for the selected family and variant.</span>
          </div>
        ) : null}
        <div className="post-preview-summary-row">
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
        <div className="post-preview-content-grid">
          <div className="post-preview-structure-panel">
            <div className="post-preview-subhead">
              <strong>Market Info structure</strong>
              <span>Navigate the main Market Info message sections.</span>
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
                  : "Inspect the generated XML payload."}
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
                      key={`market-info-xml-line-${index}`}
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
      </div>
    </div>
  );
}
