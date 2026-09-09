import type { XmlMode } from "../useXmlOperationAssessment";
import type { OperationAssessment } from "../types";

type AssessmentSummaryRow = {
  label: string;
  value: string;
};

type XmlOperationAssessmentPanelProps = {
  xmlMode: XmlMode;
  xmlAssessmentTitle: string;
  isLoadingXmlOperationAssessment: boolean;
  xmlOperationAssessment: OperationAssessment | null;
  statusClassName: string;
  statusLabel: string;
  xmlAssessmentSummaryRows: AssessmentSummaryRow[];
  xmlOperationAssessmentError: string | null;
  hasResolvedPostAssessmentCandidate: boolean;
  assessedPostCandidateCatalogueNumber: string | null;
  assessedPostCandidatePrimaryUdiDi: string | null;
  selectedXmlFamily: string | null;
  selectedXmlVariant: string | null;
  selectedBulkEligiblePostCount: number;
  selectedXmlVariantXmlReadyRecords: number;
  selectedXmlVariantBlockedRecords: number;
  selectedXmlVariantTotalRecords: number;
};

export function XmlOperationAssessmentPanel({
  xmlMode,
  xmlAssessmentTitle,
  isLoadingXmlOperationAssessment,
  xmlOperationAssessment,
  statusClassName,
  statusLabel,
  xmlAssessmentSummaryRows,
  xmlOperationAssessmentError,
  hasResolvedPostAssessmentCandidate,
  assessedPostCandidateCatalogueNumber,
  assessedPostCandidatePrimaryUdiDi,
  selectedXmlFamily,
  selectedXmlVariant,
  selectedBulkEligiblePostCount,
  selectedXmlVariantXmlReadyRecords,
  selectedXmlVariantBlockedRecords,
  selectedXmlVariantTotalRecords,
}: XmlOperationAssessmentPanelProps) {
  return (
    <div className="draft-card bulk-patch-summary-bar">
      <div className="draft-card-head">
        <strong>{xmlAssessmentTitle}</strong>
        <span className={statusClassName}>{statusLabel}</span>
      </div>
      {isLoadingXmlOperationAssessment ? (
        <div className="xml-refresh-indicator" aria-live="polite">
          <strong>Refreshing...</strong>
          <span>Updating the current operation assessment for the selected family and variant.</span>
        </div>
      ) : null}
      <div className="bulk-patch-summary-row">
        {xmlMode === "post" && xmlOperationAssessment ? (
          <div className="post-assessment-layout">
            <div className="post-assessment-hero">
              {hasResolvedPostAssessmentCandidate ? (
                <div className="post-assessment-hero-row">
                  <div className="post-assessment-hero-item">
                    <span className="summary-label">Candidate</span>
                    <strong>{assessedPostCandidateCatalogueNumber ?? "Not resolved"}</strong>
                    {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                  </div>
                  <div className="post-assessment-hero-item post-assessment-hero-item-secondary">
                    <span className="summary-label">Device UDI-DI</span>
                    <strong>{assessedPostCandidatePrimaryUdiDi ?? "Not resolved"}</strong>
                    {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                  </div>
                </div>
              ) : (
                <div className="post-assessment-empty-state">
                  <span className="summary-label">Selected scope</span>
                  <strong>
                    {selectedXmlFamily ?? "No family selected"} / {selectedXmlVariant ?? "No variant selected"}
                  </strong>
                  {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                  <p className="panel-copy">
                    No POST candidate could be resolved from the current canonical validation and tracked SQLite testing state.
                  </p>
                </div>
              )}
            </div>
            {hasResolvedPostAssessmentCandidate ? (
              <div className="post-assessment-chip-row">
                {xmlAssessmentSummaryRows.map((row) => (
                  <div
                    className={
                      row.value === "Not yet registered"
                        ? "queue-chip post-assessment-chip post-assessment-chip-highlight"
                        : "queue-chip post-assessment-chip"
                    }
                    key={row.label}
                  >
                    <strong>{row.value}</strong>
                    <span>{row.label}</span>
                    {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="post-assessment-chip-row">
                <div className="queue-chip post-assessment-chip">
                  <strong>{selectedBulkEligiblePostCount}</strong>
                  <span>POST rows in variant</span>
                  {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                </div>
                <div className="queue-chip post-assessment-chip">
                  <strong>{selectedXmlVariantXmlReadyRecords}</strong>
                  <span>XML-ready rows in variant</span>
                  {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                </div>
                <div className="queue-chip post-assessment-chip">
                  <strong>{selectedXmlVariantBlockedRecords}</strong>
                  <span>blocked rows in variant</span>
                  {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                </div>
                <div className="queue-chip post-assessment-chip">
                  <strong>{selectedXmlVariantTotalRecords}</strong>
                  <span>total rows in variant</span>
                  {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bulk-patch-summary-metrics">
            {xmlAssessmentSummaryRows.map((row) => (
              <div className="workflow-note patch-readiness-note bulk-patch-summary-tile" key={row.label}>
                <strong>{row.label}</strong>
                <span>{row.value}</span>
                {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>
      {xmlMode === "post" && xmlOperationAssessment ? (
        <div className="post-assessment-interpretation">
          <strong>Interpretation</strong>
          <p>{xmlOperationAssessment.summary_message}</p>
        </div>
      ) : (
        <p className="panel-copy bulk-patch-summary-status">
          {isLoadingXmlOperationAssessment
            ? "Checking the selected operation against current canonical validation and tracked SQLite testing state."
            : xmlOperationAssessment?.summary_message ??
              xmlOperationAssessmentError ??
              "Operation assessment is not available for this selection."}
        </p>
      )}
      {xmlOperationAssessment?.blocking_reasons.length ? (
        <div className="roadmap-list">
          {xmlOperationAssessment.blocking_reasons.map((reason, index) => (
            <div className="roadmap-item" key={`${reason}-${index}`}>
              <strong>{xmlOperationAssessment.status === "blocked" ? "Why blocked" : "Needs attention"}</strong>
              <p>{reason}</p>
            </div>
          ))}
        </div>
      ) : null}
      {xmlOperationAssessment?.recommended_next_action ? (
        <div className={xmlMode === "post" ? "workflow-note post-assessment-action" : "workflow-note"}>
          <strong>Recommended next action</strong>
          <span>{xmlOperationAssessment.recommended_next_action}</span>
        </div>
      ) : null}
    </div>
  );
}
