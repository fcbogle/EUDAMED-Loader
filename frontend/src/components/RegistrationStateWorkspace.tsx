import { RegistrationCountSummary } from "./RegistrationCountSummary";
import type { RegistrationSummary } from "../types";
import { DeviceModelFilter, type ModelFilterOption } from "./DeviceModelFilter";


type RegistrationStateRow = {
  key: string;
  productFamily: string;
  productVariant: string;
  basicUdiDiLabel: string;
  parentStatusLabel: string;
  parentStatusClassName: string;
  totalDevices: number;
  registeredDevices: number;
  unknownDevices: number;
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
  registrationSummary: RegistrationSummary | null;
  isLoadingRegistrationSummary: boolean;
  registrationSummaryError: string | null;
  onRefreshCounts: () => void;
  isLoading: boolean;
  error: string | null;
  selectedFamily: string;
  selectedVariant: string;
  selectedStatus: string;
  searchText: string;
  actionableOnly: boolean;
  modelOptions: ModelFilterOption[];
  statusOptions: string[];
  rows: RegistrationStateRow[];
  onModelChange: (family: string, variant: string) => void;
  onStatusChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onActionableOnlyChange: (checked: boolean) => void;
  onReset: () => void;
};

export function RegistrationStateWorkspace({
  registrationSummary,
  isLoadingRegistrationSummary,
  registrationSummaryError,
  onRefreshCounts,
  isLoading,
  error,
  selectedFamily,
  selectedVariant,
  selectedStatus,
  searchText,
  actionableOnly,
  modelOptions,
  statusOptions,
  rows,
  onModelChange,
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
            <DeviceModelFilter
              options={modelOptions}
              family={selectedFamily}
              variant={selectedVariant}
              onChange={onModelChange}
              searchQuery={searchText}
              onSearchChange={(query) => {
                if (query.trim()) onModelChange("", "");
                onSearchChange(query);
              }}
            />
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
            {selectedFamily ? (selectedVariant ? `${selectedFamily} / ${selectedVariant}` : selectedFamily) : "All models"}
          </span>
          <span className="status-pill ok compact">Recorded SQLite snapshot</span>
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

        <RegistrationCountSummary summary={registrationSummary} isLoading={isLoadingRegistrationSummary}
          error={registrationSummaryError} onRefresh={onRefreshCounts} />

        <div className="testing-summary-table-shell registration-state-table-shell">
          <table className="workbook-files-table testing-summary-table registration-state-table">
            <thead>
              <tr>
                <th>Family / Variant</th>
                <th>Basic UDI-DI</th>
                <th>Parent</th>
                <th>Devices</th>
                <th>Registered</th>
                <th>Unknown</th>
                <th>Parent POST candidates</th>
                <th>POST XML eligible</th>
                <th>Child POST XML eligible</th>
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
                    {[row.totalDevices, row.registeredDevices, row.unknownDevices, row.seedPostCount, row.eligibleChildDeviceCount, row.childPostCount, row.patchCount, row.marketInfoCount].map((count, index) => (
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
                  <td colSpan={14} className="testing-summary-empty-cell">
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
