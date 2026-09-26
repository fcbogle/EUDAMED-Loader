import { CatalogueSelection } from "./CatalogueSelection";
import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { BulkPatchPostedEntry, BulkPatchPostedParentGroup, MarketCountryReferenceEntry, XmlValidationResult } from "../types";
import {
  resolveMarketCountryCode,
  resolveMarketCountryFlag,
  resolveMarketCountryName,
} from "../marketCountryReference";
import { PanelRefreshShell } from "./PanelRefreshShell";
import { XmlStatusStrip } from "./XmlStatusStrip";
import { XmlWorkspaceHeader } from "./XmlWorkspaceHeader";

type BulkMarketInfoScopeMode = "all_posted" | "next_10" | "next_25" | "selected_catalogue_numbers" | "import_catalogue_list";

type MarketInfoScenarioItem = {
  id: string;
  country: string;
  originalPlacedOnMarket: boolean;
};

type BulkMarketInfoWorkspaceProps = {
  familyVariantLabel: string;
  isRefreshing: boolean;
  displayedBulkMarketInfoParentOptions: BulkPatchPostedParentGroup[];
  selectedBulkMarketInfoParentGroup: BulkPatchPostedParentGroup | null;
  onSelectParent: (basicUdiDi: string) => void;
  selectedBulkMarketInfoSelectedCount: number;
  bulkMarketInfoCurrentVersionSummary: string;
  bulkMarketInfoNextVersionSummary: string;
  bulkMarketInfoScopeMode: BulkMarketInfoScopeMode;
  onScopeModeChange: (value: BulkMarketInfoScopeMode) => void;
  bulkMarketInfoPostedEntries: BulkPatchPostedEntry[];
  selectedBulkMarketInfoCatalogueNumbers: string[];
  setSelectedBulkMarketInfoCatalogueNumbers: Dispatch<SetStateAction<string[]>>;
  bulkMarketInfoImportText: string;
  onBulkMarketInfoImportTextChange: (value: string) => void;
  bulkMarketInfoImportedCatalogueNumbersCount: number;
  bulkMarketInfoImportedMatchedCatalogueNumbersCount: number;
  bulkMarketInfoImportedNotFoundCatalogueNumbersCount: number;
  countryReference: MarketCountryReferenceEntry[];
  currentMarketItems: MarketInfoScenarioItem[];
  draftMarketItems: MarketInfoScenarioItem[];
  onAddCountry: (country: string) => void;
  onSetOriginalCountry: (country: string) => void;
  onRemoveCountry: (country: string) => void;
  readinessMessage: string;
  isReady: boolean;
  selectedBatchValidation: XmlValidationResult | null;
};

export function BulkMarketInfoWorkspace({
  familyVariantLabel,
  isRefreshing,
  displayedBulkMarketInfoParentOptions,
  selectedBulkMarketInfoParentGroup,
  onSelectParent,
  selectedBulkMarketInfoSelectedCount,
  bulkMarketInfoCurrentVersionSummary,
  bulkMarketInfoNextVersionSummary,
  bulkMarketInfoScopeMode,
  onScopeModeChange,
  bulkMarketInfoPostedEntries,
  selectedBulkMarketInfoCatalogueNumbers,
  setSelectedBulkMarketInfoCatalogueNumbers,
  bulkMarketInfoImportText,
  onBulkMarketInfoImportTextChange,
  bulkMarketInfoImportedCatalogueNumbersCount,
  bulkMarketInfoImportedMatchedCatalogueNumbersCount,
  bulkMarketInfoImportedNotFoundCatalogueNumbersCount,
  countryReference,
  currentMarketItems,
  draftMarketItems,
  onAddCountry,
  onSetOriginalCountry,
  onRemoveCountry,
  readinessMessage,
  isReady,
  selectedBatchValidation,
}: BulkMarketInfoWorkspaceProps) {
  const [addCountryValue, setAddCountryValue] = useState("");
  const [removeCountryValue, setRemoveCountryValue] = useState("");
  const draftOriginalMarket = draftMarketItems.find((item) => item.originalPlacedOnMarket)?.country ?? "";
  const draftCountryCodes = useMemo(
    () =>
      draftMarketItems
        .map((item) => resolveMarketCountryCode(countryReference, item.country))
        .filter((value): value is string => Boolean(value)),
    [countryReference, draftMarketItems],
  );
  const availableCountryOptions = useMemo(
    () => countryReference.filter((country) => !draftCountryCodes.includes(country.code)),
    [countryReference, draftCountryCodes],
  );
  const selectedParentOptionLabel = selectedBulkMarketInfoParentGroup
    ? `${selectedBulkMarketInfoParentGroup.basic_udi_di} · ${selectedBulkMarketInfoParentGroup.posted_child_count} posted device${selectedBulkMarketInfoParentGroup.posted_child_count === 1 ? "" : "s"}`
    : "No parent selected";

  return (
    <div className="draft-list xml-record-stack">
      <div className="draft-card xml-record-card">
        <XmlWorkspaceHeader
          title={familyVariantLabel}
          statusLabel="Bulk Market Info"
          subtitle="Review the registered parent scope, choose the devices to include, and apply one market-country scenario across the selected cohort."
        />
        <div className="draft-list xml-record-stack">
          <div className="draft-card xml-record-card">
            <PanelRefreshShell
              isRefreshing={isRefreshing}
              className="market-info-refresh-shell"
              message="Updating the registered parent scope, device cohort, and market-country draft."
            >
              <div className="draft-card-head">
                <strong>Market Info Edit</strong>
                <span className="status-pill warn compact">EUDAMED Candidate</span>
              </div>
              <p className="draft-meta">{selectedParentOptionLabel}</p>
              <div className="family-scope-pill-row xml-status-row">
                <span className="status-pill ok compact">Bulk scope</span>
                <span className="status-pill ok compact">{familyVariantLabel}</span>
                <span className="status-pill ok compact">{selectedBulkMarketInfoSelectedCount} selected</span>
              </div>
              <p className="panel-copy">
                Build one standalone `MARKET_INFO.PUT` scenario across the selected posted devices under the chosen registered Basic UDI-DI parent.
              </p>

              <div className="market-info-editor-card">
                <div className="market-info-editor-summary-row">
                  <div className="workflow-note patch-readiness-note market-info-stat-tile">
                    <strong>{displayedBulkMarketInfoParentOptions.length}</strong>
                    <span>Available parents</span>
                  </div>
                  <div className="workflow-note patch-readiness-note market-info-stat-tile">
                    <strong>{selectedBulkMarketInfoSelectedCount}</strong>
                    <span>Devices in scope</span>
                  </div>
                  <div className="workflow-note patch-readiness-note market-info-stat-tile">
                    <strong>{bulkMarketInfoCurrentVersionSummary}</strong>
                    <span>Current version basis</span>
                  </div>
                  <div className="workflow-note patch-readiness-note market-info-stat-tile">
                    <strong>{bulkMarketInfoNextVersionSummary}</strong>
                    <span>Generated version</span>
                  </div>
                </div>

                <div className="market-info-editor-controls bulk-market-info-editor-controls">
                  <label className="market-info-field market-info-field-wide">
                    <span className="field-label">Basic UDI-DI parent</span>
                    <select
                      id="xml-bulk-market-info-parent-selector"
                      className="rule-select patch-select"
                      value={selectedBulkMarketInfoParentGroup?.basic_udi_di ?? ""}
                      onChange={(event) => onSelectParent(event.target.value)}
                    >
                      {displayedBulkMarketInfoParentOptions.map((group) => (
                        <option key={group.basic_udi_di} value={group.basic_udi_di}>
                          {group.basic_udi_di} · {group.posted_child_count} posted device{group.posted_child_count === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="market-info-field market-info-field-compact">
                    <span className="field-label">Scope mode</span>
                    <select
                      id="xml-bulk-market-info-scope-mode"
                      className="rule-select patch-select"
                      value={bulkMarketInfoScopeMode}
                      onChange={(event) => onScopeModeChange(event.target.value as BulkMarketInfoScopeMode)}
                    >
                      <option value="all_posted">All posted devices</option>
                      <option value="next_10">Next 10 devices</option>
                      <option value="next_25">Next 25 devices</option>
                      <option value="selected_catalogue_numbers">Select catalogue numbers</option>
                      <option value="import_catalogue_list">Import catalogue list</option>
                    </select>
                  </label>
                  <label className="market-info-field market-info-field-compact">
                    <span className="field-label">Add country</span>
                    <select
                      className="rule-select patch-select"
                      value={addCountryValue}
                      onChange={(event) => {
                        const selectedCountry = event.target.value;
                        setAddCountryValue(selectedCountry);
                        if (selectedCountry) {
                          onAddCountry(selectedCountry);
                          setAddCountryValue("");
                        }
                      }}
                    >
                      <option value="">Select country</option>
                      {availableCountryOptions.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="market-info-field market-info-field-compact">
                    <span className="field-label">Remove country</span>
                    <select
                      className="rule-select patch-select"
                      value={removeCountryValue}
                      onChange={(event) => {
                        const selectedCountry = event.target.value;
                        setRemoveCountryValue(selectedCountry);
                        if (selectedCountry) {
                          onRemoveCountry(selectedCountry);
                          setRemoveCountryValue("");
                        }
                      }}
                      disabled={draftMarketItems.length <= 1}
                    >
                      <option value="">Select country</option>
                      {draftMarketItems.map((item) => (
                        <option key={`remove-${item.id}`} value={item.country}>
                          {resolveMarketCountryName(countryReference, item.country) || "Pending"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="market-info-field market-info-field-compact">
                    <span className="field-label">Original market</span>
                    <select
                      className="rule-select patch-select"
                      value={draftOriginalMarket}
                      onChange={(event) => onSetOriginalCountry(event.target.value)}
                      disabled={!draftMarketItems.length}
                    >
                      <option value="">Select original market</option>
                      {draftMarketItems.map((item) => (
                        <option key={`original-${item.id}`} value={item.country}>
                          {resolveMarketCountryName(countryReference, item.country) || "Pending"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {bulkMarketInfoScopeMode === "selected_catalogue_numbers" ? (
                  <CatalogueSelection
                    key={`${familyVariantLabel}|${selectedBulkMarketInfoParentGroup?.basic_udi_di}`}
                    label={familyVariantLabel}
                    entries={bulkMarketInfoPostedEntries.map(entry => ({ ...entry, detail: `Market Info version ${entry.latest_market_info_version ?? "Unconfirmed"}` }))}
                    selected={selectedBulkMarketInfoCatalogueNumbers}
                    onApply={values => setSelectedBulkMarketInfoCatalogueNumbers(values)}
                  />
                ) : null}
                {bulkMarketInfoScopeMode === "import_catalogue_list" ? (
                  <>
                    <label className="field-label" htmlFor="xml-bulk-market-info-import-list">
                      Catalogue numbers
                    </label>
                    <textarea
                      id="xml-bulk-market-info-import-list"
                      className="rule-select patch-select"
                      rows={6}
                      placeholder="One catalogue number per line, or comma-separated values."
                      value={bulkMarketInfoImportText}
                      onChange={(event) => onBulkMarketInfoImportTextChange(event.target.value)}
                    />
                    <p className="panel-copy">
                      Imported {bulkMarketInfoImportedCatalogueNumbersCount}. Matched {bulkMarketInfoImportedMatchedCatalogueNumbersCount}. Not found{" "}
                      {bulkMarketInfoImportedNotFoundCatalogueNumbersCount}.
                    </p>
                  </>
                ) : null}

                <details className="market-info-current-details">
                  <summary>Show current countries</summary>
                  <div className="market-info-chip-list">
                    {currentMarketItems.length ? (
                      currentMarketItems.map((item) => (
                        <span
                          key={`current-${item.id}`}
                          className={item.originalPlacedOnMarket ? "market-info-chip market-info-chip-original" : "market-info-chip"}
                        >
                          <span className="market-info-chip-flag" aria-hidden="true">{resolveMarketCountryFlag(countryReference, item.country)}</span>
                          <span>{resolveMarketCountryName(countryReference, item.country)}</span>
                        </span>
                      ))
                    ) : (
                      <span className="market-info-empty-text">No current market countries are available.</span>
                    )}
                  </div>
                </details>
                <details className="market-info-current-details">
                  <summary>Show proposed countries</summary>
                  <div className="market-info-chip-list market-info-chip-list-draft-inline">
                    {draftMarketItems.length ? (
                      draftMarketItems.map((item) => (
                        <div
                          key={`draft-${item.id}`}
                          className={item.originalPlacedOnMarket ? "market-info-chip-row market-info-chip-row-original" : "market-info-chip-row"}
                        >
                          <span className="market-info-chip-flag" aria-hidden="true">{resolveMarketCountryFlag(countryReference, item.country)}</span>
                          <span className="market-info-chip-label">{resolveMarketCountryName(countryReference, item.country) || "Pending"}</span>
                          {item.originalPlacedOnMarket ? <span className="market-info-chip-badge">Original</span> : null}
                        </div>
                      ))
                    ) : (
                      <span className="market-info-empty-text">Add at least one country to build the draft.</span>
                    )}
                  </div>
                </details>
              </div>

              <div className="workflow-note patch-readiness-note">
                <strong>{isReady ? "Draft readiness" : "Draft blocked"}</strong>
                <span>{readinessMessage}</span>
              </div>
            </PanelRefreshShell>
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
