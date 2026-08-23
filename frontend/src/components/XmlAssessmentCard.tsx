import type { ReactNode } from "react";

import { XmlWorkspaceHeader } from "./XmlWorkspaceHeader";

type XmlAssessmentCardProps = {
  title: string;
  statusLabel?: string;
  statusClassName?: string;
  subtitle?: string;
  children: ReactNode;
};

export function XmlAssessmentCard({
  title,
  statusLabel,
  statusClassName,
  subtitle,
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
      {children}
    </div>
  );
}
