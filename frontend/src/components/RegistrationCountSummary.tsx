import type { RegistrationSummary } from "../types";

type Props = {
  summary: RegistrationSummary | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
};

export function RegistrationCountSummary({ summary, isLoading, error, onRefresh }: Props) {
  const counts = summary?.counts;
  const confirmed = !isLoading && !error && summary?.import_batch_id != null;
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
        <p>Confirmed awaiting registration: {counts?.awaiting_devices} ({counts?.awaiting_ready} ready, {counts?.awaiting_blocked} blocked).
          No non-registration reconciliation is currently recorded. Devices without acceptance evidence remain unknown;
          XML eligibility does not establish that they require registration.</p>
        <p>Import #{summary.import_batch_id}: {summary.imported_at}. Latest recorded acceptance: {summary.latest_acceptance_at ?? "None"}.
          Counts calculated: {summary.calculated_at}. Registration is based on this environment’s recorded evidence.
          {" "}{counts?.unresolved_parent_devices} devices in scope have an unresolved parent identifier.</p>
        <p>Whole import: {summary.source_rows} source rows; {summary.mapped_rows} canonical rows;
          {" "}{summary.outside_canonical_scope_rows} rows outside canonical scope;
          {" "}{summary.unresolved_identity_rows} canonical rows with unresolved or conflicting identity;
          {" "}{summary.duplicate_identity_rows} duplicate identity rows counted once;
          {" "}{summary.identity_issue_count} open import identity issues;
          {" "}{summary.unmatched_success_subjects} acceptance subjects unmatched to current identities.
          Unresolved and out-of-scope rows are excluded from the unique-device totals.</p>
      </>}
    </section>
  );
}
