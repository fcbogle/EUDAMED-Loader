import type { ChangeEvent, MutableRefObject } from "react";

import type { XmlValidationResult } from "../types";

type XmlStructureSection = {
  id: string;
  label: string;
  detail: string;
  lineStart: number;
  lineEnd: number;
};

type PatchPreviewPanelProps = {
  postSuccessXmlInputRef: MutableRefObject<HTMLInputElement | null>;
  handlePostSuccessXmlSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  canGenerateCurrentXml: boolean;
  canDownloadCurrentXml: boolean;
  isGeneratingXml: boolean;
  isDownloadingXml: boolean;
  isUploadingSuccessXml: boolean;
  onGeneratePreview: () => void;
  onDownload: () => void;
  onUploadClick: () => void;
  xmlActionMessage: string | null;
  patchPreviewStatusMessage: string;
  activePreviewLabel: string;
  selectedBatchValidation: XmlValidationResult | null;
  validationStatusLabel: string;
  selectedSchemaLabel: string | null;
  activePreviewFileName: string | null;
  patchXmlStructureSections: XmlStructureSection[];
  selectedPatchXmlSection: XmlStructureSection | null;
  onSelectSection: (id: string) => void;
  xmlPreviewLines: string;
  patchXmlPreviewLineRefs: MutableRefObject<Record<number, HTMLSpanElement | null>>;
  patchXmlPreviewContainerRef: MutableRefObject<HTMLPreElement | null>;
};

export function PatchPreviewPanel({
  postSuccessXmlInputRef,
  handlePostSuccessXmlSelected,
  canGenerateCurrentXml,
  canDownloadCurrentXml,
  isGeneratingXml,
  isDownloadingXml,
  isUploadingSuccessXml,
  onGeneratePreview,
  onDownload,
  onUploadClick,
  xmlActionMessage,
  patchPreviewStatusMessage,
  activePreviewLabel,
  selectedBatchValidation,
  validationStatusLabel,
  selectedSchemaLabel,
  activePreviewFileName,
  patchXmlStructureSections,
  selectedPatchXmlSection,
  onSelectSection,
  xmlPreviewLines,
  patchXmlPreviewLineRefs,
  patchXmlPreviewContainerRef,
}: PatchPreviewPanelProps) {
  return (
    <div className="post-preview-card patch-preview-card">
      <div className="post-preview-layout">
        <div className="post-preview-topbar">
          <div className="post-preview-title-block">
            <h2>PATCH Preview</h2>
          </div>
          <div className="draft-actions-bar xml-actions-bar post-actions-bar">
            <input
              ref={postSuccessXmlInputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="visually-hidden"
              onChange={handlePostSuccessXmlSelected}
            />
            <button
              className="action-button"
              type="button"
              onClick={onGeneratePreview}
              disabled={!canGenerateCurrentXml || isGeneratingXml || isDownloadingXml || isUploadingSuccessXml}
            >
              {isGeneratingXml ? "Generating..." : "Generate Patch Scenario"}
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
              {isDownloadingXml ? "Preparing ZIP..." : "Download Patch Scenario ZIP"}
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
            <span>{patchPreviewStatusMessage}</span>
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
              <strong>PATCH structure</strong>
              <span>Navigate the main PATCH message sections.</span>
            </div>
            <div className="post-preview-structure-list">
              {patchXmlStructureSections.map((section) => (
                <button
                  key={section.id}
                  className={selectedPatchXmlSection?.id === section.id ? "post-structure-item active" : "post-structure-item"}
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
                {selectedPatchXmlSection
                  ? `Focused on ${selectedPatchXmlSection.label.toLowerCase()}.`
                  : "Inspect the generated XML payload."}
              </span>
            </div>
            <pre ref={patchXmlPreviewContainerRef} className="xml-preview-block post-preview-block">
              <code>
                {xmlPreviewLines.split("\n").map((line, index) => {
                  const isInSelectedSection =
                    selectedPatchXmlSection !== null &&
                    index >= selectedPatchXmlSection.lineStart &&
                    index <= selectedPatchXmlSection.lineEnd;
                  return (
                    <span
                      key={`patch-xml-line-${index}`}
                      ref={(element) => {
                        patchXmlPreviewLineRefs.current[index] = element;
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
