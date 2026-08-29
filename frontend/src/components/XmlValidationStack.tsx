import type { BulkMarketInfoPreview, BulkPatchPreview, BulkPostPreview, BulkUdidiPostPreview, XmlValidationResult } from "../types";

type BulkExclusionSummary = {
  key: string;
  title: string;
  detail: string;
};

type XmlValidationStackProps = {
  showGenericValidationCards: boolean;
  xmlModeLabel: "single" | "marketInfo" | "patch" | "bulkPost" | "bulkUdidiPost" | "bulkPatch" | "bulkMarketInfo";
  selectedBatchValidation: XmlValidationResult | null;
  xmlPatchValidationSchemaPath: string | null;
  xmlPatchValidationValid: boolean | null;
  selectedBulkPreview: BulkPostPreview | BulkUdidiPostPreview | BulkPatchPreview | BulkMarketInfoPreview | null;
  bulkChunkSummaryTitle: string;
  selectedBulkExclusionSummaries: BulkExclusionSummary[];
};

export function XmlValidationStack({
  showGenericValidationCards,
  xmlModeLabel,
  selectedBatchValidation,
  xmlPatchValidationSchemaPath,
  xmlPatchValidationValid,
  selectedBulkPreview,
  bulkChunkSummaryTitle,
  selectedBulkExclusionSummaries,
}: XmlValidationStackProps) {
  return (
    <div
      className={
        xmlModeLabel === "bulkPatch" || xmlModeLabel === "bulkPost" || xmlModeLabel === "bulkUdidiPost" || xmlModeLabel === "bulkMarketInfo"
          ? "draft-list xml-validation-stack bulk-patch-validation-stack"
          : "draft-list xml-validation-stack"
      }
    >
      {showGenericValidationCards ? (
        <>
          <div className="draft-card">
            <div className="draft-card-head">
              <strong>Schema target</strong>
              <span className="status-pill ok compact">Message.xsd</span>
            </div>
            <p className="panel-copy">
              Generated XML is validated against the wrapped EUDAMED service-message schema set rooted at `Message.xsd`.
            </p>
          </div>
          <div className="draft-card">
            <div className="draft-card-head">
              <strong>Validation output</strong>
              <span className={selectedBatchValidation?.valid ? "status-pill ok compact" : "status-pill warn compact"}>
                {selectedBatchValidation ? (selectedBatchValidation.valid ? "Schema valid" : "Schema invalid") : "Awaiting preview"}
              </span>
            </div>
            {selectedBatchValidation ? (
              <>
                <p className="panel-copy">{selectedBatchValidation.schema_path}</p>
                {selectedBatchValidation.errors.length ? (
                  <div className="roadmap-list">
                    {selectedBatchValidation.errors.slice(0, 5).map((issue, index) => (
                      <div className="roadmap-item" key={`${issue.line ?? 0}-${issue.column ?? 0}-${index}`}>
                        <strong>
                          Line {issue.line ?? "?"}, column {issue.column ?? "?"}
                        </strong>
                        <p>{issue.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="panel-copy">
                    {xmlModeLabel === "single"
                      ? "The generated single-record Push message validates cleanly."
                      : xmlModeLabel === "marketInfo"
                        ? "The generated MARKET_INFO.PUT Push message validates cleanly."
                        : xmlModeLabel === "bulkUdidiPost"
                          ? "The generated bulk UDI-DI POST Push message validates cleanly."
                          : xmlModeLabel === "bulkMarketInfo"
                            ? "The generated bulk MARKET_INFO.PUT Push message validates cleanly."
                          : "The generated bulk PATCH Push message validates cleanly."}
                  </p>
                )}
              </>
            ) : (
              <p className="panel-copy">
                {xmlModeLabel === "single"
                  ? "Generate a single-record preview to inspect the schema validation outcome."
                  : xmlModeLabel === "marketInfo"
                    ? "Generate a MARKET_INFO.PUT preview to inspect the schema validation outcome."
                    : xmlModeLabel === "bulkUdidiPost"
                      ? "Generate a bulk UDI-DI POST preview to inspect the schema validation outcome."
                      : xmlModeLabel === "bulkMarketInfo"
                        ? "Generate a bulk MARKET_INFO.PUT preview to inspect the schema validation outcome."
                      : "Generate a bulk PATCH preview to inspect the schema validation outcome."}
              </p>
            )}
          </div>
        </>
      ) : null}
      {xmlModeLabel === "patch" && xmlPatchValidationValid !== null ? (
        <div className="draft-card">
          <div className="draft-card-head">
            <strong>PATCH validation</strong>
            <span className={xmlPatchValidationValid ? "status-pill ok compact" : "status-pill warn compact"}>
              {xmlPatchValidationValid ? "Schema valid" : "Schema invalid"}
            </span>
          </div>
          <p className="panel-copy">{xmlPatchValidationSchemaPath}</p>
        </div>
      ) : null}
      {(xmlModeLabel === "bulkPost" || xmlModeLabel === "bulkUdidiPost" || xmlModeLabel === "bulkPatch" || xmlModeLabel === "bulkMarketInfo") && selectedBulkPreview ? (
        <div className="draft-card">
          <div className="draft-card-head">
            <strong>{bulkChunkSummaryTitle}</strong>
            <span className="status-pill ok compact">
              {selectedBulkPreview.chunk_count} chunk{selectedBulkPreview.chunk_count === 1 ? "" : "s"}
            </span>
          </div>
          <p className="panel-copy">
            Selected file: {selectedBulkPreview.selected_chunk_file_name} · {selectedBulkPreview.selected_chunk_record_count} rows
          </p>
          <p className="panel-copy">
            Included {selectedBulkPreview.included_record_count} · Excluded {selectedBulkPreview.excluded_record_count}
          </p>
          <div className="roadmap-list">
            {selectedBulkPreview.chunks.slice(0, 6).map((chunk) => (
              <div className="roadmap-item" key={chunk.file_name}>
                <strong>{chunk.file_name}</strong>
                <p>
                  {chunk.record_count} rows · {chunk.first_catalogue_number ?? "?"} to {chunk.last_catalogue_number ?? "?"}
                </p>
              </div>
            ))}
          </div>
          {selectedBulkExclusionSummaries.length ? (
            <div className="roadmap-list">
              {selectedBulkExclusionSummaries.map((summary) => (
                <div className="roadmap-item" key={summary.key}>
                  <strong>{summary.title}</strong>
                  <p>{summary.detail}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
