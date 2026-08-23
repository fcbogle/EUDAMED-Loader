import type { XmlValidationResult } from "../types";

type BulkPostWorkspaceProps = {
  familyVariantLabel: string;
  title: "Bulk POST" | "Bulk UDI-DI POST";
  stepOneTitle: string;
  stepOneCount: number;
  stepOneLabel: string;
  stepOneCopy: string;
  stepOneFooter?: string;
  selectedBulkRecordCount: number;
  onSelectedBulkRecordCountChange: (count: number) => void;
  selectedBulkCapacity: number;
  selectedXmlChunkSequence: number;
  onSelectedXmlChunkSequenceChange: (sequence: number) => void;
  selectedBulkChunkCount: number;
  selectedChunkSummaryText: string;
  selectedBatchValidation: XmlValidationResult | null;
};

export function BulkPostWorkspace({
  familyVariantLabel,
  title,
  stepOneTitle,
  stepOneCount,
  stepOneLabel,
  stepOneCopy,
  stepOneFooter,
  selectedBulkRecordCount,
  onSelectedBulkRecordCountChange,
  selectedBulkCapacity,
  selectedXmlChunkSequence,
  onSelectedXmlChunkSequenceChange,
  selectedBulkChunkCount,
  selectedChunkSummaryText,
  selectedBatchValidation,
}: BulkPostWorkspaceProps) {
  return (
    <div className="draft-list xml-record-stack">
      <div className="draft-card xml-record-card">
        <div className="draft-card-head">
          <strong>{familyVariantLabel}</strong>
          <span className="status-pill ok compact">{title}</span>
        </div>
        <div className="bulk-patch-layout">
          <div className="bulk-patch-config-column">
            <div className="draft-card">
              <div className="draft-card-head">
                <strong>{stepOneTitle}</strong>
                <span className="status-pill ok compact">{stepOneCount} available</span>
              </div>
              <p className="panel-copy">{stepOneCopy}</p>
              <label className="field-label" htmlFor="xml-bulk-post-parent-count">
                {stepOneLabel}
              </label>
              <div className="bulk-parent-chip-row">
                <span className="bulk-parent-chip active">
                  {stepOneCount} {stepOneLabel.toLowerCase()}
                  {stepOneCount === 1 ? "" : "s"}
                </span>
              </div>
              {stepOneFooter ? <p className="panel-copy">{stepOneFooter}</p> : null}
            </div>

            <div className="draft-card">
              <div className="draft-card-head">
                <strong>2. Choose record count</strong>
                <span className="status-pill ok compact">{selectedBulkRecordCount} selected</span>
              </div>
              <p className="panel-copy">Determine scope of this POST.</p>
              <label className="field-label" htmlFor="xml-bulk-record-count">
                Number of devices
              </label>
              <select
                id="xml-bulk-record-count"
                className="rule-select"
                value={selectedBulkRecordCount}
                onChange={(event) => onSelectedBulkRecordCountChange(Number(event.target.value))}
              >
                {Array.from({ length: Math.max(Math.min(selectedBulkCapacity, 300), 1) }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {count} device{count === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>

            <div className="draft-card">
              <div className="draft-card-head">
                <strong>3. Prepare output</strong>
                <span className="status-pill ok compact">
                  Chunk {selectedXmlChunkSequence} of {selectedBulkChunkCount}
                </span>
              </div>
              <p className="panel-copy">Select preview output for your chosen scope.</p>
              <label className="field-label" htmlFor="xml-batch-chunk-sequence">
                Preview chunk
              </label>
              <select
                id="xml-batch-chunk-sequence"
                className="rule-select"
                value={selectedXmlChunkSequence}
                onChange={(event) => onSelectedXmlChunkSequenceChange(Number(event.target.value))}
              >
                {Array.from({ length: selectedBulkChunkCount }, (_, index) => index + 1).map((sequence) => (
                  <option key={sequence} value={sequence}>
                    Chunk {sequence} of {selectedBulkChunkCount}
                  </option>
                ))}
              </select>
              <p className="panel-copy">{selectedChunkSummaryText}</p>
            </div>
          </div>
        </div>
        <div className="validation-pill-row bulk-patch-pill-row">
          <span className="status-pill ok compact bulk-patch-status-pill">Schema target: Message.xsd</span>
          <span
            className={
              selectedBatchValidation?.valid
                ? "status-pill ok compact bulk-patch-status-pill"
                : "status-pill warn compact bulk-patch-status-pill"
            }
          >
            Validation output: {selectedBatchValidation ? (selectedBatchValidation.valid ? "Schema valid" : "Schema invalid") : "Awaiting preview"}
          </span>
        </div>
      </div>
    </div>
  );
}
