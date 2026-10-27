import { CatalogueSelection } from "./CatalogueSelection";
import type { Dispatch, SetStateAction } from "react";

import type { BulkPatchPreview, BulkPatchPostedEntry, BulkPatchPostedParentGroup, CriticalWarningCodeOption, XmlValidationResult } from "../types";
import { XmlAssessmentCard } from "./XmlAssessmentCard";
import { XmlStatusStrip } from "./XmlStatusStrip";
import { XmlWorkspaceHeader } from "./XmlWorkspaceHeader";

type PatchScenarioOption = {
  id: string;
  label: string;
};

type BulkPatchScopeMode = "all_posted" | "next_10" | "next_25" | "selected_catalogue_numbers" | "import_catalogue_list";

type BulkPatchWorkspaceProps = {
  reviewScopeLabel?: string | null;
  reviewScopeMatches?: boolean;
  onClearReviewScope?: () => void;
  selectedEntries?: BulkPatchPostedEntry[];
  preview?: BulkPatchPreview | null;
  familyVariantLabel: string;
  isRefreshing: boolean;
  displayedBulkPatchParentOptions: BulkPatchPostedParentGroup[];
  selectedBulkPatchParentGroup: BulkPatchPostedParentGroup | null;
  onSelectParent: (basicUdiDi: string) => void;
  selectedBulkPatchSelectedCount: number;
  bulkPatchScopeMode: BulkPatchScopeMode;
  onScopeModeChange: (value: BulkPatchScopeMode) => void;
  bulkPatchPostedEntries: BulkPatchPostedEntry[];
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
  bulkPatchBaselineSummary: string[];
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
  reviewScopeLabel, reviewScopeMatches = true, onClearReviewScope, selectedEntries = [], preview,
  familyVariantLabel,
  isRefreshing,
  displayedBulkPatchParentOptions,
  selectedBulkPatchParentGroup,
  onSelectParent,
  selectedBulkPatchSelectedCount,
  bulkPatchScopeMode,
  onScopeModeChange,
  bulkPatchPostedEntries,
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
  bulkPatchBaselineSummary,
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
          <XmlWorkspaceHeader
            title={familyVariantLabel}
            statusLabel="Bulk PATCH"
            subtitle="Review the registered parent scope, PATCH device selection, and scenario change set for this family and variant."
          />
          {reviewScopeLabel ? <div className="workflow-note" role={reviewScopeMatches ? "status" : "alert"}>
            <strong>Reviewed group: {reviewScopeLabel}</strong>
            <span>{reviewScopeMatches ? "Select the devices to assess. No devices were selected automatically." : "The current selection differs from the reviewed group. Return to that group or clear this review before generating XML."}</span>
            <button type="button" className="ghost-button" onClick={onClearReviewScope}>Clear reviewed group</button>
          </div> : null}
          <div className="workflow-note">
            <strong>{familyVariantLabel} · Basic UDI-DI: {selectedBulkPatchParentGroup?.basic_udi_di ?? "Loading / unavailable"}</strong>
            <span>{selectedBulkPatchSelectedCount} selected · {bulkPatchPostedEntries.length} registered candidates · Scenario: {patchScenarioOptions.find(option => option.id === selectedPatchScenarioId)?.label}</span>
          </div>
          <div className="bulk-patch-layout">
            <div className="bulk-patch-config-column">
              <XmlAssessmentCard
                title="Registered parent scope"
                statusLabel={`${displayedBulkPatchParentOptions.length} available`}
                subtitle="Tracked Basic UDI-DI parents"
                isRefreshing={isRefreshing}
              >
                <p className="panel-copy">Select the registered Basic UDI-DI parent that anchors this bulk PATCH package.</p>
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
              </XmlAssessmentCard>

              <XmlAssessmentCard
                title="PATCH device scope"
                statusLabel={`${selectedBulkPatchSelectedCount} selected`}
                subtitle="Devices included in this package"
                isRefreshing={isRefreshing}
              >
                <p className="panel-copy">Choose which posted Device UDI-DI rows will receive the selected PATCH scenario.</p>
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
                  <option value="next_10">Next 10 devices</option>
                  <option value="next_25">Next 25 devices</option>
                  <option value="selected_catalogue_numbers">Select catalogue numbers</option>
                  <option value="import_catalogue_list">Import catalogue list</option>
                </select>
                {bulkPatchScopeMode === "all_posted" ? (
                  <p className="panel-copy">Apply this PATCH to every posted Device UDI-DI record under the selected Basic UDI-DI.</p>
                ) : null}
                {bulkPatchScopeMode === "next_10" ? (
                  <p className="panel-copy">Apply this PATCH to the next 10 posted Device UDI-DI records under the selected Basic UDI-DI.</p>
                ) : null}
                {bulkPatchScopeMode === "next_25" ? (
                  <p className="panel-copy">Apply this PATCH to the next 25 posted Device UDI-DI records under the selected Basic UDI-DI.</p>
                ) : null}
                {bulkPatchScopeMode === "selected_catalogue_numbers" ? (
                  <CatalogueSelection
                    key={`${familyVariantLabel}|${selectedBulkPatchParentGroup?.basic_udi_di}`}
                    label={familyVariantLabel}
                    entries={bulkPatchPostedEntries.map(entry => ({ ...entry, detail: `Current version ${entry.current_state?.version ?? entry.latest_version ?? "Unconfirmed"}` }))}
                    selected={selectedBulkPatchCatalogueNumbers}
                    onApply={values => setSelectedBulkPatchCatalogueNumbers(values)}
                  />
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
              </XmlAssessmentCard>

              <XmlAssessmentCard
                title="Scenario and change set"
                statusLabel={patchScenarioStatusLabel}
                subtitle="Applied to the selected devices"
                isRefreshing={isRefreshing}
              >
                <p className="panel-copy">Select the PATCH scenario and define the business change that will be applied across the package.</p>
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
                {bulkPatchBaselineSummary.length > 0 ? (
                  <div className="workflow-note patch-readiness-note">
                    <strong>Current accepted baseline</strong>
                    {bulkPatchBaselineSummary.map((summary) => (
                      <span key={summary}>{summary}</span>
                    ))}
                  </div>
                ) : null}
                {!selectedPatchScenarioImplemented ? (
                  <div className="workflow-note patch-readiness-note">
                    <strong>Design placeholder</strong>
                    <span>This candidate scenario is listed for design review, but XML generation is not implemented yet.</span>
                  </div>
                ) : null}
                {selectedPatchScenarioId === "equivalent_first_patch" ? (
                  <p className="panel-copy">This scenario creates the explicit version `2` PATCH with no business-field change.</p>
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
              </XmlAssessmentCard>
            </div>
          </div>
          <section aria-label="PATCH device review">
            <h3>Review devices before generation</h3>
            <p className="panel-copy">Registered candidates for this group. Preview rechecks the selected devices and shows exclusions; download rechecks eligibility again.</p>
            <p className="panel-copy">Proposed change: {selectedPatchScenarioSummary} Review the scenario values above before previewing.</p>
            <div className="testing-summary-table-shell bulk-patch-device-review">
              <table className="workbook-files-table">
                <caption className="visually-hidden">Bulk PATCH device identities and accepted versions</caption>
                <thead><tr><th>Catalogue number</th><th>Device UDI-DI</th><th>Accepted version</th><th>Current trade name / quantity</th><th>Review result</th></tr></thead>
                <tbody>{bulkPatchPostedEntries.map((entry, index) => {
                  const selected = selectedEntries.some(item => item.catalogue_number === entry.catalogue_number && item.primary_udi_di === entry.primary_udi_di);
                  const included = preview?.included_records.find(item => item.catalogue_number === entry.catalogue_number && item.primary_udi_di === entry.primary_udi_di);
                  const excluded = preview?.excluded_records.find(item => item.catalogue_number === entry.catalogue_number && (!item.primary_udi_di || item.primary_udi_di === entry.primary_udi_di));
                  return <tr key={`${entry.catalogue_number}|${entry.primary_udi_di}|${index}`}>
                    <td>{entry.catalogue_number ?? "Unavailable"}</td><td><code>{entry.primary_udi_di ?? "Unavailable"}</code></td>
                    <td>{entry.current_state?.version ?? entry.latest_version ?? "Unconfirmed"}</td>
                    <td>{entry.current_state?.trade_name ?? "Unavailable"} / {entry.current_state?.base_quantity ?? "Unavailable"}</td>
                    <td>{excluded ? excluded.reason_message : included ? `Included · version ${included.base_version ?? "?"} → ${included.derived_version ?? "?"}` : selected ? "Selected · preview required" : "Not selected"}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
            {!bulkPatchPostedEntries.length ? <p>No registered candidates loaded for this group. Refresh or review the parent selection.</p> : null}
            {preview?.excluded_records.length ? <div role="status"><strong>Excluded from this preview</strong><ul>{preview.excluded_records.map((entry, index) => <li key={index}>{entry.catalogue_number ?? "Unavailable"} · {entry.primary_udi_di ?? "UDI-DI unavailable"}: {entry.reason_message}</li>)}</ul></div> : null}
          </section>
          <XmlStatusStrip
            validationValid={selectedBatchValidation?.valid ?? null}
            validationStatusLabel={selectedBatchValidation ? (selectedBatchValidation.valid ? "Schema valid" : "Schema invalid") : "Awaiting preview"}
          />
        </div>
      </div>
    </>
  );
}
