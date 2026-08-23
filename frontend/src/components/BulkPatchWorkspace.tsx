import type { Dispatch, SetStateAction } from "react";

import type { BulkPatchPostedEntry, BulkPatchPostedParentGroup, CriticalWarningCodeOption, XmlValidationResult } from "../types";

type PatchScenarioOption = {
  id: string;
  label: string;
};

type BulkPatchScopeMode = "all_posted" | "selected_catalogue_numbers" | "import_catalogue_list";

type BulkPatchWorkspaceProps = {
  familyVariantLabel: string;
  displayedBulkPatchParentOptions: BulkPatchPostedParentGroup[];
  selectedBulkPatchParentGroup: BulkPatchPostedParentGroup | null;
  onSelectParent: (basicUdiDi: string) => void;
  selectedBulkPatchSelectedCount: number;
  bulkPatchScopeMode: BulkPatchScopeMode;
  onScopeModeChange: (value: BulkPatchScopeMode) => void;
  bulkPatchPostedEntries: BulkPatchPostedEntry[];
  bulkPatchCatalogueFilter: string;
  onBulkPatchCatalogueFilterChange: (value: string) => void;
  bulkPatchFilteredPostedEntries: BulkPatchPostedEntry[];
  selectedBulkPatchCatalogueNumbers: string[];
  setSelectedBulkPatchCatalogueNumbers: Dispatch<SetStateAction<string[]>>;
  bulkPatchImportText: string;
  onBulkPatchImportTextChange: (value: string) => void;
  bulkPatchImportedCatalogueNumbersCount: number;
  bulkPatchImportedMatchedCatalogueNumbersCount: number;
  bulkPatchImportedNotFoundCatalogueNumbersCount: number;
  patchScenarioStatusLabel: string;
  patchScenarioOptions: PatchScenarioOption[];
  selectedPatchScenarioId: string;
  onPatchScenarioChange: (scenarioId: string) => void;
  selectedPatchScenarioSummary: string;
  selectedPatchScenarioOptionsSummary?: string;
  selectedPatchScenarioImplemented: boolean;
  patchTradeNameInput: string;
  onPatchTradeNameChange: (value: string) => void;
  patchBaseQuantityInput: string;
  onPatchBaseQuantityChange: (value: string) => void;
  patchStatusCodeInput: string;
  onPatchStatusCodeChange: (value: string) => void;
  patchSterileInput: string;
  onPatchSterileChange: (value: string) => void;
  patchLatexInput: string;
  onPatchLatexChange: (value: string) => void;
  patchWarningCodeInput: string;
  onPatchWarningCodeChange: (value: string) => void;
  selectedWarningRequiresComment: boolean;
  patchWarningCommentInput: string;
  onPatchWarningCommentChange: (value: string) => void;
  criticalWarningCodeOptions: CriticalWarningCodeOption[];
  patchStorageConditionInputs: Record<string, string>;
  setPatchStorageConditionInputs: Dispatch<SetStateAction<Record<string, string>>>;
  selectedBatchValidation: XmlValidationResult | null;
};

export function BulkPatchWorkspace({
  familyVariantLabel,
  displayedBulkPatchParentOptions,
  selectedBulkPatchParentGroup,
  onSelectParent,
  selectedBulkPatchSelectedCount,
  bulkPatchScopeMode,
  onScopeModeChange,
  bulkPatchPostedEntries,
  bulkPatchCatalogueFilter,
  onBulkPatchCatalogueFilterChange,
  bulkPatchFilteredPostedEntries,
  selectedBulkPatchCatalogueNumbers,
  setSelectedBulkPatchCatalogueNumbers,
  bulkPatchImportText,
  onBulkPatchImportTextChange,
  bulkPatchImportedCatalogueNumbersCount,
  bulkPatchImportedMatchedCatalogueNumbersCount,
  bulkPatchImportedNotFoundCatalogueNumbersCount,
  patchScenarioStatusLabel,
  patchScenarioOptions,
  selectedPatchScenarioId,
  onPatchScenarioChange,
  selectedPatchScenarioSummary,
  selectedPatchScenarioOptionsSummary,
  selectedPatchScenarioImplemented,
  patchTradeNameInput,
  onPatchTradeNameChange,
  patchBaseQuantityInput,
  onPatchBaseQuantityChange,
  patchStatusCodeInput,
  onPatchStatusCodeChange,
  patchSterileInput,
  onPatchSterileChange,
  patchLatexInput,
  onPatchLatexChange,
  patchWarningCodeInput,
  onPatchWarningCodeChange,
  selectedWarningRequiresComment,
  patchWarningCommentInput,
  onPatchWarningCommentChange,
  criticalWarningCodeOptions,
  patchStorageConditionInputs,
  setPatchStorageConditionInputs,
  selectedBatchValidation,
}: BulkPatchWorkspaceProps) {
  return (
    <>
      <div className="draft-list xml-record-stack">
        <div className="draft-card xml-record-card">
          <div className="draft-card-head">
            <strong>{familyVariantLabel}</strong>
            <span className="status-pill ok compact">Bulk PATCH</span>
          </div>
          <div className="bulk-patch-layout">
            <div className="bulk-patch-config-column">
              <div className="draft-card">
                <div className="draft-card-head">
                  <strong>1. Choose posted parent</strong>
                  <span className="status-pill ok compact">{displayedBulkPatchParentOptions.length} available</span>
                </div>
                <p className="panel-copy">Confirm Basic UDI-DI for this PATCH.</p>
                <label className="field-label" htmlFor="xml-bulk-patch-parent-selector">
                  Basic UDI-DI parent
                </label>
                <select
                  id="xml-bulk-patch-parent-selector"
                  className="rule-select"
                  value={selectedBulkPatchParentGroup?.basic_udi_di ?? ""}
                  onChange={(event) => onSelectParent(event.target.value)}
                >
                  {displayedBulkPatchParentOptions.map((group) => (
                    <option key={group.basic_udi_di} value={group.basic_udi_di}>
                      {group.basic_udi_di} · {group.posted_child_count} posted device{group.posted_child_count === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
                {displayedBulkPatchParentOptions.length ? (
                  <div className="bulk-parent-chip-row">
                    {displayedBulkPatchParentOptions.map((group) => {
                      const isSelected = group.basic_udi_di === selectedBulkPatchParentGroup?.basic_udi_di;
                      return (
                        <button
                          key={group.basic_udi_di}
                          type="button"
                          className={isSelected ? "bulk-parent-chip active" : "bulk-parent-chip"}
                          onClick={() => onSelectParent(group.basic_udi_di)}
                        >
                          {group.basic_udi_di} ({group.posted_child_count})
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="draft-card">
                <div className="draft-card-head">
                  <strong>2. Choose device scope</strong>
                  <span className="status-pill ok compact">{selectedBulkPatchSelectedCount} selected</span>
                </div>
                <p className="panel-copy">Determine scope of this PATCH.</p>
                <label className="field-label" htmlFor="xml-bulk-patch-scope-mode">
                  Scope mode
                </label>
                <select
                  id="xml-bulk-patch-scope-mode"
                  className="rule-select"
                  value={bulkPatchScopeMode}
                  onChange={(event) => onScopeModeChange(event.target.value as BulkPatchScopeMode)}
                >
                  <option value="all_posted">All posted devices</option>
                  <option value="selected_catalogue_numbers">Select catalogue numbers</option>
                  <option value="import_catalogue_list">Import catalogue list</option>
                </select>
                {bulkPatchScopeMode === "all_posted" ? (
                  <p className="panel-copy">Apply this PATCH to every posted Device UDI-DI record under the selected Basic UDI-DI.</p>
                ) : null}
                {bulkPatchScopeMode === "selected_catalogue_numbers" ? (
                  <>
                    <label className="field-label" htmlFor="xml-bulk-patch-catalogue-filter">
                      Catalogue number filter
                    </label>
                    <input
                      id="xml-bulk-patch-catalogue-filter"
                      className="rule-select patch-select"
                      type="text"
                      placeholder={bulkPatchPostedEntries.length > 10 ? "Search posted catalogue numbers" : "Optional filter"}
                      value={bulkPatchCatalogueFilter}
                      onChange={(event) => onBulkPatchCatalogueFilterChange(event.target.value)}
                    />
                    {bulkPatchPostedEntries.length > 10 && !bulkPatchCatalogueFilter.trim() ? (
                      <p className="panel-copy">Many posted devices are available. Enter a catalogue number filter to choose a subset.</p>
                    ) : (
                      <div className="bulk-posted-grid">
                        {bulkPatchFilteredPostedEntries.map((entry, index) => {
                          const catalogueNumber = entry.catalogue_number ?? "";
                          const isSelected = selectedBulkPatchCatalogueNumbers.includes(catalogueNumber);
                          return (
                            <label className="roadmap-item compact-structured-item bulk-selection-card" key={`${catalogueNumber}-${index}`}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedBulkPatchCatalogueNumbers((current) =>
                                    current.includes(catalogueNumber)
                                      ? current.filter((value) => value !== catalogueNumber)
                                      : [...current, catalogueNumber],
                                  );
                                }}
                              />
                              <span>
                                <strong>{catalogueNumber || entry.primary_udi_di || "Unknown device"}</strong>
                                <p>{entry.primary_udi_di ?? "Device UDI-DI pending"}</p>
                                <p>Current version {entry.latest_version ?? "1"}</p>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : null}
                {bulkPatchScopeMode === "import_catalogue_list" ? (
                  <>
                    <label className="field-label" htmlFor="xml-bulk-patch-import-list">
                      Catalogue numbers
                    </label>
                    <textarea
                      id="xml-bulk-patch-import-list"
                      className="rule-select patch-select"
                      rows={6}
                      placeholder="One catalogue number per line, or comma-separated values."
                      value={bulkPatchImportText}
                      onChange={(event) => onBulkPatchImportTextChange(event.target.value)}
                    />
                    <p className="panel-copy">
                      Imported {bulkPatchImportedCatalogueNumbersCount}. Matched {bulkPatchImportedMatchedCatalogueNumbersCount}. Not found{" "}
                      {bulkPatchImportedNotFoundCatalogueNumbersCount}.
                    </p>
                  </>
                ) : null}
              </div>

              <div className="draft-card">
                <div className="draft-card-head">
                  <strong>3. Choose PATCH scenario</strong>
                  <span className="status-pill ok compact">{patchScenarioStatusLabel}</span>
                </div>
                <p className="panel-copy">Select PATCH operation for your chosen scope.</p>
                <label className="field-label" htmlFor="xml-bulk-patch-scenario-selector">
                  Bulk PATCH scenario
                </label>
                <select
                  id="xml-bulk-patch-scenario-selector"
                  className="rule-select"
                  value={selectedPatchScenarioId}
                  onChange={(event) => onPatchScenarioChange(event.target.value)}
                >
                  {patchScenarioOptions.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.label}
                    </option>
                  ))}
                </select>
                <p className="panel-copy">{selectedPatchScenarioSummary}</p>
                {selectedPatchScenarioOptionsSummary ? <p className="panel-copy">Options: {selectedPatchScenarioOptionsSummary}</p> : null}
                {!selectedPatchScenarioImplemented ? (
                  <div className="workflow-note patch-readiness-note">
                    <strong>Design placeholder</strong>
                    <span>This candidate scenario is listed for design review, but XML generation is not implemented yet.</span>
                  </div>
                ) : null}
                {selectedPatchScenarioId === "equivalent_first_patch" ? (
                  <p className="panel-copy">This option creates the explicit version `2` PATCH with no business-field change.</p>
                ) : null}
                {selectedPatchScenarioId === "trade_name_edit" ? (
                  <div className="patch-field patch-field-full">
                    <label className="field-label" htmlFor="bulk-patch-trade-name-input">
                      New trade name
                    </label>
                    <input
                      id="bulk-patch-trade-name-input"
                      className="rule-select patch-select"
                      type="text"
                      value={patchTradeNameInput}
                      onChange={(event) => onPatchTradeNameChange(event.target.value)}
                    />
                  </div>
                ) : null}
                {selectedPatchScenarioId === "base_quantity_edit" ? (
                  <div className="patch-field patch-field-full">
                    <label className="field-label" htmlFor="bulk-patch-base-quantity-input">
                      New base quantity
                    </label>
                    <input
                      id="bulk-patch-base-quantity-input"
                      className="rule-select patch-select"
                      type="number"
                      min={1}
                      step={1}
                      value={patchBaseQuantityInput}
                      onChange={(event) => onPatchBaseQuantityChange(event.target.value)}
                    />
                  </div>
                ) : null}
                {selectedPatchScenarioId === "status_code_edit" ? (
                  <div className="patch-field patch-field-full">
                    <label className="field-label" htmlFor="bulk-patch-status-code-input">
                      Status code
                    </label>
                    <select
                      id="bulk-patch-status-code-input"
                      className="rule-select patch-select"
                      value={patchStatusCodeInput}
                      onChange={(event) => onPatchStatusCodeChange(event.target.value)}
                    >
                      <option value="">Select value</option>
                      <option value="NOT_INTENDED_FOR_EU_MARKET">NOT_INTENDED_FOR_EU_MARKET</option>
                      <option value="ON_THE_MARKET">ON_THE_MARKET</option>
                      <option value="NO_LONGER_PLACED_ON_THE_MARKET">NO_LONGER_PLACED_ON_THE_MARKET</option>
                    </select>
                  </div>
                ) : null}
                {selectedPatchScenarioId === "sterile_edit" ? (
                  <div className="patch-field patch-field-full">
                    <label className="field-label" htmlFor="bulk-patch-sterile-input">
                      Sterile
                    </label>
                    <select
                      id="bulk-patch-sterile-input"
                      className="rule-select patch-select"
                      value={patchSterileInput}
                      onChange={(event) => onPatchSterileChange(event.target.value)}
                    >
                      <option value="">Select value</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </div>
                ) : null}
                {selectedPatchScenarioId === "latex_edit" ? (
                  <div className="patch-field patch-field-full">
                    <label className="field-label" htmlFor="bulk-patch-latex-input">
                      Latex
                    </label>
                    <select
                      id="bulk-patch-latex-input"
                      className="rule-select patch-select"
                      value={patchLatexInput}
                      onChange={(event) => onPatchLatexChange(event.target.value)}
                    >
                      <option value="">Select value</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </div>
                ) : null}
                {selectedPatchScenarioId === "warning_add" ? (
                  <>
                    <div className="patch-field patch-field-full">
                      <label className="field-label" htmlFor="bulk-patch-warning-code-input">
                        Replacement warning code
                      </label>
                      <input
                        id="bulk-patch-warning-code-input"
                        className="rule-select patch-select"
                        type="text"
                        list="critical-warning-code-options"
                        value={patchWarningCodeInput}
                        onChange={(event) => onPatchWarningCodeChange(event.target.value)}
                      />
                    </div>
                    <datalist id="critical-warning-code-options">
                      {criticalWarningCodeOptions.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.description ? `${option.code} - ${option.description}` : option.code}
                        </option>
                      ))}
                    </datalist>
                    {selectedWarningRequiresComment || patchWarningCommentInput.trim() ? (
                      <div className="patch-field patch-field-full">
                        <label className="field-label" htmlFor="bulk-patch-warning-comment-input">
                          Warning comment
                        </label>
                        <input
                          id="bulk-patch-warning-comment-input"
                          className="rule-select patch-select"
                          type="text"
                          value={patchWarningCommentInput}
                          onChange={(event) => onPatchWarningCommentChange(event.target.value)}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
                {selectedPatchScenarioId === "storage_condition_edit" ? (
                  <>
                    <div className="patch-field">
                      <label className="field-label" htmlFor="bulk-patch-storage-shc006-input">
                        Storage condition SHC006
                      </label>
                      <input
                        id="bulk-patch-storage-shc006-input"
                        className="rule-select patch-select"
                        type="text"
                        value={patchStorageConditionInputs.SHC006 ?? ""}
                        onChange={(event) =>
                          setPatchStorageConditionInputs((current) => ({
                            ...current,
                            SHC006: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="patch-field">
                      <label className="field-label" htmlFor="bulk-patch-storage-shc007-input">
                        Storage condition SHC007
                      </label>
                      <input
                        id="bulk-patch-storage-shc007-input"
                        className="rule-select patch-select"
                        type="text"
                        value={patchStorageConditionInputs.SHC007 ?? ""}
                        onChange={(event) =>
                          setPatchStorageConditionInputs((current) => ({
                            ...current,
                            SHC007: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </>
                ) : null}
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
    </>
  );
}
