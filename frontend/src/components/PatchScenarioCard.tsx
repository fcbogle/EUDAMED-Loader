import type { Dispatch, SetStateAction } from "react";

import type { CriticalWarningCodeOption, GeneratedPatchScenarioPreview } from "../types";

type PatchScenarioOption = {
  id: string;
  label: string;
};

type PatchDeviceOption = {
  catalogueNumber: string;
  primaryUdiDi: string | null;
};

type PatchDraftComparisonRow = {
  label: string;
  before: string;
  after: string;
};

type PatchScenarioCardProps = {
  selectedPatchScenarioLabel: string;
  selectedPatchScenarioStatus: string | null;
  selectedPatchWorkspaceCatalogueNumber: string | null;
  patchDeviceOptions: PatchDeviceOption[];
  onPatchDeviceChange: (catalogueNumber: string) => void;
  currentAcceptedPatchLabel: string;
  hasLoadedPatchBaseline: boolean;
  selectedPatchScenarioSummary: string;
  patchDraftComparisonRows: PatchDraftComparisonRow[];
  currentAcceptedPatchVersion: number;
  patchVersionInput: string;
  patchScenarioOptions: PatchScenarioOption[];
  selectedPatchScenarioId: string;
  onScenarioChange: (scenarioId: string) => void;
  onPatchVersionChange: (value: string) => void;
  selectedPatchScenarioImplemented: boolean;
  selectedPatchScenarioOptionsSummary?: string;
  patchTradeNameInput: string;
  onPatchTradeNameChange: (value: string) => void;
  patchBaseQuantityInput: string;
  onPatchBaseQuantityChange: (value: string) => void;
  selectedCurrentBaseQuantity: number | null;
  patchSterileInput: string;
  onPatchSterileChange: (value: string) => void;
  selectedCurrentSterile: boolean | null;
  patchLatexInput: string;
  onPatchLatexChange: (value: string) => void;
  selectedCurrentLatex: boolean | null;
  patchStatusCodeInput: string;
  onPatchStatusCodeChange: (value: string) => void;
  selectedCurrentStatusCode: string | null;
  selectedPatchWarningCodes: string[];
  selectedPatchWarningDescriptions: string[];
  criticalWarningCodeOptions: CriticalWarningCodeOption[];
  patchWarningCodeInput: string;
  onPatchWarningCodeChange: (value: string) => void;
  selectedWarningRequiresComment: boolean;
  patchWarningCommentInput: string;
  onPatchWarningCommentChange: (value: string) => void;
  patchStorageConditionInputs: Record<string, string>;
  setPatchStorageConditionInputs: Dispatch<SetStateAction<Record<string, string>>>;
  patchScenarioReadinessMessage: string;
  xmlPatchPreview: GeneratedPatchScenarioPreview | null;
};

export function PatchScenarioCard({
  selectedPatchScenarioLabel,
  selectedPatchScenarioStatus,
  selectedPatchWorkspaceCatalogueNumber,
  patchDeviceOptions,
  onPatchDeviceChange,
  currentAcceptedPatchLabel,
  hasLoadedPatchBaseline,
  selectedPatchScenarioSummary,
  patchDraftComparisonRows,
  currentAcceptedPatchVersion,
  patchVersionInput,
  patchScenarioOptions,
  selectedPatchScenarioId,
  onScenarioChange,
  onPatchVersionChange,
  selectedPatchScenarioImplemented,
  selectedPatchScenarioOptionsSummary,
  patchTradeNameInput,
  onPatchTradeNameChange,
  patchBaseQuantityInput,
  onPatchBaseQuantityChange,
  selectedCurrentBaseQuantity,
  patchSterileInput,
  onPatchSterileChange,
  selectedCurrentSterile,
  patchLatexInput,
  onPatchLatexChange,
  selectedCurrentLatex,
  patchStatusCodeInput,
  onPatchStatusCodeChange,
  selectedCurrentStatusCode,
  selectedPatchWarningCodes,
  selectedPatchWarningDescriptions,
  criticalWarningCodeOptions,
  patchWarningCodeInput,
  onPatchWarningCodeChange,
  selectedWarningRequiresComment,
  patchWarningCommentInput,
  onPatchWarningCommentChange,
  patchStorageConditionInputs,
  setPatchStorageConditionInputs,
  patchScenarioReadinessMessage,
  xmlPatchPreview,
}: PatchScenarioCardProps) {
  return (
    <div className="draft-list xml-record-stack">
      <div className="draft-card xml-record-card">
        <div className="draft-card-head">
          <strong>{selectedPatchScenarioLabel}</strong>
          <span className={selectedPatchScenarioStatus === "EUDAMED Accepted" ? "status-pill ok compact" : "status-pill warn compact"}>
            {selectedPatchScenarioStatus ?? "EUDAMED Candidate"}
          </span>
        </div>
        <p className="draft-meta">Parent POST {selectedPatchWorkspaceCatalogueNumber ?? "Not resolved"} · Current accepted base {currentAcceptedPatchLabel}</p>
        <div className="family-scope-pill-row xml-status-row">
          <span className={hasLoadedPatchBaseline ? "status-pill ok compact" : "status-pill warn compact"}>
            {hasLoadedPatchBaseline ? "Accepted baseline loaded" : "Accepted baseline required"}
          </span>
          <span className="status-pill ok compact">Parent POST</span>
          <span className="status-pill ok compact">{selectedPatchWorkspaceCatalogueNumber ?? "Not resolved"}</span>
        </div>
        <p className="panel-copy">{selectedPatchScenarioSummary}</p>
        {hasLoadedPatchBaseline ? (
          <>
            <div className="patch-compare-grid">
              <div className="patch-compare-card">
                <span className="summary-label">Before</span>
                <strong>{currentAcceptedPatchLabel}</strong>
                <p>
                  Parent POST {selectedPatchWorkspaceCatalogueNumber ?? "Not resolved"} · Version {String(currentAcceptedPatchVersion)}
                </p>
                <ul className="patch-compare-list">
                  {patchDraftComparisonRows.map((row) => (
                    <li key={`before-${row.label}`}>
                      <strong>{row.label}</strong>
                      <span>{row.before}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="patch-compare-card patch-compare-card-accent">
                <span className="summary-label">After</span>
                <strong>Derived scenario PATCH draft</strong>
                <p>
                  Same parent device lineage · Version {patchVersionInput.trim() || "Pending"}
                </p>
                <ul className="patch-compare-list">
                  {patchDraftComparisonRows.map((row) => (
                    <li key={`after-${row.label}`}>
                      <strong>{row.label}</strong>
                      <span>{row.after}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="patch-form-grid">
              <div className="patch-field patch-field-full">
                <label className="field-label" htmlFor="patch-device-selector">
                  Posted Device UDI-DI
                </label>
                <select
                  id="patch-device-selector"
                  className="rule-select patch-select"
                  value={selectedPatchWorkspaceCatalogueNumber ?? ""}
                  onChange={(event) => onPatchDeviceChange(event.target.value)}
                >
                  {patchDeviceOptions.map((device) => (
                    <option key={device.catalogueNumber} value={device.catalogueNumber}>
                      {device.catalogueNumber} {device.primaryUdiDi ? `· ${device.primaryUdiDi}` : ""}
                    </option>
                  ))}
                </select>
                <p className="field-source-note">PATCH generation uses the selected device's recorded accepted POST/PATCH lineage.</p>
              </div>
              <div className="patch-field">
                <label className="field-label" htmlFor="patch-scenario-selector">
                  Candidate PATCH scenario
                </label>
                <select
                  id="patch-scenario-selector"
                  className="rule-select patch-select"
                  value={selectedPatchScenarioId}
                  onChange={(event) => onScenarioChange(event.target.value)}
                >
                  {patchScenarioOptions.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="patch-field">
                <label className="field-label" htmlFor="patch-version-input">
                  Scenario PATCH version
                </label>
                <input
                  id="patch-version-input"
                  className="rule-select patch-select"
                  type="number"
                  min={2}
                  step={1}
                  value={patchVersionInput}
                  onChange={(event) => onPatchVersionChange(event.target.value)}
                />
              </div>
              {!selectedPatchScenarioImplemented ? (
                <div className="patch-field patch-field-full">
                  <div className="workflow-note patch-readiness-note">
                    <strong>Design placeholder</strong>
                    <span>
                      This candidate scenario is now listed in the dropdown for design review, but XML generation is not implemented yet.
                      {selectedPatchScenarioOptionsSummary ? ` Allowed options: ${selectedPatchScenarioOptionsSummary}` : ""}
                    </span>
                  </div>
                </div>
              ) : null}
              {selectedPatchScenarioId === "equivalent_first_patch" ? (
                <div className="patch-field patch-field-full">
                  <p className="panel-copy">
                    This option creates the explicit version `2` PATCH that mirrors the accepted POST and makes no business-field change.
                  </p>
                </div>
              ) : null}
              {selectedPatchScenarioId === "trade_name_edit" ? (
                <div className="patch-field patch-field-full">
                  <label className="field-label" htmlFor="patch-trade-name-input">
                    New trade name
                  </label>
                  <input
                    id="patch-trade-name-input"
                    className="rule-select patch-select"
                    type="text"
                    value={patchTradeNameInput}
                    onChange={(event) => onPatchTradeNameChange(event.target.value)}
                  />
                </div>
              ) : null}
              {selectedPatchScenarioId === "base_quantity_edit" ? (
                <div className="patch-field patch-field-full">
                  <label className="field-label" htmlFor="patch-base-quantity-input">
                    New base quantity
                  </label>
                  <input
                    id="patch-base-quantity-input"
                    className="rule-select patch-select"
                    type="number"
                    min={1}
                    step={1}
                    value={patchBaseQuantityInput}
                    onChange={(event) => onPatchBaseQuantityChange(event.target.value)}
                  />
                  <p className="field-source-note">Current value: {selectedCurrentBaseQuantity !== null ? selectedCurrentBaseQuantity : "None"}</p>
                </div>
              ) : null}
              {selectedPatchScenarioId === "sterile_edit" ? (
                <div className="patch-field patch-field-full">
                  <label className="field-label" htmlFor="patch-sterile-input">
                    Sterile
                  </label>
                  <select
                    id="patch-sterile-input"
                    className="rule-select patch-select"
                    value={patchSterileInput}
                    onChange={(event) => onPatchSterileChange(event.target.value)}
                  >
                    <option value="">Select value</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                  <p className="field-source-note">
                    Current value: {selectedCurrentSterile === null ? "None" : selectedCurrentSterile ? "true" : "false"}
                  </p>
                </div>
              ) : null}
              {selectedPatchScenarioId === "latex_edit" ? (
                <div className="patch-field patch-field-full">
                  <label className="field-label" htmlFor="patch-latex-input">
                    Latex
                  </label>
                  <select
                    id="patch-latex-input"
                    className="rule-select patch-select"
                    value={patchLatexInput}
                    onChange={(event) => onPatchLatexChange(event.target.value)}
                  >
                    <option value="">Select value</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                  <p className="field-source-note">
                    Current value: {selectedCurrentLatex === null ? "None" : selectedCurrentLatex ? "true" : "false"}
                  </p>
                </div>
              ) : null}
              {selectedPatchScenarioId === "status_code_edit" ? (
                <div className="patch-field patch-field-full">
                  <label className="field-label" htmlFor="patch-status-code-input">
                    Status code
                  </label>
                  <select
                    id="patch-status-code-input"
                    className="rule-select patch-select"
                    value={patchStatusCodeInput}
                    onChange={(event) => onPatchStatusCodeChange(event.target.value)}
                  >
                    <option value="">Select value</option>
                    <option value="NOT_INTENDED_FOR_EU_MARKET">NOT_INTENDED_FOR_EU_MARKET</option>
                    <option value="ON_THE_MARKET">ON_THE_MARKET</option>
                    <option value="NO_LONGER_PLACED_ON_THE_MARKET">NO_LONGER_PLACED_ON_THE_MARKET</option>
                  </select>
                  <p className="field-source-note">Current value: {selectedCurrentStatusCode ?? "None"}</p>
                </div>
              ) : null}
              {selectedPatchScenarioId === "warning_add" ? (
                <>
                  <div className="patch-field patch-field-full">
                    <label className="field-label" htmlFor="patch-warning-current-input">
                      Current critical warning set
                    </label>
                    <input
                      id="patch-warning-current-input"
                      className="rule-select patch-select"
                      type="text"
                      value={selectedPatchWarningCodes.join(", ") || "None"}
                      readOnly
                    />
                    {selectedPatchWarningDescriptions.length ? (
                      <p className="field-source-note">{selectedPatchWarningDescriptions.join(" | ")}</p>
                    ) : null}
                  </div>
                  <div className="patch-field">
                    <label className="field-label" htmlFor="patch-warning-code-input">
                      Replacement warning code
                    </label>
                    <input
                      id="patch-warning-code-input"
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
                      <label className="field-label" htmlFor="patch-warning-comment-input">
                        Warning comment
                      </label>
                      <input
                        id="patch-warning-comment-input"
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
                    <label className="field-label" htmlFor="patch-storage-shc006-input">
                      Storage condition SHC006
                    </label>
                    <input
                      id="patch-storage-shc006-input"
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
                    <label className="field-label" htmlFor="patch-storage-shc007-input">
                      Storage condition SHC007
                    </label>
                    <input
                      id="patch-storage-shc007-input"
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
            <div className="workflow-note patch-readiness-note">
              <strong>Draft readiness</strong>
              <span>{patchScenarioReadinessMessage}</span>
            </div>
          </>
        ) : (
          <div className="workflow-note patch-readiness-note">
            <strong>Accepted baseline required</strong>
            <span>
              Load the accepted baseline for `{selectedPatchWorkspaceCatalogueNumber ?? "the selected device"}` first.
              Scenario drafting requires the matching accepted baseline; downloading the ZIP confirms review.
            </span>
          </div>
        )}
      </div>
      {xmlPatchPreview ? (
        <div className="draft-card">
          <div className="draft-card-head">
            <strong>Generated XML Change Summary</strong>
            <span className="status-pill ok compact">{`${xmlPatchPreview.field_deltas.length} changes`}</span>
          </div>
          <div className="patch-change-summary-list">
            {xmlPatchPreview.field_deltas.map((delta) => (
              <div className="patch-change-summary-item" key={delta.field_key}>
                <strong>{delta.label}</strong>
                <div className="patch-change-summary-values">
                  <span>{delta.before_value ?? "None"}</span>
                  <span className="patch-change-summary-arrow" aria-hidden="true">
                    {"->"}
                  </span>
                  <span>{delta.after_value ?? "None"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
