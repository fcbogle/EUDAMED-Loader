import type { ReactNode } from "react";

type XmlWorkspaceHeaderProps = {
  title: string;
  statusLabel?: string;
  statusClassName?: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function XmlWorkspaceHeader({
  title,
  statusLabel,
  statusClassName = "status-pill ok compact",
  subtitle,
  actions,
}: XmlWorkspaceHeaderProps) {
  return (
    <div className="draft-card-head">
      <div>
        <strong>{title}</strong>
        {subtitle ? <p className="panel-copy">{subtitle}</p> : null}
      </div>
      <div className="draft-card-head-actions">
        {actions}
        {statusLabel ? <span className={statusClassName}>{statusLabel}</span> : null}
      </div>
    </div>
  );
}
