import type {
  BulkMarketInfoPreview,
  BulkPatchPreview,
  BulkPostPreview,
  BulkUdidiPostPreview,
  MarketInfoPutPreview,
  OperationAssessment,
  PostRegistrationPreview,
  SingleRecordXmlPreview,
  XmlValidationResult,
} from "./types";
import type { XmlWorkspaceRecord } from "./xmlWorkspace";

export type XmlMode =
  | "post"
  | "single"
  | "marketInfo"
  | "patch"
  | "bulkPost"
  | "bulkUdidiPost"
  | "bulkPatch"
  | "bulkMarketInfo";

export type AssessmentSummaryRow = {
  label: string;
  value: string;
};

export function resolveSelectedBulkChunkCount(args: {
  xmlMode: XmlMode;
  xmlBulkPostPreview: BulkPostPreview | null;
  xmlBulkUdidiPostPreview: BulkUdidiPostPreview | null;
  xmlBulkPatchPreview: BulkPatchPreview | null;
  xmlBulkMarketInfoPreview: BulkMarketInfoPreview | null;
  normalizedBulkRecordCount: number;
  selectedBulkPatchSelectedCount: number;
  selectedXmlVariantChunkCount: number;
}): number {
  const {
    xmlMode,
    xmlBulkPostPreview,
    xmlBulkUdidiPostPreview,
    xmlBulkPatchPreview,
    xmlBulkMarketInfoPreview,
    normalizedBulkRecordCount,
    selectedBulkPatchSelectedCount,
    selectedXmlVariantChunkCount,
  } = args;
  return xmlMode === "bulkPost"
    ? xmlBulkPostPreview?.chunk_count ?? Math.max(Math.ceil(normalizedBulkRecordCount / 300), 1)
    : xmlMode === "bulkUdidiPost"
      ? xmlBulkUdidiPostPreview?.chunk_count ?? Math.max(Math.ceil(normalizedBulkRecordCount / 300), 1)
      : xmlMode === "bulkPatch"
        ? xmlBulkPatchPreview?.chunk_count ?? Math.max(Math.ceil(Math.max(selectedBulkPatchSelectedCount, 1) / 300), 1)
        : xmlMode === "bulkMarketInfo"
          ? xmlBulkMarketInfoPreview?.chunk_count ?? Math.max(Math.ceil(Math.max(selectedBulkPatchSelectedCount, 1) / 300), 1)
        : selectedXmlVariantChunkCount;
}

export function resolveSelectedBulkPreview(args: {
  xmlMode: XmlMode;
  xmlBulkPostPreview: BulkPostPreview | null;
  xmlBulkUdidiPostPreview: BulkUdidiPostPreview | null;
  xmlBulkPatchPreview: BulkPatchPreview | null;
  xmlBulkMarketInfoPreview: BulkMarketInfoPreview | null;
}): BulkPostPreview | BulkUdidiPostPreview | BulkPatchPreview | BulkMarketInfoPreview | null {
  const { xmlMode, xmlBulkPostPreview, xmlBulkUdidiPostPreview, xmlBulkPatchPreview, xmlBulkMarketInfoPreview } = args;
  return xmlMode === "bulkPost"
    ? xmlBulkPostPreview
    : xmlMode === "bulkUdidiPost"
      ? xmlBulkUdidiPostPreview
      : xmlMode === "bulkPatch"
        ? xmlBulkPatchPreview
        : xmlMode === "bulkMarketInfo"
          ? xmlBulkMarketInfoPreview
        : null;
}

export function resolveBulkPostReadinessMessage(count: number): string {
  return count > 0
    ? `Ready to generate ${count} unposted Basic UDI-DI parent${count === 1 ? "" : "s"}.`
    : "All Basic UDI-DI parents for this variant already have successful parent DEVICE.POST entries. Use Bulk UDI-DI POST for additional child devices.";
}

export function resolveXmlPreviewLines(args: {
  xmlMode: XmlMode;
  xmlPairPreview: PostRegistrationPreview | null;
  selectedPostWorkspaceRecord: XmlWorkspaceRecord | null;
  selectedXmlRecord: XmlWorkspaceRecord | null;
  xmlPreview: SingleRecordXmlPreview | null;
  selectedXmlMarketInfoRecord: XmlWorkspaceRecord | null;
  xmlMarketInfoPreview: MarketInfoPutPreview | null;
  xmlPatchPreview: { derived_patch_xml: string } | null;
  selectedPatchScenarioId: string;
  selectedPatchScenarioStatus: string | null;
  selectedPatchScenarioTarget: string;
  patchVersionInput: string;
  xmlBulkPostPreview: BulkPostPreview | null;
  xmlBulkUdidiPostPreview: BulkUdidiPostPreview | null;
  xmlBulkPatchPreview: BulkPatchPreview | null;
  xmlBulkMarketInfoPreview: BulkMarketInfoPreview | null;
  selectedXmlFamilyProductFamily: string | null;
  selectedXmlVariantProductVariant: string | null;
  normalizedBulkRecordCount: number;
  selectedXmlChunkSequence: number;
}): string {
  const {
    xmlMode,
    xmlPairPreview,
    selectedPostWorkspaceRecord,
    selectedXmlRecord,
    xmlPreview,
    selectedXmlMarketInfoRecord,
    xmlMarketInfoPreview,
    xmlPatchPreview,
    selectedPatchScenarioId,
    selectedPatchScenarioStatus,
    selectedPatchScenarioTarget,
    patchVersionInput,
    xmlBulkPostPreview,
    xmlBulkUdidiPostPreview,
    xmlBulkPatchPreview,
    xmlBulkMarketInfoPreview,
    selectedXmlFamilyProductFamily,
    selectedXmlVariantProductVariant,
    normalizedBulkRecordCount,
    selectedXmlChunkSequence,
  } = args;

  return xmlMode === "post"
    ? xmlPairPreview
      ? xmlPairPreview.post_xml
      : selectedPostWorkspaceRecord
        ? [
            "<!-- Generate POST XML to load the next available POST candidate preview -->",
            `<catalogue-number>${selectedPostWorkspaceRecord.catalogue_number}</catalogue-number>`,
            `<udi-di>${selectedPostWorkspaceRecord.primary_udi_di ?? "PENDING"}</udi-di>`,
          ].join("\n")
        : "<!-- No available Device UDI-DI POST candidate is currently available for the selected family and variant -->"
    : xmlMode === "single"
      ? selectedXmlRecord
        ? xmlPreview?.xml ??
          [
            "<!-- Generate XML to load the schema-valid Push message preview -->",
            `<catalogue-number>${selectedXmlRecord.catalogue_number ?? "PENDING"}</catalogue-number>`,
            `<udi-di>${selectedXmlRecord.primary_udi_di ?? "PENDING"}</udi-di>`,
          ].join("\n")
        : "<!-- No XML-ready record is currently available for the selected family and variant -->"
      : xmlMode === "marketInfo"
        ? selectedXmlMarketInfoRecord
          ? xmlMarketInfoPreview?.xml ??
            [
              "<!-- Generate XML to load the MARKET_INFO.PUT Push message preview -->",
              `<catalogue-number>${selectedXmlMarketInfoRecord.catalogue_number}</catalogue-number>`,
              `<udi-di>${selectedXmlMarketInfoRecord.primary_udi_di ?? "PENDING"}</udi-di>`,
              "<service>MARKET_INFO.PUT</service>",
            ].join("\n")
          : "<!-- No XML-ready record is currently available for MARKET_INFO.PUT generation -->"
        : xmlMode === "patch"
          ? xmlPatchPreview?.derived_patch_xml ??
            [
              "<!-- Generate a scenario-derived PATCH preview built on the accepted POST or latest accepted PATCH -->",
              `<scenario-id>${selectedPatchScenarioId}</scenario-id>`,
              `<scenario-status>${selectedPatchScenarioStatus}</scenario-status>`,
              `<target>${selectedPatchScenarioTarget}</target>`,
              `<patch-version>${patchVersionInput || "PENDING"}</patch-version>`,
            ].join("\n")
          : xmlMode === "bulkPost"
            ? xmlBulkPostPreview?.selected_chunk_xml ??
              [
                "<!-- Generate XML to preview the selected bulk Basic UDI POST chunk -->",
                `<product-family>${selectedXmlFamilyProductFamily ?? "PENDING"}</product-family>`,
                `<product-variant>${selectedXmlVariantProductVariant ?? "PENDING"}</product-variant>`,
                `<record-count>${normalizedBulkRecordCount}</record-count>`,
                `<chunk-sequence>${selectedXmlChunkSequence}</chunk-sequence>`,
              ].join("\n")
            : xmlMode === "bulkUdidiPost"
              ? xmlBulkUdidiPostPreview?.selected_chunk_xml ??
                [
                  "<!-- Generate XML to preview the selected bulk UDI-DI POST chunk -->",
                  `<product-family>${selectedXmlFamilyProductFamily ?? "PENDING"}</product-family>`,
                  `<product-variant>${selectedXmlVariantProductVariant ?? "PENDING"}</product-variant>`,
                  `<record-count>${normalizedBulkRecordCount}</record-count>`,
                  `<chunk-sequence>${selectedXmlChunkSequence}</chunk-sequence>`,
                ].join("\n")
              : xmlMode === "bulkPatch"
                ? xmlBulkPatchPreview?.selected_chunk_xml ??
                [
                  "<!-- Generate XML to preview the selected bulk PATCH chunk -->",
                  `<product-family>${selectedXmlFamilyProductFamily ?? "PENDING"}</product-family>`,
                  `<product-variant>${selectedXmlVariantProductVariant ?? "PENDING"}</product-variant>`,
                  `<scenario-id>${selectedPatchScenarioId}</scenario-id>`,
                  `<record-count>${normalizedBulkRecordCount}</record-count>`,
                  `<chunk-sequence>${selectedXmlChunkSequence}</chunk-sequence>`,
                ].join("\n")
                : xmlBulkMarketInfoPreview?.selected_chunk_xml ??
                  [
                    "<!-- Generate XML to preview the selected bulk MARKET_INFO.PUT chunk -->",
                    `<product-family>${selectedXmlFamilyProductFamily ?? "PENDING"}</product-family>`,
                    `<product-variant>${selectedXmlVariantProductVariant ?? "PENDING"}</product-variant>`,
                    "<service>MARKET_INFO.PUT</service>",
                    `<record-count>${normalizedBulkRecordCount}</record-count>`,
                    `<chunk-sequence>${selectedXmlChunkSequence}</chunk-sequence>`,
                  ].join("\n");
}

export function resolveSelectedBatchValidation(args: {
  xmlMode: XmlMode;
  xmlPairPreview: PostRegistrationPreview | null;
  xmlPreview: SingleRecordXmlPreview | null;
  xmlMarketInfoPreview: MarketInfoPutPreview | null;
  xmlPatchPreview: { derived_patch_validation: XmlValidationResult } | null;
  xmlBulkPostPreview: BulkPostPreview | null;
  xmlBulkUdidiPostPreview: BulkUdidiPostPreview | null;
  xmlBulkPatchPreview: BulkPatchPreview | null;
  xmlBulkMarketInfoPreview: BulkMarketInfoPreview | null;
}): XmlValidationResult | null {
  const {
    xmlMode,
    xmlPairPreview,
    xmlPreview,
    xmlMarketInfoPreview,
    xmlPatchPreview,
    xmlBulkPostPreview,
    xmlBulkUdidiPostPreview,
    xmlBulkPatchPreview,
    xmlBulkMarketInfoPreview,
  } = args;
  return xmlMode === "post"
    ? xmlPairPreview?.post_validation ?? null
    : xmlMode === "single"
      ? xmlPreview?.validation ?? null
      : xmlMode === "marketInfo"
        ? xmlMarketInfoPreview?.validation ?? null
        : xmlMode === "patch"
          ? xmlPatchPreview?.derived_patch_validation ?? null
          : xmlMode === "bulkPost"
            ? xmlBulkPostPreview?.selected_chunk_validation ?? null
            : xmlMode === "bulkUdidiPost"
              ? xmlBulkUdidiPostPreview?.selected_chunk_validation ?? null
              : xmlMode === "bulkPatch"
                ? xmlBulkPatchPreview?.selected_chunk_validation ?? null
                : xmlBulkMarketInfoPreview?.selected_chunk_validation ?? null;
}

export function resolveGenericPreviewTitle(xmlMode: XmlMode): string {
  return xmlMode === "single"
    ? "Single Record XML Preview"
    : xmlMode === "marketInfo"
      ? "Market Info Preview"
      : xmlMode === "bulkPost"
        ? "Bulk Basic UDI POST Preview"
        : xmlMode === "bulkUdidiPost"
          ? "Bulk UDI-DI POST Preview"
          : xmlMode === "bulkPatch"
            ? "Bulk PATCH Preview"
            : "Bulk Market Info Preview";
}

export function resolveGenericPreviewStatusMessage(args: {
  xmlMode: XmlMode;
  xmlPreview: SingleRecordXmlPreview | null;
  xmlMarketInfoPreview: MarketInfoPutPreview | null;
  xmlBulkPostPreview: BulkPostPreview | null;
  xmlBulkUdidiPostPreview: BulkUdidiPostPreview | null;
  xmlBulkPatchPreview: BulkPatchPreview | null;
  xmlBulkMarketInfoPreview: BulkMarketInfoPreview | null;
}): string {
  const { xmlMode, xmlPreview, xmlMarketInfoPreview, xmlBulkPostPreview, xmlBulkUdidiPostPreview, xmlBulkPatchPreview, xmlBulkMarketInfoPreview } = args;
  return xmlMode === "single"
    ? xmlPreview
      ? `Preview generated for ${xmlPreview.product_family} / ${xmlPreview.product_variant} / ${xmlPreview.catalogue_number}.`
      : "No XML preview generated yet for the selected row."
    : xmlMode === "marketInfo"
      ? xmlMarketInfoPreview
        ? `MARKET_INFO.PUT preview generated for ${xmlMarketInfoPreview.product_family} / ${xmlMarketInfoPreview.product_variant} / ${xmlMarketInfoPreview.catalogue_number}.`
        : "No MARKET_INFO.PUT preview generated yet for the registered testing anchor."
      : xmlMode === "bulkPost"
        ? xmlBulkPostPreview
          ? `Bulk Basic UDI POST preview generated for ${xmlBulkPostPreview.product_family} / ${xmlBulkPostPreview.product_variant}, chunk ${xmlBulkPostPreview.selected_chunk_sequence}.`
          : "No bulk Basic UDI POST preview generated yet for the selected variant."
        : xmlMode === "bulkUdidiPost"
          ? xmlBulkUdidiPostPreview
            ? `Bulk UDI-DI POST preview generated for ${xmlBulkUdidiPostPreview.product_family} / ${xmlBulkUdidiPostPreview.product_variant}, chunk ${xmlBulkUdidiPostPreview.selected_chunk_sequence}.`
            : "No bulk UDI-DI POST preview generated yet for the selected variant."
          : xmlMode === "bulkPatch"
            ? xmlBulkPatchPreview
              ? `Bulk PATCH preview generated for ${xmlBulkPatchPreview.product_family} / ${xmlBulkPatchPreview.product_variant} / ${xmlBulkPatchPreview.selected_basic_udi_di}, chunk ${xmlBulkPatchPreview.selected_chunk_sequence}.`
              : "No bulk PATCH preview generated yet for the selected parent scope."
            : xmlBulkMarketInfoPreview
              ? `Bulk Market Info preview generated for ${xmlBulkMarketInfoPreview.product_family} / ${xmlBulkMarketInfoPreview.product_variant} / ${xmlBulkMarketInfoPreview.selected_basic_udi_di}, chunk ${xmlBulkMarketInfoPreview.selected_chunk_sequence}.`
              : "No bulk Market Info preview generated yet for the selected parent scope.";
}

export function resolveBulkChunkSummaryTitle(xmlMode: XmlMode): string {
  return xmlMode === "bulkPost"
    ? "Bulk Basic UDI POST chunk summary"
    : xmlMode === "bulkUdidiPost"
      ? "Bulk UDI-DI POST chunk summary"
      : xmlMode === "bulkPatch"
        ? "Bulk PATCH chunk summary"
        : "Bulk Market Info chunk summary";
}

export function resolveXmlModeUi(xmlMode: XmlMode): {
  label: string;
  description: string;
  workspaceTitle: string;
  assessmentTitle: string;
} {
  return {
    label:
      xmlMode === "post"
        ? "POST"
        : xmlMode === "single"
          ? "Single XML"
          : xmlMode === "marketInfo"
            ? "Market Info"
            : xmlMode === "patch"
              ? "Patch XML"
              : xmlMode === "bulkPost"
                ? "Bulk Basic UDI POST"
                : xmlMode === "bulkUdidiPost"
                  ? "Bulk UDI-DI POST"
                  : xmlMode === "bulkPatch"
                    ? "Bulk PATCH"
                    : "Bulk Market Info",
    description:
      xmlMode === "post"
        ? "Generate one accepted registration POST for a selected XML-ready device record."
        : xmlMode === "single"
          ? "Generate one wrapped Push message for a selected XML-ready device record."
          : xmlMode === "marketInfo"
            ? "Generate one standalone MARKET_INFO.PUT message for a selected XML-ready record."
            : xmlMode === "patch"
              ? "Generate one scenario-derived PATCH draft at a time from the accepted POST or the latest accepted PATCH."
              : xmlMode === "bulkPost"
                ? "Generate one parent DEVICE.POST per Basic UDI-DI that is not already registered."
                : xmlMode === "bulkUdidiPost"
                  ? "Generate Device UDI-DI POST messages only for devices under an already accepted Basic UDI-DI."
                  : xmlMode === "bulkPatch"
                    ? "Generate a chunked bulk PATCH package that applies one PATCH scenario across the selected bulk POST cohort."
                    : "Generate a chunked bulk MARKET_INFO.PUT package that applies one country-footprint scenario across the selected registered device cohort.",
    workspaceTitle:
      xmlMode === "post"
        ? "POST Workspace"
        : xmlMode === "single"
          ? "Single Record Workspace"
          : xmlMode === "marketInfo"
            ? "Market Info Workspace"
            : xmlMode === "patch"
              ? "Patch Scenario Workspace"
              : xmlMode === "bulkPost"
                ? "Bulk Basic UDI POST Workspace"
                : xmlMode === "bulkUdidiPost"
                  ? "Bulk UDI-DI POST Workspace"
                  : xmlMode === "bulkPatch"
                    ? "Bulk PATCH Workspace"
                    : "Bulk Market Info Workspace",
    assessmentTitle:
      xmlMode === "post"
        ? "POST Assessment"
        : xmlMode === "marketInfo"
          ? "Market Info assessment"
        : xmlMode === "patch"
          ? "PATCH assessment"
          : xmlMode === "bulkPost"
            ? "Bulk Basic UDI POST assessment"
            : xmlMode === "bulkUdidiPost"
              ? "Bulk UDI-DI POST assessment"
              : xmlMode === "bulkPatch"
                ? "Bulk PATCH assessment"
                : "Bulk Market Info assessment",
  };
}

export function resolveXmlAssessmentSummaryRows(args: {
  xmlMode: XmlMode;
  xmlOperationAssessment: OperationAssessment | null;
  assessedPatchLatestAcceptedVersion: string | null;
  assessedPatchReviewedBaseline: boolean | null;
  assessedPatchTrackedRegistration: boolean | null;
  assessedMarketInfoCurrentVersion: string | null;
  assessedSelectedBasicUdiDi: string | null;
  assessedLatestVersionSummary: string[];
  assessedCurrentMarketInfoVersionSummary: string[];
  assessedBulkParentGroupCount: number | null;
  assessedBulkChildRecordCount: number | null;
  assessedUnpostedParentGroupCount: number | null;
  assessmentEvidenceString: (assessment: OperationAssessment | null, key: string) => string | null;
  assessmentEvidenceBoolean: (assessment: OperationAssessment | null, key: string) => boolean | null;
  assessmentEvidenceNumber: (assessment: OperationAssessment | null, key: string) => number | null;
}): AssessmentSummaryRow[] {
  const {
    xmlMode,
    xmlOperationAssessment,
    assessedPatchLatestAcceptedVersion,
    assessedPatchReviewedBaseline,
    assessedPatchTrackedRegistration,
    assessedMarketInfoCurrentVersion,
    assessedSelectedBasicUdiDi,
    assessedLatestVersionSummary,
    assessedCurrentMarketInfoVersionSummary,
    assessedBulkParentGroupCount,
    assessedBulkChildRecordCount,
    assessedUnpostedParentGroupCount,
    assessmentEvidenceString,
    assessmentEvidenceBoolean,
    assessmentEvidenceNumber,
  } = args;
  return xmlMode === "post"
    ? [
        {
          label: "Candidate catalogue",
          value: assessmentEvidenceString(xmlOperationAssessment, "candidate_catalogue_number") ?? "Not resolved",
        },
        {
          label: "Basic UDI-DI",
          value: assessmentEvidenceString(xmlOperationAssessment, "candidate_basic_udi_di") ?? "Not resolved",
        },
        {
          label: "Parent registration",
          value:
            assessmentEvidenceBoolean(xmlOperationAssessment, "parent_registration_known") === null
              ? "Unknown"
              : assessmentEvidenceBoolean(xmlOperationAssessment, "parent_registration_known")
                ? "Already registered"
                : "Not yet registered",
        },
        {
          label: "Child registration",
          value:
            assessmentEvidenceBoolean(xmlOperationAssessment, "child_registration_known") === null
              ? "Unknown"
              : assessmentEvidenceBoolean(xmlOperationAssessment, "child_registration_known")
                ? "Already registered"
                : "Not yet registered",
        },
      ]
    : xmlMode === "patch"
      ? [
          {
            label: "Catalogue number",
            value: assessmentEvidenceString(xmlOperationAssessment, "catalogue_number") ?? "Not resolved",
          },
          {
            label: "Latest accepted version",
            value: assessedPatchLatestAcceptedVersion ?? "Not tracked",
          },
          {
            label: "Reviewed baseline POST",
            value:
              assessedPatchReviewedBaseline === null ? "Unknown" : assessedPatchReviewedBaseline ? "Present" : "Missing",
          },
          {
            label: "Tracked registration",
            value: assessedPatchTrackedRegistration === null ? "Unknown" : assessedPatchTrackedRegistration ? "Present" : "Missing",
          },
        ]
      : xmlMode === "marketInfo"
        ? [
            {
              label: "Candidate catalogue",
              value: assessmentEvidenceString(xmlOperationAssessment, "catalogue_number") ?? "Not resolved",
            },
            {
              label: "Device UDI-DI",
              value: assessmentEvidenceString(xmlOperationAssessment, "primary_udi_di") ?? "Not resolved",
            },
            {
              label: "Current market version",
              value: assessedMarketInfoCurrentVersion ?? "Not tracked",
            },
            {
              label: "Tracked registration",
              value:
                assessmentEvidenceBoolean(xmlOperationAssessment, "tracked_registration_known") === null
                  ? "Unknown"
                  : assessmentEvidenceBoolean(xmlOperationAssessment, "tracked_registration_known")
                    ? "Present"
                    : "Missing",
            },
          ]
      : xmlMode === "bulkPatch"
        ? [
            {
              label: "Available parent groups",
              value: String(assessmentEvidenceNumber(xmlOperationAssessment, "eligible_parent_group_count") ?? 0),
            },
            {
              label: "Selected Basic UDI-DI",
              value: assessedSelectedBasicUdiDi ?? "Select a parent",
            },
            {
              label: "Eligible child devices",
              value: String(assessmentEvidenceNumber(xmlOperationAssessment, "eligible_child_record_count") ?? 0),
            },
            {
              label: "Tracked versions",
              value: assessedLatestVersionSummary.length > 0 ? assessedLatestVersionSummary.join(", ") : "Not tracked",
            },
          ]
        : xmlMode === "bulkMarketInfo"
          ? [
              {
                label: "Available parent groups",
                value: String(assessmentEvidenceNumber(xmlOperationAssessment, "eligible_parent_group_count") ?? 0),
              },
              {
                label: "Selected Basic UDI-DI",
                value: assessedSelectedBasicUdiDi ?? "Select a parent",
              },
              {
                label: "Ready devices",
                value: String(assessmentEvidenceNumber(xmlOperationAssessment, "market_info_ready_record_count") ?? 0),
              },
              {
                label: "Current versions",
                value:
                  assessedCurrentMarketInfoVersionSummary.length > 0
                    ? assessedCurrentMarketInfoVersionSummary.join(", ")
                    : "Not tracked",
              },
            ]
        : [
            {
              label: "Eligible parent groups",
              value: String(assessedBulkParentGroupCount ?? 0),
            },
            {
              label: "Eligible child records",
              value: String(assessedBulkChildRecordCount ?? 0),
            },
            {
              label: "Posted parent groups",
              value: String(assessmentEvidenceNumber(xmlOperationAssessment, "posted_parent_group_count") ?? 0),
            },
            {
              label: "Unposted parent groups",
              value: String(assessedUnpostedParentGroupCount ?? 0),
            },
          ];
}
