import type { Dispatch, SetStateAction } from "react";

import type { XmlValidationResult } from "../types";
import type { BulkPostScopeMode } from "../useBulkScopeState";

import { XmlAssessmentCard } from "./XmlAssessmentCard";
import { XmlStatusStrip } from "./XmlStatusStrip";
import { XmlWorkspaceHeader } from "./XmlWorkspaceHeader";

type BulkPostSelectableEntry = {
  catalogue_number: string;
  primary_udi_di: string | null;
};

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
  bulkUdidiPostScopeMode?: BulkPostScopeMode;
  onBulkUdidiPostScopeModeChange?: (value: BulkPostScopeMode) => void;
  bulkUdidiPostEntries?: BulkPostSelectableEntry[];
  bulkUdidiPostCatalogueFilter?: string;
  onBulkUdidiPostCatalogueFilterChange?: (value: string) => void;
  bulkUdidiPostFilteredEntries?: BulkPostSelectableEntry[];
  selectedBulkUdidiPostCatalogueNumbers?: string[];
  setSelectedBulkUdidiPostCatalogueNumbers?: Dispatch<SetStateAction<string[]>>;
  bulkUdidiPostImportText?: string;
  onBulkUdidiPostImportTextChange?: (value: string) => void;
  bulkUdidiPostImportedCatalogueNumbersCount?: number;
  bulkUdidiPostImportedMatchedCatalogueNumbersCount?: number;
  bulkUdidiPostImportedNotFoundCatalogueNumbersCount?: number;
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
  bulkUdidiPostScopeMode,
  onBulkUdidiPostScopeModeChange,
  bulkUdidiPostEntries = [],
  bulkUdidiPostCatalogueFilter = "",
  onBulkUdidiPostCatalogueFilterChange,
  bulkUdidiPostFilteredEntries = [],
  selectedBulkUdidiPostCatalogueNumbers = [],
  setSelectedBulkUdidiPostCatalogueNumbers,
  bulkUdidiPostImportText = "",
  onBulkUdidiPostImportTextChange,
  bulkUdidiPostImportedCatalogueNumbersCount = 0,
  bulkUdidiPostImportedMatchedCatalogueNumbersCount = 0,
  bulkUdidiPostImportedNotFoundCatalogueNumbersCount = 0,
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
              {bulkUdidiPostScopeMode && onBulkUdidiPostScopeModeChange ? (
                <>
                  <p className="panel-copy">Choose which eligible Device UDI-DI rows to include in the generated package.</p>
                  <label className="field-label" htmlFor="xml-bulk-udidi-post-scope-mode">
                    Scope mode
                  </label>
                  <select
                    id="xml-bulk-udidi-post-scope-mode"
                    className="rule-select"
                    value={bulkUdidiPostScopeMode}
                    onChange={(event) => onBulkUdidiPostScopeModeChange(event.target.value as BulkPostScopeMode)}
                  >
                    <option value="all_posted">All eligible devices</option>
                    <option value="next_10">Next 10 devices</option>
                    <option value="next_25">Next 25 devices</option>
                    <option value="next_100">Next 100 records</option>
                    <option value="selected_catalogue_numbers">Select catalogue numbers</option>
                    <option value="import_catalogue_list">Import catalogue list</option>
                  </select>
                  {bulkUdidiPostScopeMode === "selected_catalogue_numbers" ? (
                    <>
                      <label className="field-label" htmlFor="xml-bulk-udidi-post-catalogue-filter">
                        Catalogue number filter
                      </label>
                      <input
                        id="xml-bulk-udidi-post-catalogue-filter"
                        className="rule-select patch-select"
                        type="text"
                        placeholder={bulkUdidiPostEntries.length > 10 ? "Search eligible catalogue numbers" : "Optional filter"}
                        value={bulkUdidiPostCatalogueFilter}
                        onChange={(event) => onBulkUdidiPostCatalogueFilterChange?.(event.target.value)}
                      />
                      {bulkUdidiPostEntries.length > 10 && !bulkUdidiPostCatalogueFilter.trim() ? (
                        <p className="panel-copy">Many eligible devices are available. Enter a catalogue number filter to choose a subset.</p>
                      ) : bulkUdidiPostFilteredEntries.length === 0 ? (
                        <p className="panel-copy bulk-selection-empty-state">No eligible catalogue numbers match this filter.</p>
                      ) : (
                        <div className="bulk-posted-grid">
                          {bulkUdidiPostFilteredEntries.map((entry) => {
                            const isSelected = selectedBulkUdidiPostCatalogueNumbers.includes(entry.catalogue_number);
                            return (
                              <label className="roadmap-item compact-structured-item bulk-selection-card" key={entry.catalogue_number}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedBulkUdidiPostCatalogueNumbers?.((current) =>
                                      current.includes(entry.catalogue_number)
                                        ? current.filter((value) => value !== entry.catalogue_number)
                                        : [...current, entry.catalogue_number],
                                    );
                                  }}
                                />
                                <span>
                                  <strong>{entry.catalogue_number}</strong>
                                  <p>{entry.primary_udi_di ?? "Device UDI-DI pending"}</p>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : null}
                  {bulkUdidiPostScopeMode === "import_catalogue_list" ? (
                    <>
                      <label className="field-label" htmlFor="xml-bulk-udidi-post-import-list">
                        Catalogue numbers
                      </label>
                      <textarea
                        id="xml-bulk-udidi-post-import-list"
                        className="rule-select patch-select"
                        rows={6}
                        placeholder="One catalogue number per line, or comma-separated values."
                        value={bulkUdidiPostImportText}
                        onChange={(event) => onBulkUdidiPostImportTextChange?.(event.target.value)}
                      />
                      <p className="panel-copy">
                        Imported {bulkUdidiPostImportedCatalogueNumbersCount}. Matched {bulkUdidiPostImportedMatchedCatalogueNumbersCount}. Not found {bulkUdidiPostImportedNotFoundCatalogueNumbersCount}.
                      </p>
                    </>
                  ) : null}
                </>
              ) : (
                <>
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
                </>
              )}
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
