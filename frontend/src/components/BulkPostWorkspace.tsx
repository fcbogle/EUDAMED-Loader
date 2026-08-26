import type { XmlValidationResult } from "../types";

import { XmlAssessmentCard } from "./XmlAssessmentCard";
import { XmlStatusStrip } from "./XmlStatusStrip";
import { XmlWorkspaceHeader } from "./XmlWorkspaceHeader";

type BulkPostWorkspaceProps = {
  familyVariantLabel: string;
  title: string;
  isRefreshing: boolean;
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
  isRefreshing,
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
        <XmlWorkspaceHeader
          title={familyVariantLabel}
          statusLabel={title}
          subtitle="Review the current bulk POST scope, package size, and preview chunk for this family and variant."
        />
        <div className="bulk-patch-layout">
          <div className="bulk-patch-config-column">
            <XmlAssessmentCard
              title={stepOneTitle}
              statusLabel={`${stepOneCount} available`}
              subtitle="Current registration scope"
              isRefreshing={isRefreshing}
            >
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
            </XmlAssessmentCard>

            <XmlAssessmentCard
              title="Package scope"
              statusLabel={`${selectedBulkRecordCount} selected`}
              subtitle="Records included in this package"
              isRefreshing={isRefreshing}
            >
              <p className="panel-copy">Choose how many device rows to include in the generated package.</p>
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
            </XmlAssessmentCard>

            <XmlAssessmentCard
              title="Preview output"
              statusLabel={`Chunk ${selectedXmlChunkSequence} of ${selectedBulkChunkCount}`}
              subtitle="Current preview package"
              isRefreshing={isRefreshing}
            >
              <p className="panel-copy">Select which generated chunk to inspect before validation or download.</p>
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
            </XmlAssessmentCard>
          </div>
        </div>
        <XmlStatusStrip
          validationValid={selectedBatchValidation?.valid ?? null}
          validationStatusLabel={selectedBatchValidation ? (selectedBatchValidation.valid ? "Schema valid" : "Schema invalid") : "Awaiting preview"}
        />
      </div>
    </div>
  );
}
