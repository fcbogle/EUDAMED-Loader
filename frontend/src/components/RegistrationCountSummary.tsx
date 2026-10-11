import type { RegistrationSummary } from "../types";

type Props = {
  summary: RegistrationSummary | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
};

function readableDate(value: string | null): string {
  if (!value) return "not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  }).format(date);
}

const readableCount = (value: number) => value.toLocaleString("en-GB");

export function RegistrationCountSummary({ summary, isLoading, error, onRefresh }: Props) {
  const counts = summary?.counts;
  const confirmed = !isLoading && !error && summary?.import_batch_id != null;
  const hasDataExceptions = summary && (
    summary.outside_canonical_scope_rows > 0 || summary.unresolved_identity_rows > 0 ||
    summary.identity_issue_count > 0 || summary.unmatched_success_subjects > 0 ||
    (counts?.unresolved_parent_devices ?? 0) > 0
  );
  const dataChecks = summary ? [
    [summary.outside_canonical_scope_rows, "source rows could not be mapped"],
    [summary.unresolved_identity_rows, "rows have missing or conflicting device identifiers"],
    [summary.duplicate_identity_rows, "duplicate rows were counted only once"],
    [summary.identity_issue_count, "device identity issues need review"],
    [summary.unmatched_success_subjects, "registration confirmation records could not be matched to current devices"],
    [counts?.unresolved_parent_devices ?? 0, "devices could not be linked to a Basic UDI-DI"],
  ].filter(([count]) => Number(count) > 0) : [];
  const metrics = [
    ["Basic UDI-DI parents", counts?.total_parents, "unique resolved parent identifiers in scope"],
    ["Parents registered", counts?.registered_parents, "confirmed acceptance"],
    ["Parents unknown", counts?.unknown_parents, "registration not established"],
    ["UDI-DI devices", counts?.total_devices, "unique identifiers and issuing entities"],
    ["Devices registered", counts?.registered_devices, "confirmed acceptance"],
    ["Devices unknown", counts?.unknown_devices, "registration not established"],
    ["POST XML eligible", counts?.post_ready, "draft eligibility; includes unknown status"],
    ["Child POST XML eligible", counts?.child_post_ready, "drafts with a tracked registered parent"],
    ["PATCH ready", counts?.patch_ready, "current generation assessment"],
    ["Market Info ready", counts?.market_info_ready, "current generation assessment"],
  ] as const;
  return (
    <section aria-label="Reconciled registration counts">
      <div className="section-heading section-heading-spread">
        <h3>Registration counts</h3>
        <button type="button" className="ghost-button" onClick={onRefresh} disabled={isLoading}>Refresh counts</button>
      </div>
      {isLoading && <p role="status">Calculating registration counts…</p>}
      {error && <p role="alert" className="error-banner">{error}</p>}
      {!isLoading && !error && !summary?.import_batch_id && <p>Import workbooks before registration counts are available.</p>}
      <div className="summary-grid testing-summary-metric-grid">
        {metrics.map(([label, value, detail]) => (
          <div className="summary-card summary-card-kpi testing-summary-metric-card" key={label}>
            <span className="summary-label">{label}</span>
            <strong>{confirmed ? value : "—"}</strong>
            <p>{detail}</p>
          </div>
        ))}
      </div>
      {confirmed && summary && <>
        <p>Awaiting registration: {counts?.awaiting_devices} · {counts?.awaiting_ready} ready · {counts?.awaiting_blocked} blocked.</p>
        {(counts?.unknown_devices ?? 0) > 0 && <p>Confirm unknown registration status before generating POST.</p>}
        {hasDataExceptions && <p className="status-detail-emphasis">Import data needs review; see Details.</p>}
        <details className="registration-count-details">
        <summary>Details</summary>
        <p>Workbook imported: {readableDate(summary.imported_at)} (import {summary.import_batch_id}).
          {" "}Counts updated: {readableDate(summary.calculated_at)}.</p>
        <p>{summary.latest_acceptance_at ? <>Latest registration confirmation: {readableDate(summary.latest_acceptance_at)}.</> :
          "Latest registration confirmation date: not available."}
          {" "}These figures use the data and registration confirmations recorded in this environment.</p>
        {(counts?.unknown_devices ?? 0) > 0 && <p>A device stays Unknown until its registration status is confirmed.
          Being ready for XML does not mean it needs registration.</p>}
        <p>Across the full import, {readableCount(summary.source_rows)} source rows were read and {readableCount(summary.mapped_rows)} were mapped for review.
          {!hasDataExceptions ? " No outstanding data issues were found." : " The following checks need attention."}</p>
        {dataChecks.length > 0 && <ul>{dataChecks.map(([count, message]) => <li key={message}>{readableCount(Number(count))} {message}.</li>)}</ul>}
        {(summary.unresolved_identity_rows > 0 || summary.outside_canonical_scope_rows > 0) &&
          <p>Rows that could not be mapped or identified are excluded from the device totals.</p>}
        </details>
      </>}
    </section>
  );
}
