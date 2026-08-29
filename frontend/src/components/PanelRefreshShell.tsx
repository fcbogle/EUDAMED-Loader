import type { ReactNode } from "react";

type PanelRefreshShellProps = {
  isRefreshing: boolean;
  message: string;
  children: ReactNode;
  className?: string;
};

export function PanelRefreshShell({
  isRefreshing,
  message,
  children,
  className,
}: PanelRefreshShellProps) {
  return (
    <div className={isRefreshing ? `panel-refresh-shell is-refreshing ${className ?? ""}`.trim() : className}>
      {isRefreshing ? (
        <div className="panel-refresh-banner" aria-live="polite">
          <span className="panel-refresh-chip">Refreshing</span>
          <span className="panel-refresh-message">{message}</span>
        </div>
      ) : null}
      <div className={isRefreshing ? "panel-refresh-body is-stale" : "panel-refresh-body"}>
        {children}
      </div>
    </div>
  );
}
