import type { ChangeEvent, MutableRefObject } from "react";

import type { PostRegistrationPreview, XmlValidationResult } from "../types";
import type { XmlWorkspaceRecord } from "../xmlWorkspace";

type XmlStructureSection = {
  id: string;
  label: string;
  detail: string;
  lineStart: number;
  lineEnd: number;
};

type PostPreviewPanelProps = {
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
  xmlPairPreview: PostRegistrationPreview | null;
  selectedPostWorkspaceRecord: XmlWorkspaceRecord | null;
  activePreviewLabel: string;
  selectedBatchValidation: XmlValidationResult | null;
  validationStatusLabel: string;
  selectedSchemaLabel: string | null;
  activePreviewFileName: string | null;
  postXmlStructureSections: XmlStructureSection[];
  selectedPostXmlSection: XmlStructureSection | null;
  onSelectSection: (id: string) => void;
  xmlPreviewLines: string;
  postXmlPreviewLineRefs: MutableRefObject<Record<number, HTMLSpanElement | null>>;
  postXmlPreviewContainerRef: MutableRefObject<HTMLPreElement | null>;
};

export function PostPreviewPanel({
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
  xmlPairPreview,
  selectedPostWorkspaceRecord,
  activePreviewLabel,
  selectedBatchValidation,
  validationStatusLabel,
  selectedSchemaLabel,
  activePreviewFileName,
  postXmlStructureSections,
  selectedPostXmlSection,
  onSelectSection,
  xmlPreviewLines,
  postXmlPreviewLineRefs,
  postXmlPreviewContainerRef,
}: PostPreviewPanelProps) {
  return (
    <div className="post-preview-card">
      <div className="post-preview-layout">
        <div className="post-preview-topbar">
          <div className="post-preview-title-block">
            <h2>POST Preview</h2>
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
              {isGeneratingXml ? "Generating..." : "Generate POST"}
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
              {isDownloadingXml ? "Preparing ZIP..." : "Download POST ZIP"}
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
            <span>
              {xmlPairPreview
                ? `Generated for ${xmlPairPreview.catalogue_number} · ${activePreviewLabel}`
                : selectedPostWorkspaceRecord
                  ? `Awaiting preview for ${selectedPostWorkspaceRecord.catalogue_number}.`
                  : "No available Device UDI-DI POST candidate is currently available for the selected family and variant."}
            </span>
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
              <strong>XML structure</strong>
              <span>Navigate the main POST message sections.</span>
            </div>
            <div className="post-preview-structure-list">
              {postXmlStructureSections.map((section) => (
                <button
                  key={section.id}
                  className={selectedPostXmlSection?.id === section.id ? "post-structure-item active" : "post-structure-item"}
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
                {selectedPostXmlSection
                  ? `Focused on ${selectedPostXmlSection.label.toLowerCase()}.`
                  : "Inspect the generated XML payload."}
              </span>
            </div>
            <pre ref={postXmlPreviewContainerRef} className="xml-preview-block post-preview-block">
              <code>
                {xmlPreviewLines.split("\n").map((line, index) => {
                  const isInSelectedSection =
                    selectedPostXmlSection !== null &&
                    index >= selectedPostXmlSection.lineStart &&
                    index <= selectedPostXmlSection.lineEnd;
                  return (
                    <span
                      key={`post-xml-line-${index}`}
                      ref={(element) => {
                        postXmlPreviewLineRefs.current[index] = element;
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
