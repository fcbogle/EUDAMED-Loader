import { useState } from "react";

type MarketInfoScenarioItem = {
  id: string;
  country: string;
  originalPlacedOnMarket: boolean;
};

type MarketInfoScenarioCardProps = {
  catalogueNumber: string | null;
  primaryUdiDi: string | null;
  productFamily: string | null;
  productVariant: string | null;
  marketInfoVersion: string;
  onMarketInfoVersionChange: (value: string) => void;
  currentMarketItems: MarketInfoScenarioItem[];
  draftMarketItems: MarketInfoScenarioItem[];
  onAddCountry: (country: string) => void;
  onSetOriginalCountry: (country: string) => void;
  onRemoveCountry: (country: string) => void;
  readinessMessage: string;
  isReady: boolean;
};

const MARKET_COUNTRY_OPTIONS = [
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czechia",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Norway",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
] as const;

const COUNTRY_FLAG_BY_NAME: Record<(typeof MARKET_COUNTRY_OPTIONS)[number], string> = {
  Austria: "🇦🇹",
  Belgium: "🇧🇪",
  Bulgaria: "🇧🇬",
  Croatia: "🇭🇷",
  Cyprus: "🇨🇾",
  Czechia: "🇨🇿",
  Denmark: "🇩🇰",
  Estonia: "🇪🇪",
  Finland: "🇫🇮",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Greece: "🇬🇷",
  Hungary: "🇭🇺",
  Ireland: "🇮🇪",
  Italy: "🇮🇹",
  Latvia: "🇱🇻",
  Lithuania: "🇱🇹",
  Luxembourg: "🇱🇺",
  Malta: "🇲🇹",
  Netherlands: "🇳🇱",
  Norway: "🇳🇴",
  Poland: "🇵🇱",
  Portugal: "🇵🇹",
  Romania: "🇷🇴",
  Slovakia: "🇸🇰",
  Slovenia: "🇸🇮",
  Spain: "🇪🇸",
  Sweden: "🇸🇪",
};

function countryFlag(country: string): string {
  return COUNTRY_FLAG_BY_NAME[country as keyof typeof COUNTRY_FLAG_BY_NAME] ?? "🏳️";
}

export function MarketInfoScenarioCard({
  catalogueNumber,
  primaryUdiDi,
  productFamily,
  productVariant,
  marketInfoVersion,
  onMarketInfoVersionChange,
  currentMarketItems,
  draftMarketItems,
  onAddCountry,
  onSetOriginalCountry,
  onRemoveCountry,
  readinessMessage,
  isReady,
}: MarketInfoScenarioCardProps) {
  const [addCountryValue, setAddCountryValue] = useState("");
  const [removeCountryValue, setRemoveCountryValue] = useState("");
  const currentOriginalMarket = currentMarketItems.find((item) => item.originalPlacedOnMarket)?.country ?? null;
  const draftOriginalMarket = draftMarketItems.find((item) => item.originalPlacedOnMarket)?.country ?? "";
  const draftCountryNames = draftMarketItems.map((item) => item.country).filter(Boolean);
  const availableCountryOptions = MARKET_COUNTRY_OPTIONS.filter((country) => !draftCountryNames.includes(country));

  return (
    <div className="draft-list xml-record-stack">
      <div className="draft-card xml-record-card">
        <div className="draft-card-head">
          <strong>Market Info Edit</strong>
          <span className="status-pill warn compact">EUDAMED Candidate</span>
        </div>
        <p className="draft-meta">
          Registered device {catalogueNumber ?? "Not resolved"} · Device UDI-DI {primaryUdiDi ?? "Not resolved"}
        </p>
        <div className="family-scope-pill-row xml-status-row">
          <span className="status-pill ok compact">Registered anchor</span>
          <span className="status-pill ok compact">{productFamily ?? "No family"} / {productVariant ?? "No variant"}</span>
        </div>
        <p className="panel-copy">
          Create a standalone market information update by selecting the countries that will appear in `MARKET_INFO.PUT`.
        </p>
        <div className="market-info-editor-card">
          <div className="market-info-editor-summary-row">
            <div className="workflow-note patch-readiness-note market-info-stat-tile">
              <strong>{currentMarketItems.length}</strong>
              <span>Current countries</span>
            </div>
            <div className="workflow-note patch-readiness-note market-info-stat-tile">
              <strong>{currentOriginalMarket ?? "Not set"}</strong>
              <span>Current original market</span>
            </div>
            <div className="workflow-note patch-readiness-note market-info-stat-tile">
              <strong>{draftMarketItems.length}</strong>
              <span>Proposed countries</span>
            </div>
            <div className="workflow-note patch-readiness-note market-info-stat-tile">
              <strong>{draftOriginalMarket || "Not set"}</strong>
              <span>Proposed original market</span>
            </div>
          </div>
          <div className="market-info-editor-controls">
            <label className="market-info-field">
              <span className="field-label">Market Info version</span>
              <input
                className="rule-select patch-select"
                type="text"
                inputMode="numeric"
                value={marketInfoVersion}
                onChange={(event) => onMarketInfoVersionChange(event.target.value)}
                placeholder="1"
              />
            </label>
            <label className="market-info-field">
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
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </label>
            <label className="market-info-field">
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
                    {item.country || "Pending"}
                  </option>
                ))}
              </select>
            </label>
            <label className="market-info-field">
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
                    {item.country || "Pending"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <details className="market-info-current-details">
            <summary>Show current countries</summary>
            <div className="market-info-chip-list">
              {currentMarketItems.length ? (
                currentMarketItems.map((item) => (
                  <span
                    key={`current-${item.id}`}
                    className={item.originalPlacedOnMarket ? "market-info-chip market-info-chip-original" : "market-info-chip"}
                  >
                    <span className="market-info-chip-flag" aria-hidden="true">{countryFlag(item.country)}</span>
                    <span>{item.country}</span>
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
                    <span className="market-info-chip-flag" aria-hidden="true">{countryFlag(item.country)}</span>
                    <span className="market-info-chip-label">{item.country || "Pending"}</span>
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
      </div>
    </div>
  );
}
