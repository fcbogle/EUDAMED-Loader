import { Fragment, useEffect, useState } from "react";

import { api } from "../api";
import type { TestingBatchHistory, TestingBatchReadModelEntry } from "../types";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not acknowledged";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function statusClassName(batch: TestingBatchReadModelEntry): string {
  if (batch.status === "acknowledged_success") {
    return "status-pill ok compact";
  }
  if (batch.status === "acknowledged_partial" || batch.error_device_count > 0) {
    return "status-pill warn compact";
  }
  return "status-pill compact";
}

function statusLabel(batch: TestingBatchReadModelEntry): string {
  if (batch.status === "acknowledged_success") {
    return "Acknowledged";
  }
  if (batch.status === "acknowledged_partial") {
    return "Partial outcome";
  }
  return "Generated";
}

export function SubmissionBatchHistory() {
  const [batches, setBatches] = useState<TestingBatchReadModelEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, TestingBatchHistory>>({});
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api
      .testingBatches({ limit: 200 })
      .then((response) => {
        if (!cancelled) {
          setBatches(response);
        }
      })
      .catch((requestError: Error) => {
        if (!cancelled) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleDetail(batchId: string): void {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      setDetailError(null);
      return;
    }
    setExpandedBatchId(batchId);
    setDetailError(null);
    if (histories[batchId]) {
      return;
    }
    void api
      .testingBatchHistory(batchId)
      .then((history) => {
        setHistories((current) => ({ ...current, [batchId]: history }));
      })
      .catch((requestError: Error) => {
        setDetailError(requestError.message);
      });
  }

  return (
    <section className="content-grid single-panel-grid">
      <div className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Submission Audit</span>
            <h2>Batch History</h2>
          </div>
        </div>
        <p className="panel-copy">
          Generated submissions remain pending until a corresponding EUDAMED acknowledgement is uploaded. Single-device submissions contain one device; bulk submissions contain all devices in the package.
        </p>
        {isLoading ? <p className="panel-copy">Loading batch history...</p> : null}
        {error ? <div className="panel error-banner">Batch history is unavailable: {error}</div> : null}
        {!isLoading && !error ? (
          <div className="testing-summary-table-shell">
            <table className="workbook-files-table testing-summary-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Operation</th>
                  <th>Scope</th>
                  <th>Devices</th>
                  <th>Outcome</th>
                  <th>Response</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {batches.length ? (
                  batches.map((batch) => {
                    const history = histories[batch.batch_id];
                    const isExpanded = expandedBatchId === batch.batch_id;
                    return (
                      <Fragment key={batch.batch_id}>
                        <tr key={batch.batch_id}>
                          <td>{formatDateTime(batch.created_at)}</td>
                          <td>
                            <strong>{batch.message_type}</strong>
                            <div>{batch.product_family ?? "Unscoped"}{batch.product_variant ? ` / ${batch.product_variant}` : ""}</div>
                          </td>
                          <td>{batch.basic_udi_di ?? batch.operation_scope}</td>
                          <td>{batch.device_count}</td>
                          <td>
                            <span className={statusClassName(batch)}>{statusLabel(batch)}</span>
                            <div>{`${batch.successful_device_count} success · ${batch.error_device_count} error · ${batch.pending_device_count} pending`}</div>
                          </td>
                          <td>{batch.acknowledgement_source_file_name ?? "Awaiting acknowledgement"}</td>
                          <td>
                            <button className="ghost-button" type="button" onClick={() => toggleDetail(batch.batch_id)}>
                              {isExpanded ? "Hide" : "View"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr key={`${batch.batch_id}-detail`}>
                            <td colSpan={7}>
                              {detailError ? <div className="panel error-banner">Batch detail is unavailable: {detailError}</div> : null}
                              {!detailError && !history ? <p className="panel-copy">Loading device outcomes...</p> : null}
                              {history ? (
                                <>
                                  <p className="panel-copy">
                                    Correlation <code>{history.batch.batch_id}</code>. Acknowledged {formatDateTime(history.batch.acknowledged_at)}.
                                  </p>
                                  <table className="workbook-files-table">
                                    <thead>
                                      <tr>
                                        <th>Catalogue</th>
                                        <th>UDI-DI</th>
                                        <th>Generated event</th>
                                        <th>Acknowledgement event</th>
                                        <th>Outcome</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {history.devices.map((device) => (
                                        <tr key={device.subject_id}>
                                          <td>{device.catalogue_number ?? "Unknown"}</td>
                                          <td>{device.primary_udi_di ?? "Unknown"}</td>
                                          <td>{device.generated_event_id ?? "Not recorded"}</td>
                                          <td>{device.acknowledgement_event_id ?? "Pending"}</td>
                                          <td>{device.outcome_status ?? "Pending"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="testing-summary-empty-cell">No generated submissions are recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
