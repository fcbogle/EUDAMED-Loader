import { DeviceModelFilter, type ModelFilterOption } from "./DeviceModelFilter";
import { Fragment, useEffect, useMemo, useState } from "react";

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
  marketInfoReadyCount: number;
  marketInfoCompletedCount: number;
  latestPatchLabel: string;
  latestMarketInfoLabel: string;
  statusLabel: string;
  statusClassName: string;
};

type TestingMetric = {
  label: string;
  value: string;
  detail: string;
  className?: string;
};

type TestingEventRow = {
  key: string;
  testedAt: string;
  productFamily: string;
  productVariant: string;
  catalogueNumber: string;
  operationLabel: string;
  versionLabel: string;
  scenarioLabel: string;
  resultLabel: string;
  detailsSummary: string | null;
  addedCountries: string[];
  removedCountries: string[];
  originalMarketBefore: string | null;
  originalMarketAfter: string | null;
};

type TestingSummaryWorkspaceProps = {
  title: string;
  stateLabel: string;
  isLoading: boolean;
  error: string | null;
  searchText: string;
  onSearchChange: (query: string) => void;
  selectedFamily: string;
  selectedVariant: string;
  modelOptions: ModelFilterOption[];
  onModelChange: (family: string, variant: string) => void;
  onClearFilters: () => void;
  workspaceSummary: TestingWorkspaceSummary | null;
  metrics: TestingMetric[];
  rows: TestingSummaryRow[];
  eventRows: TestingEventRow[];
  recentSubjects: TestingSubjectReadModelSummary[];
};

function recentActivityLabel(summary: TestingSubjectReadModelSummary): string {
  if (summary.latest_success_message_type === "MARKET_INFO.PUT") {
    return "Market Info";
  }
  if (summary.latest_success_message_type === "UDI_DI.PATCH") {
    return "PATCH";
  }
  if (summary.latest_success_message_type === "DEVICE.POST") {
    return "Parent POST";
  }
  if (summary.latest_success_message_type === "UDI_DI.POST") {
    return "Child POST";
  }
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
  title,
  stateLabel,
  isLoading,
  error,
  searchText,
  onSearchChange,
  selectedFamily,
  selectedVariant,
  modelOptions,
  onModelChange,
  onClearFilters,
  workspaceSummary,
  metrics,
  rows,
  eventRows,
  recentSubjects,
}: TestingSummaryWorkspaceProps) {
  const [eventPage, setEventPage] = useState(1);
  const [eventPageSize, setEventPageSize] = useState(25);
  const [expandedEventKey, setExpandedEventKey] = useState<string | null>(null);
  useEffect(() => {
    setEventPage(1);
    setExpandedEventKey(null);
  }, [selectedFamily, selectedVariant, searchText]);
  const totalEventPages = Math.max(1, Math.ceil(eventRows.length / eventPageSize));
  const currentEventPage = Math.min(eventPage, totalEventPages);
  const pagedEventRows = useMemo(() => {
    const startIndex = (currentEventPage - 1) * eventPageSize;
    return eventRows.slice(startIndex, startIndex + eventPageSize);
  }, [currentEventPage, eventPageSize, eventRows]);
  const showingFrom = eventRows.length ? (currentEventPage - 1) * eventPageSize + 1 : 0;
  const showingTo = eventRows.length ? Math.min(currentEventPage * eventPageSize, eventRows.length) : 0;

  return (
    <section className="tab-stack">
      <section className="panel testing-summary-panel testing-summary-search-panel">
        <div className="section-heading section-heading-spread">
          <div>
            <span className="section-kicker">{stateLabel}</span>
            <h2>{title}</h2>
          </div>
          <div className="testing-summary-filter-row">
            <DeviceModelFilter options={modelOptions} family={selectedFamily} variant={selectedVariant} onChange={onModelChange}
              searchQuery={searchText} onSearchChange={(query) => {
                if (query.trim()) onModelChange("", "");
                onSearchChange(query);
              }} />
            <button className="ghost-button testing-summary-clear-button" type="button" onClick={onClearFilters}>
              Clear filters
            </button>
          </div>
        </div>

        <div className="testing-summary-scope-row">
          <span className="status-pill ok compact">
            {selectedFamily ? (selectedVariant ? `${selectedFamily} / ${selectedVariant}` : selectedFamily) : "All models"}
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
                <th>Market Info</th>
                <th>Patch Latest</th>
                <th>Market Info Latest</th>
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
                    <td>{`${row.marketInfoCompletedCount} done · ${row.marketInfoReadyCount} ready`}</td>
                    <td>{row.latestPatchLabel}</td>
                    <td>{row.latestMarketInfoLabel}</td>
                    <td>
                      <span className={row.statusClassName}>{row.statusLabel}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="testing-summary-empty-cell">
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
                  {summary.latest_success_message_type === "MARKET_INFO.PUT"
                    ? summary.latest_successful_market_info_version
                      ? `market v${summary.latest_successful_market_info_version}`
                      : "market version recorded"
                    : summary.latest_successful_version
                      ? `v${summary.latest_successful_version}`
                      : "v1"}
                </span>
              ))
            ) : (
              <span className="testing-summary-activity-chip">No successful testing recorded in this scope.</span>
            )}
          </div>
        </div>

        <div className="testing-summary-table-shell">
          <div className="section-heading">
            <h3>Testing Events</h3>
          </div>
          <div className="testing-events-pagination-bar">
            <span className="testing-summary-latest">{`Showing ${showingFrom}-${showingTo} of ${eventRows.length} events`}</span>
            <div className="testing-events-pagination-controls">
              <label className="read-model-filter-control testing-summary-filter-control testing-events-page-size" htmlFor="testing-events-page-size">
                <span>Rows</span>
                <select
                  id="testing-events-page-size"
                  className="rule-select"
                  value={String(eventPageSize)}
                  onChange={(event) => {
                    setEventPageSize(Number(event.target.value));
                    setEventPage(1);
                  }}
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <button
                className="ghost-button testing-summary-clear-button"
                type="button"
                onClick={() => setEventPage((page) => Math.max(1, page - 1))}
                disabled={currentEventPage <= 1}
              >
                Previous
              </button>
              <span className="status-pill ok compact">{`Page ${currentEventPage} of ${totalEventPages}`}</span>
              <button
                className="ghost-button testing-summary-clear-button"
                type="button"
                onClick={() => setEventPage((page) => Math.min(totalEventPages, page + 1))}
                disabled={currentEventPage >= totalEventPages}
              >
                Next
              </button>
            </div>
          </div>
          <table className="workbook-files-table testing-summary-table">
            <thead>
              <tr>
                <th>Tested at</th>
                <th>Family</th>
                <th>Variant</th>
                <th>Catalogue</th>
                <th>Operation</th>
                <th>Version</th>
                <th>Scenario</th>
                <th>Details</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {pagedEventRows.length ? (
                pagedEventRows.map((row) => (
                  <Fragment key={row.key}>
                    <tr>
                      <td>{row.testedAt}</td>
                      <td>{row.productFamily}</td>
                      <td>{row.productVariant}</td>
                      <td>
                        <code className="testing-summary-code">{row.catalogueNumber}</code>
                      </td>
                      <td>{row.operationLabel}</td>
                      <td>{row.versionLabel}</td>
                      <td>{row.scenarioLabel}</td>
                      <td>
                        {row.detailsSummary ? (
                          <button
                            className="ghost-button testing-summary-clear-button"
                            type="button"
                            onClick={() => setExpandedEventKey((current) => (current === row.key ? null : row.key))}
                          >
                            {expandedEventKey === row.key ? `Hide · ${row.detailsSummary}` : `View · ${row.detailsSummary}`}
                          </button>
                        ) : (
                          <span className="testing-summary-latest">No detail</span>
                        )}
                      </td>
                      <td>
                        <span className="status-pill ok compact">{row.resultLabel}</span>
                      </td>
                    </tr>
                    {expandedEventKey === row.key ? (
                      <tr>
                        <td colSpan={9} className="testing-summary-event-detail-cell">
                          <div className="workflow-note">
                            <strong>Event detail</strong>
                            <p>
                              Added countries: {row.addedCountries.length ? row.addedCountries.join(", ") : "None"}
                            </p>
                            <p>
                              Removed countries: {row.removedCountries.length ? row.removedCountries.join(", ") : "None"}
                            </p>
                            <p>
                              Original market: {row.originalMarketBefore ?? "None"} to {row.originalMarketAfter ?? "None"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="testing-summary-empty-cell">
                    No successful testing events match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="testing-events-pagination-bar testing-events-pagination-bar-bottom">
            <span className="testing-summary-latest">{`Showing ${showingFrom}-${showingTo} of ${eventRows.length} events`}</span>
            <div className="testing-events-pagination-controls">
              <button
                className="ghost-button testing-summary-clear-button"
                type="button"
                onClick={() => setEventPage((page) => Math.max(1, page - 1))}
                disabled={currentEventPage <= 1}
              >
                Previous
              </button>
              <span className="status-pill ok compact">{`Page ${currentEventPage} of ${totalEventPages}`}</span>
              <button
                className="ghost-button testing-summary-clear-button"
                type="button"
                onClick={() => setEventPage((page) => Math.min(totalEventPages, page + 1))}
                disabled={currentEventPage >= totalEventPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
