import type { TestingSubjectReadModelSummary, TestingWorkspaceSummary } from "../types";

type TestingSummaryRow = {
  key: string;
  productFamily: string;
  productVariant: string;
  basicUdiDiLabel: string;
  parentRegistered: boolean;
  parentRegisteredCount: number;
  successfulChildPostCount: number;
  availableChildPostCount: number;
  patchReadyCount: number;
  patchCompletedCount: number;
  latestVersionLabel: string;
  statusLabel: string;
  statusClassName: string;
};

type TestingMetric = {
  label: string;
  value: string;
  detail: string;
  className?: string;
};

type TestingSummaryWorkspaceProps = {
  isLoading: boolean;
  error: string | null;
  selectedFamily: string;
  selectedVariant: string;
  familyOptions: string[];
  variantOptions: string[];
  onFamilyChange: (value: string) => void;
  onVariantChange: (value: string) => void;
  onClearFilters: () => void;
  workspaceSummary: TestingWorkspaceSummary | null;
  metrics: TestingMetric[];
  rows: TestingSummaryRow[];
  recentSubjects: TestingSubjectReadModelSummary[];
};

function recentActivityLabel(summary: TestingSubjectReadModelSummary): string {
  if (summary.latest_successful_version && Number(summary.latest_successful_version) > 1) {
    return "PATCH";
  }
  if (summary.has_successful_device_post) {
    return "Parent POST";
  }
  if (summary.has_successful_child_post_or_patch) {
    return "Child POST";
  }
  return "Recorded";
}

export function TestingSummaryWorkspace({
  isLoading,
  error,
  selectedFamily,
  selectedVariant,
  familyOptions,
  variantOptions,
  onFamilyChange,
  onVariantChange,
  onClearFilters,
  workspaceSummary,
  metrics,
  rows,
  recentSubjects,
}: TestingSummaryWorkspaceProps) {
  return (
    <section className="tab-stack">
      <section className="panel testing-summary-panel">
        <div className="section-heading section-heading-spread">
          <div>
            <span className="section-kicker">Playground State</span>
            <h2>Testing Summary</h2>
          </div>
          <div className="testing-summary-filter-row">
            <label className="read-model-filter-control testing-summary-filter-control" htmlFor="testing-summary-family">
              <span>Family</span>
              <select
                id="testing-summary-family"
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
            <label className="read-model-filter-control testing-summary-filter-control" htmlFor="testing-summary-variant">
              <span>Variant</span>
              <select
                id="testing-summary-variant"
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
            <button className="ghost-button testing-summary-clear-button" type="button" onClick={onClearFilters}>
              Clear filters
            </button>
          </div>
        </div>

        <div className="testing-summary-scope-row">
          <span className="status-pill ok compact">
            {selectedFamily ? (selectedVariant ? `${selectedFamily} / ${selectedVariant}` : selectedFamily) : "All families"}
          </span>
          <span className="status-pill ok compact">SQLite live</span>
          {workspaceSummary?.latest_tested_at ? (
            <span className="testing-summary-latest">Latest success {workspaceSummary.latest_tested_at}</span>
          ) : (
            <span className="testing-summary-latest">No recorded success yet</span>
          )}
        </div>

        {isLoading ? (
          <div className="xml-refresh-indicator" aria-live="polite">
            <strong>Refreshing...</strong>
            <span>Updating the testing summary for the current family and variant filter.</span>
          </div>
        ) : null}
        {error ? <div className="panel error-banner testing-summary-error">{error}</div> : null}

        <section className="summary-grid testing-summary-metric-grid">
          {metrics.map((metric) => (
            <div className={`summary-card summary-card-kpi testing-summary-metric-card ${metric.className ?? ""}`} key={metric.label}>
              <span className="summary-label">{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.detail}</p>
            </div>
          ))}
        </section>

        <div className="testing-summary-table-shell">
          <table className="workbook-files-table testing-summary-table">
            <thead>
              <tr>
                <th>Family / Variant</th>
                <th>Basic UDI-DI</th>
                <th>Parent</th>
                <th>Child POST</th>
                <th>PATCH</th>
                <th>Latest</th>
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
                      <span className={row.parentRegistered ? "status-pill ok compact" : "status-pill warn compact"}>
                        {row.parentRegistered ? `${row.parentRegisteredCount} registered` : "Not registered"}
                      </span>
                    </td>
                    <td>{`${row.successfulChildPostCount} done · ${row.availableChildPostCount} open`}</td>
                    <td>{`${row.patchCompletedCount} done · ${row.patchReadyCount} ready`}</td>
                    <td>{row.latestVersionLabel}</td>
                    <td>
                      <span className={row.statusClassName}>{row.statusLabel}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="testing-summary-empty-cell">
                    No testing summary rows match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="workflow-note testing-summary-activity-strip">
          <strong>Recent successful testing</strong>
          <div className="testing-summary-activity-row">
            {recentSubjects.length ? (
              recentSubjects.map((summary) => (
                <span className="testing-summary-activity-chip" key={summary.id}>
                  {recentActivityLabel(summary)} · {summary.catalogue_number ?? summary.primary_udi_di ?? "Unknown"} ·{" "}
                  {summary.latest_successful_version ? `v${summary.latest_successful_version}` : "v1"}
                </span>
              ))
            ) : (
              <span className="testing-summary-activity-chip">No successful testing recorded in this scope.</span>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
