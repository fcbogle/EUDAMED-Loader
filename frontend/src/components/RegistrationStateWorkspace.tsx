import type { ChangeEvent } from "react";

type RegistrationStateMetric = {
  label: string;
  value: string;
  detail: string;
  className?: string;
};

type RegistrationStateRow = {
  key: string;
  productFamily: string;
  productVariant: string;
  basicUdiDiLabel: string;
  parentStatusLabel: string;
  parentStatusClassName: string;
  seedPostCount: number;
  eligibleChildDeviceCount: number;
  childPostCount: number;
  patchCount: number;
  marketInfoCount: number;
  latestLabel: string;
  nextActionLabel: string;
  statusLabel: string;
  statusClassName: string;
};

type RegistrationStateWorkspaceProps = {
  isLoading: boolean;
  error: string | null;
  selectedFamily: string;
  selectedVariant: string;
  selectedStatus: string;
  searchText: string;
  actionableOnly: boolean;
  familyOptions: string[];
  variantOptions: string[];
  statusOptions: string[];
  metrics: RegistrationStateMetric[];
  rows: RegistrationStateRow[];
  onFamilyChange: (value: string) => void;
  onVariantChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onActionableOnlyChange: (checked: boolean) => void;
  onReset: () => void;
};

export function RegistrationStateWorkspace({
  isLoading,
  error,
  selectedFamily,
  selectedVariant,
  selectedStatus,
  searchText,
  actionableOnly,
  familyOptions,
  variantOptions,
  statusOptions,
  metrics,
  rows,
  onFamilyChange,
  onVariantChange,
  onStatusChange,
  onSearchChange,
  onActionableOnlyChange,
  onReset,
}: RegistrationStateWorkspaceProps) {
  return (
    <section className="tab-stack">
      <section className="panel testing-summary-panel registration-state-panel">
        <div className="section-heading section-heading-spread">
          <div>
            <span className="section-kicker">Registration Footprint</span>
            <h2>Registration State</h2>
          </div>
          <div className="testing-summary-filter-row registration-state-filter-row">
            <label className="read-model-filter-control testing-summary-filter-control" htmlFor="registration-state-family">
              <span>Family</span>
              <select
                id="registration-state-family"
                className="rule-select"
                value={selectedFamily}
                onChange={(event) => onFamilyChange(event.target.value)}
              >
                <option value="">All families</option>
                {familyOptions.map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </select>
            </label>
            <label className="read-model-filter-control testing-summary-filter-control" htmlFor="registration-state-variant">
              <span>Variant</span>
              <select
                id="registration-state-variant"
                className="rule-select"
                value={selectedVariant}
                onChange={(event) => onVariantChange(event.target.value)}
                disabled={!selectedFamily && variantOptions.length === 0}
              >
                <option value="">{selectedFamily ? "All variants" : "Select family first"}</option>
                {variantOptions.map((variant) => (
                  <option key={variant} value={variant}>
                    {variant}
                  </option>
                ))}
              </select>
            </label>
            <label className="read-model-filter-control testing-summary-filter-control" htmlFor="registration-state-status">
              <span>Status</span>
              <select
                id="registration-state-status"
                className="rule-select"
                value={selectedStatus}
                onChange={(event) => onStatusChange(event.target.value)}
              >
                <option value="">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="read-model-filter-control testing-summary-filter-control" htmlFor="registration-state-search">
              <span>Search</span>
              <input
                id="registration-state-search"
                className="text-input"
                type="search"
                value={searchText}
                placeholder="Basic UDI-DI or variant"
                onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value)}
              />
            </label>
            <label className="registration-state-toggle" htmlFor="registration-state-actionable">
              <input
                id="registration-state-actionable"
                type="checkbox"
                checked={actionableOnly}
                onChange={(event) => onActionableOnlyChange(event.target.checked)}
              />
              <span>Actionable only</span>
            </label>
            <button className="ghost-button testing-summary-clear-button" type="button" onClick={onReset}>
              Reset
            </button>
          </div>
        </div>

        <div className="testing-summary-scope-row">
          <span className="status-pill ok compact">
            {selectedFamily ? (selectedVariant ? `${selectedFamily} / ${selectedVariant}` : selectedFamily) : "All families"}
          </span>
          <span className="status-pill ok compact">SQLite live</span>
          <span className="testing-summary-latest">
            {rows.length} parent group{rows.length === 1 ? "" : "s"} in scope
          </span>
        </div>

        {isLoading ? (
          <div className="xml-refresh-indicator" aria-live="polite">
            <strong>Refreshing...</strong>
            <span>Updating registration state for the selected family, variant, and status filters.</span>
          </div>
        ) : null}
        {error ? <div className="panel error-banner testing-summary-error">{error}</div> : null}

        <section className="summary-grid testing-summary-metric-grid registration-state-metric-grid">
          {metrics.map((metric) => (
            <div className={`summary-card summary-card-kpi testing-summary-metric-card ${metric.className ?? ""}`} key={metric.label}>
              <span className="summary-label">{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.detail}</p>
            </div>
          ))}
        </section>

        <div className="testing-summary-table-shell registration-state-table-shell">
          <table className="workbook-files-table testing-summary-table registration-state-table">
            <thead>
              <tr>
                <th>Family / Variant</th>
                <th>Basic UDI-DI</th>
                <th>Parent</th>
                <th>Seed POST</th>
                <th>Eligible child devices</th>
                <th>Child POST</th>
                <th>PATCH</th>
                <th>Market Info</th>
                <th>Latest</th>
                <th>Next action</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.productFamily}</strong>
                      <div>{row.productVariant}</div>
                    </td>
                    <td>
                      <code className="testing-summary-code">{row.basicUdiDiLabel}</code>
                    </td>
                    <td>
                      <span className={row.parentStatusClassName}>{row.parentStatusLabel}</span>
                    </td>
                    {[row.seedPostCount, row.eligibleChildDeviceCount, row.childPostCount, row.patchCount, row.marketInfoCount].map((count, index) => (
                      <td key={index}>{row.statusLabel === "Loading" || row.statusLabel === "Unavailable" ? "—" : count}</td>
                    ))}
                    <td>{row.latestLabel}</td>
                    <td>{row.nextActionLabel}</td>
                    <td>
                      <span className={row.statusClassName}>{row.statusLabel}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="testing-summary-empty-cell">
                    No registration-state rows match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
