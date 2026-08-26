import type { ReactNode } from "react";

import { XmlWorkspaceHeader } from "./XmlWorkspaceHeader";

type XmlAssessmentCardProps = {
  title: string;
  statusLabel?: string;
  statusClassName?: string;
  subtitle?: string;
  isRefreshing?: boolean;
  children: ReactNode;
};

export function XmlAssessmentCard({
  title,
  statusLabel,
  statusClassName,
  subtitle,
  isRefreshing = false,
  children,
}: XmlAssessmentCardProps) {
  return (
    <div className="draft-card">
      <XmlWorkspaceHeader
        title={title}
        statusLabel={statusLabel}
        statusClassName={statusClassName}
        subtitle={subtitle}
      />
      {isRefreshing ? (
        <div className="xml-refresh-indicator" aria-live="polite">
          <strong>Refreshing...</strong>
          <span>Updating this panel for the selected family and variant.</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}
