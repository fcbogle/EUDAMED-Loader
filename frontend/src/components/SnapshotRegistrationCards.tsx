import { useEffect, useState } from "react";
import { api } from "../api";
import type { RegistrationSummary } from "../types";

type Props = {
  importBatchId: number | null;
  environment: "dev" | "prod" | null;
};

type Result = {
  requestKey: string;
  summary: RegistrationSummary | null;
  error: string | null;
};

export function SnapshotRegistrationCards({ importBatchId, environment }: Props) {
  const [result, setResult] = useState<Result | null>(null);
  const requestKey = `${environment}|${importBatchId}`;
  const enabled = environment !== null && importBatchId !== null;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // These cards cover the entire import, independently of other workspace filters.
    api.registrationSummary({})
      .then(summary => {
        if (cancelled) return;
        if (summary.import_batch_id !== importBatchId) {
          throw new Error("The import changed. Reload Submission Data to obtain current counts.");
        }
        setResult({ requestKey, summary, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setResult({ requestKey, summary: null, error: error.message });
      });
    return () => { cancelled = true; };
  }, [enabled, importBatchId, requestKey]);

  const current = enabled && result?.requestKey === requestKey ? result : null;
  const counts = current?.summary?.counts;
  const loading = enabled && !current;
  return <>
    <div className="summary-card summary-card-kpi summary-card-kpi-post">
      <span className="summary-label">Awaiting registration</span>
      <strong>{counts ? counts.awaiting_devices.toLocaleString("en-GB") : "—"}</strong>
      <p>Devices awaiting recorded registration</p>
      {counts && counts.unknown_devices > 0 && <p>{counts.unknown_devices.toLocaleString("en-GB")} devices have unknown registration status; see Registration State.</p>}
      {loading && <p role="status">Updating registration counts…</p>}
      {current?.error && <p role="alert">Registration counts unavailable: {current.error} Refresh the page to try again.</p>}
    </div>
    <div className="summary-card summary-card-kpi summary-card-kpi-patch">
      <span className="summary-label">Registered</span>
      <strong>{counts ? counts.registered_devices.toLocaleString("en-GB") : "—"}</strong>
      <p>Devices with recorded registration evidence</p>
    </div>
  </>;
}
