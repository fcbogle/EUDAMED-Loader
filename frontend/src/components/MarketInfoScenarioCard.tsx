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
  currentMarketItems: MarketInfoScenarioItem[];
  draftMarketItems: MarketInfoScenarioItem[];
  onCountryChange: (id: string, value: string) => void;
  onOriginalPlacedOnMarketChange: (id: string, value: boolean) => void;
  onAddCountry: () => void;
  onRemoveCountry: (id: string) => void;
  readinessMessage: string;
  isReady: boolean;
};

function renderMarketInfoItemLabel(item: MarketInfoScenarioItem): string {
  return item.originalPlacedOnMarket ? `${item.country || "Pending"} · original market` : item.country || "Pending";
}

export function MarketInfoScenarioCard({
  catalogueNumber,
  primaryUdiDi,
  productFamily,
  productVariant,
  currentMarketItems,
  draftMarketItems,
  onCountryChange,
  onOriginalPlacedOnMarketChange,
  onAddCountry,
  onRemoveCountry,
  readinessMessage,
  isReady,
}: MarketInfoScenarioCardProps) {
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
          Create a standalone market information update by editing the countries that will appear in `MARKET_INFO.PUT`.
        </p>
        <div className="patch-compare-grid market-info-compare-grid">
          <div className="patch-compare-card">
            <span className="summary-label">Before</span>
            <strong>Current tracked market countries</strong>
            <p>Current variant-scoped market countries from the XML-ready source data.</p>
            <ul className="patch-compare-list market-info-country-list">
              {currentMarketItems.length ? (
                currentMarketItems.map((item) => (
                  <li key={`current-${item.id}`}>
                    <strong>{item.country}</strong>
                    <span>{item.originalPlacedOnMarket ? "Original placed on market" : "Additional market"}</span>
                  </li>
                ))
              ) : (
                <li>
                  <strong>Not resolved</strong>
                  <span>No current market countries are available.</span>
                </li>
              )}
            </ul>
          </div>
          <div className="patch-compare-card patch-compare-card-accent">
            <span className="summary-label">After</span>
            <strong>Draft Market Info scenario</strong>
            <p>Edit the country list that will be used when generating the standalone message.</p>
            <div className="market-info-editor-list">
              {draftMarketItems.map((item, index) => (
                <div key={item.id} className="market-info-editor-row">
                  <label className="market-info-field">
                    <span className="field-label">Country {index + 1}</span>
                    <input
                      className="rule-select patch-select"
                      type="text"
                      maxLength={2}
                      value={item.country}
                      onChange={(event) => onCountryChange(item.id, event.target.value)}
                      placeholder="GB"
                    />
                  </label>
                  <label className="market-info-toggle">
                    <input
                      type="checkbox"
                      checked={item.originalPlacedOnMarket}
                      onChange={(event) => onOriginalPlacedOnMarketChange(item.id, event.target.checked)}
                    />
                    <span>Original market</span>
                  </label>
                  <button
                    className="ghost-button market-info-remove-button"
                    type="button"
                    onClick={() => onRemoveCountry(item.id)}
                    disabled={draftMarketItems.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="market-info-editor-actions">
              <button className="ghost-button" type="button" onClick={onAddCountry}>
                Add country
              </button>
            </div>
            <ul className="patch-compare-list market-info-country-list market-info-draft-summary-list">
              {draftMarketItems.map((item) => (
                <li key={`draft-${item.id}`}>
                  <strong>{item.country || "Pending"}</strong>
                  <span>{renderMarketInfoItemLabel(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="workflow-note patch-readiness-note">
          <strong>{isReady ? "Draft readiness" : "Draft blocked"}</strong>
          <span>{readinessMessage}</span>
        </div>
      </div>
    </div>
  );
}
