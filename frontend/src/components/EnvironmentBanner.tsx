import { useEffect, useState } from "react";
import { api } from "../api";

type Environment = "dev" | "prod";

export function EnvironmentBanner() {
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setFailed(false);
    setEnvironment(null);
    api.environment(controller.signal).then(result => {
      if (result.environment !== "dev" && result.environment !== "prod") throw new Error("Unknown environment");
      if (!cancelled) setEnvironment(result.environment);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    }).finally(() => window.clearTimeout(timeout));
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timeout); };
  }, [attempt]);
  return (
    <aside className={`environment-banner ${environment ?? "unknown"}`} aria-label="Application environment">
      <span className="environment-ribbon">{environment === "dev" ? "PLAY" : environment === "prod" ? "PRODUCTION" : "UNCONFIRMED"}</span>
      <div role="status">
        <strong>{environment === "dev" ? "EUDAMED Playground" : environment === "prod" ? "EUDAMED Production" : "Confirming EUDAMED environment"}</strong>
        <span>{environment === "dev" ? "Dev environment · Playground testing data" : environment === "prod" ? "Production environment · Production data" : failed ? "Environment could not be verified. Check the backend connection." : "Checking the active backend profile…"}</span>
      </div>
      {failed && <button type="button" className="ghost-button" onClick={() => setAttempt(value => value + 1)}>Retry</button>}
    </aside>
  );
}
