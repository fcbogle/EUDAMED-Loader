import { useEffect, useRef } from "react";
import { api } from "./api";
import type { XmlMode } from "./useXmlOperationAssessment";
import type {
  BulkMarketInfoPreview,
  BulkPatchPreview,
  BulkUdidiPostPreview,
  GeneratedPatchScenarioPreview,
  MarketInfoPutPreview,
  PostRegistrationPreview,
} from "./types";

type XmlFamilySelection = {
  product_family: string;
};

type XmlVariantSelection = {
  product_variant: string;
};

type XmlRecord = {
  catalogue_number: string | null;
  product_family?: string | null;
  product_variant?: string | null;
};

type XmlRequestArgs = {
  product_family: string;
  product_variant: string;
  catalogue_number: string;
};

type BulkParentGroup = {
  basic_udi_di: string;
};

type SetValue<T> = (value: T) => void;

type UseXmlPreviewGenerationArgs = {
  previewSelectionKey: string;
  acceptedStateToken: object;
  xmlMode: XmlMode;
  selectedXmlFamilySummary: XmlFamilySelection | null;
  selectedXmlVariantSummary: XmlVariantSelection | null;
  selectedXmlRecord: XmlRecord | null;
  selectedMarketInfoRequestArgs: XmlRequestArgs | null;
  selectedPairRequestArgs: XmlRequestArgs | null;
  selectedPatchScenarioId: string;
  patchVersionInput: string;
  normalizedMarketInfoVersion: string;
  currentMarketInfoScenarioInputs: () => Array<{ country: string; original_placed_on_market: boolean }>;
  currentPatchScenarioInputs: () => Record<string, unknown>;
  normalizedBulkRecordCount: number;
  selectedXmlChunkSequence: number;
  effectiveBulkUdidiPostCatalogueNumbers: string[];
  selectedBulkMarketInfoParentGroup: BulkParentGroup | null;
  normalizedBulkMarketInfoScenarioItems: Array<{ country: string; original_placed_on_market: boolean }>;
  resolveBulkMarketInfoCatalogueNumbers: () => Promise<string[]>;
  selectedBulkPatchParentGroup: BulkParentGroup | null;
  resolveBulkPatchCatalogueNumbers: () => Promise<string[]>;
  setXmlBulkUdidiPostPreview: SetValue<BulkUdidiPostPreview | null>;
  setXmlPairPreview: SetValue<PostRegistrationPreview | null>;
  setXmlMarketInfoPreview: SetValue<MarketInfoPutPreview | null>;
  setXmlPatchPreview: SetValue<GeneratedPatchScenarioPreview | null>;
  setXmlBulkPatchPreview: SetValue<BulkPatchPreview | null>;
  setXmlBulkMarketInfoPreview: SetValue<BulkMarketInfoPreview | null>;
  setError: SetValue<string | null>;
  setXmlActionMessage: SetValue<string | null>;
  setIsGeneratingXml: SetValue<boolean>;
  xmlPairPreview: PostRegistrationPreview | null;
  xmlMarketInfoPreview: MarketInfoPutPreview | null;
  xmlPatchPreview: GeneratedPatchScenarioPreview | null;
  xmlBulkUdidiPostPreview: BulkUdidiPostPreview | null;
  xmlBulkPatchPreview: BulkPatchPreview | null;
  xmlBulkMarketInfoPreview: BulkMarketInfoPreview | null;
  selectedXmlMarketInfoRecord: XmlRecord | null;
  selectedXmlPairRecord: XmlRecord | null;
  setIsDownloadingXml: SetValue<boolean>;
};

export function useXmlPreviewGeneration(args: UseXmlPreviewGenerationArgs) {
  const scopeKey = JSON.stringify([
    args.previewSelectionKey, args.xmlMode,
    args.selectedXmlFamilySummary?.product_family, args.selectedXmlVariantSummary?.product_variant,
    args.selectedPairRequestArgs, args.selectedMarketInfoRequestArgs,
    args.selectedPatchScenarioId, args.patchVersionInput, args.normalizedMarketInfoVersion,
    args.currentPatchScenarioInputs(), args.currentMarketInfoScenarioInputs(),
    args.normalizedBulkMarketInfoScenarioItems, args.effectiveBulkUdidiPostCatalogueNumbers,
    args.selectedBulkPatchParentGroup?.basic_udi_di, args.selectedBulkMarketInfoParentGroup?.basic_udi_di,
    args.selectedXmlChunkSequence,
  ]);
  const scope = useRef({ key: scopeKey, acceptedState: args.acceptedStateToken, revision: 0 });
  if (scope.current.key !== scopeKey || scope.current.acceptedState !== args.acceptedStateToken) {
    scope.current = { key: scopeKey, acceptedState: args.acceptedStateToken, revision: scope.current.revision + 1 };
  }
  const requestId = useRef(0);
  useEffect(() => {
    args.setIsGeneratingXml(false);
  }, [scopeKey, args.acceptedStateToken, args.setIsGeneratingXml]);
  useEffect(() => () => { requestId.current += 1; }, []);

  async function generateXmlPreview(): Promise<void> {
    const revision = scope.current.revision;
    const id = ++requestId.current;
    const isCurrent = () => id === requestId.current && revision === scope.current.revision;
    const {
      xmlMode,
      selectedXmlFamilySummary,
      selectedXmlVariantSummary,
      selectedMarketInfoRequestArgs,
      selectedPairRequestArgs,
      selectedPatchScenarioId,
      patchVersionInput,
      normalizedMarketInfoVersion,
      currentMarketInfoScenarioInputs,
      currentPatchScenarioInputs,
      selectedXmlChunkSequence,
      effectiveBulkUdidiPostCatalogueNumbers,
      selectedBulkMarketInfoParentGroup,
      normalizedBulkMarketInfoScenarioItems,
      resolveBulkMarketInfoCatalogueNumbers,
      selectedBulkPatchParentGroup,
      resolveBulkPatchCatalogueNumbers,
      setXmlBulkUdidiPostPreview,
      setXmlPairPreview,
      setXmlMarketInfoPreview,
      setXmlPatchPreview,
      setXmlBulkPatchPreview,
      setXmlBulkMarketInfoPreview,
      setError,
      setXmlActionMessage,
      setIsGeneratingXml,
    } = args;

    if (
      (xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch" || xmlMode === "bulkMarketInfo") &&
      (!selectedXmlFamilySummary || !selectedXmlVariantSummary)
    ) {
      return;
    }
    setIsGeneratingXml(true);
    setError(null);
    setXmlActionMessage(null);
    try {
      if (xmlMode === "post") {
        if (!selectedXmlFamilySummary || !selectedXmlVariantSummary) return;
        const preview = await api.previewNextXmlPostRegistration(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
        );
        if (!isCurrent()) return;
        setXmlPairPreview(preview);
      } else if (xmlMode === "marketInfo") {
        if (!selectedMarketInfoRequestArgs) return;
        const preview = await api.previewXmlMarketInfoPut(
          selectedMarketInfoRequestArgs.product_family,
          selectedMarketInfoRequestArgs.product_variant,
          selectedMarketInfoRequestArgs.catalogue_number,
          normalizedMarketInfoVersion,
          currentMarketInfoScenarioInputs(),
        );
        if (!isCurrent()) return;
        setXmlMarketInfoPreview(preview);
      } else if (xmlMode === "patch") {
        if (!selectedPairRequestArgs) return;
        const preview = await api.previewGeneratedPatchScenario(
          selectedPairRequestArgs.product_family,
          selectedPairRequestArgs.product_variant,
          selectedPairRequestArgs.catalogue_number,
          selectedPatchScenarioId,
          patchVersionInput,
          currentPatchScenarioInputs(),
        );
        if (!isCurrent()) return;
        setXmlPatchPreview(preview);
      } else if (xmlMode === "bulkUdidiPost") {
        if (!selectedXmlFamilySummary || !selectedXmlVariantSummary) return;
        setXmlActionMessage("Generating Bulk UDI-DI POST preview...");
        const preview = await api.previewBulkUdidiPost(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
          effectiveBulkUdidiPostCatalogueNumbers.length,
          selectedXmlChunkSequence,
          effectiveBulkUdidiPostCatalogueNumbers,
        );
        if (!isCurrent()) return;
        setXmlBulkUdidiPostPreview(preview);
        setXmlActionMessage(
          `Bulk UDI-DI POST preview generated for ${selectedXmlFamilySummary.product_family} / ${selectedXmlVariantSummary.product_variant}, chunk ${preview.selected_chunk_sequence}.`,
        );
      } else if (xmlMode === "bulkMarketInfo") {
        if (!selectedXmlFamilySummary || !selectedXmlVariantSummary) return;
        setXmlActionMessage("Generating Bulk Market Info preview...");
        if (!selectedBulkMarketInfoParentGroup) {
          setError("Select a Basic UDI-DI parent before generating Bulk Market Info.");
          setXmlActionMessage("Bulk Market Info is not ready: no Basic UDI-DI parent is selected.");
          return;
        }
        const catalogueNumbers = await resolveBulkMarketInfoCatalogueNumbers();
        if (!isCurrent()) return;
        if (catalogueNumbers.length < 1) {
          setError("No posted devices are currently selected for Bulk Market Info.");
          setXmlActionMessage("Bulk Market Info is not ready: no posted devices are currently selected.");
          return;
        }
        const preview = await api.previewBulkMarketInfo(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
          selectedBulkMarketInfoParentGroup.basic_udi_di,
          catalogueNumbers.length,
          normalizedBulkMarketInfoScenarioItems,
          catalogueNumbers,
          selectedXmlChunkSequence,
        );
        if (!isCurrent()) return;
        setXmlBulkMarketInfoPreview(preview);
        setXmlActionMessage(
          `Bulk Market Info preview generated for ${selectedXmlFamilySummary.product_family} / ${selectedXmlVariantSummary.product_variant} / ${selectedBulkMarketInfoParentGroup.basic_udi_di}.`,
        );
      } else {
        if (!selectedXmlFamilySummary || !selectedXmlVariantSummary) return;
        setXmlActionMessage("Bulk PATCH action received. Preparing selection...");
        if (!selectedBulkPatchParentGroup) {
          setError("Select a Basic UDI-DI parent before generating Bulk PATCH.");
          setXmlActionMessage("Bulk PATCH is not ready: no Basic UDI-DI parent is selected.");
          return;
        }
        const catalogueNumbers = await resolveBulkPatchCatalogueNumbers();
        if (!isCurrent()) return;
        if (catalogueNumbers.length < 1) {
          setError("No posted devices are currently selected for Bulk PATCH.");
          setXmlActionMessage("Bulk PATCH is not ready: no posted devices are currently selected.");
          return;
        }
        setXmlActionMessage("Generating Bulk PATCH preview...");
        const preview = await api.previewBulkPatch(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
          selectedBulkPatchParentGroup.basic_udi_di,
          catalogueNumbers.length,
          selectedPatchScenarioId,
          currentPatchScenarioInputs(),
          catalogueNumbers,
          selectedXmlChunkSequence,
        );
        if (!isCurrent()) return;
        setXmlBulkPatchPreview(preview);
        setXmlActionMessage(
          `Bulk PATCH preview generated for ${selectedXmlFamilySummary.product_family} / ${selectedXmlVariantSummary.product_variant} / ${selectedBulkPatchParentGroup.basic_udi_di}.`,
        );
      }
    } catch (requestError) {
      if (!isCurrent()) return;
      const message = requestError instanceof Error ? requestError.message : "Failed to generate XML preview.";
      setError(message);
      setXmlActionMessage(message);
    } finally {
      if (isCurrent()) setIsGeneratingXml(false);
    }
  }

  async function downloadXmlRecord(): Promise<void> {
    const {
      xmlMode,
      selectedXmlFamilySummary,
      selectedXmlVariantSummary,
      selectedMarketInfoRequestArgs,
      selectedPairRequestArgs,
      selectedPatchScenarioId,
      patchVersionInput,
      normalizedMarketInfoVersion,
      currentMarketInfoScenarioInputs,
      currentPatchScenarioInputs,
      effectiveBulkUdidiPostCatalogueNumbers,
      selectedBulkMarketInfoParentGroup,
      normalizedBulkMarketInfoScenarioItems,
      resolveBulkMarketInfoCatalogueNumbers,
      selectedBulkPatchParentGroup,
      resolveBulkPatchCatalogueNumbers,
      setError,
      setXmlActionMessage,
      xmlPairPreview,
      xmlMarketInfoPreview,
      xmlPatchPreview,
      xmlBulkUdidiPostPreview,
      xmlBulkPatchPreview,
      xmlBulkMarketInfoPreview,
      selectedXmlMarketInfoRecord,
      selectedXmlPairRecord,
      setIsDownloadingXml,
    } = args;

    if (
      (xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch" || xmlMode === "bulkMarketInfo") &&
      (!selectedXmlFamilySummary || !selectedXmlVariantSummary)
    ) {
      return;
    }
    setIsDownloadingXml(true);
    setError(null);
    setXmlActionMessage("Preparing download...");
    try {
      const downloadResult =
        xmlMode === "post" && xmlPairPreview
          ? await api.downloadXmlPostPackage(
              xmlPairPreview.product_family ?? "",
              xmlPairPreview.product_variant ?? "",
              xmlPairPreview.catalogue_number,
            )
          : xmlMode === "marketInfo" && selectedMarketInfoRequestArgs
              ? await api.downloadXmlMarketInfoPut(
                  selectedMarketInfoRequestArgs.product_family,
                  selectedMarketInfoRequestArgs.product_variant,
                  selectedMarketInfoRequestArgs.catalogue_number,
                  normalizedMarketInfoVersion,
                  currentMarketInfoScenarioInputs(),
                )
              : xmlMode === "patch"
                ? await api.downloadGeneratedPatchScenario(
                    selectedPairRequestArgs?.product_family ?? "",
                    selectedPairRequestArgs?.product_variant ?? "",
                    selectedPairRequestArgs?.catalogue_number ?? "",
                    selectedPatchScenarioId,
                    patchVersionInput,
                    currentPatchScenarioInputs(),
                  )
                : xmlMode === "bulkUdidiPost" && selectedXmlFamilySummary && selectedXmlVariantSummary
                    ? await api.downloadBulkUdidiPost(
                        selectedXmlFamilySummary.product_family,
                        selectedXmlVariantSummary.product_variant,
                        effectiveBulkUdidiPostCatalogueNumbers.length,
                        effectiveBulkUdidiPostCatalogueNumbers,
                      )
                    : xmlMode === "bulkMarketInfo" && selectedXmlFamilySummary && selectedXmlVariantSummary
                      ? await (async () => {
                          if (!selectedBulkMarketInfoParentGroup) {
                            throw new Error("Select a Basic UDI-DI parent before downloading Bulk Market Info.");
                          }
                          const catalogueNumbers = await resolveBulkMarketInfoCatalogueNumbers();
                          if (catalogueNumbers.length < 1) {
                            throw new Error("No posted devices are currently selected for Bulk Market Info.");
                          }
                          return api.downloadBulkMarketInfo(
                            selectedXmlFamilySummary.product_family,
                            selectedXmlVariantSummary.product_variant,
                            selectedBulkMarketInfoParentGroup.basic_udi_di,
                            catalogueNumbers.length,
                            normalizedBulkMarketInfoScenarioItems,
                            catalogueNumbers,
                          );
                        })()
                      : await (async () => {
                          if (!selectedBulkPatchParentGroup || !selectedXmlFamilySummary || !selectedXmlVariantSummary) {
                            throw new Error("Select a Basic UDI-DI parent before downloading Bulk PATCH.");
                          }
                          const catalogueNumbers = await resolveBulkPatchCatalogueNumbers();
                          if (catalogueNumbers.length < 1) {
                            throw new Error("No posted devices are currently selected for Bulk PATCH.");
                          }
                          return api.downloadBulkPatch(
                            selectedXmlFamilySummary.product_family,
                            selectedXmlVariantSummary.product_variant,
                            selectedBulkPatchParentGroup.basic_udi_di,
                            catalogueNumbers.length,
                            selectedPatchScenarioId,
                            currentPatchScenarioInputs(),
                            catalogueNumbers,
                          );
                        })();
      if (!downloadResult?.blob) return;

      const resolvedFileName =
        downloadResult.fileName ??
        (xmlMode === "marketInfo"
            ? xmlMarketInfoPreview?.file_name ??
              `${selectedXmlMarketInfoRecord?.product_family ?? "device"}-${selectedXmlMarketInfoRecord?.product_variant ?? "variant"}-${selectedXmlMarketInfoRecord?.catalogue_number ?? "record"}-market-info-put.xml`
            : xmlMode === "patch"
              ? `${(
                  xmlPatchPreview?.derived_patch_file_name ??
                  `${selectedXmlPairRecord?.product_family ?? "device"}-${selectedXmlPairRecord?.product_variant ?? "variant"}-${selectedPatchScenarioId}.xml`
                ).replace(/\.xml$/i, "")}.zip`
              : xmlMode === "bulkUdidiPost"
                  ? xmlBulkUdidiPostPreview?.package_file_name ??
                    `${selectedXmlFamilySummary?.product_family ?? "device"}-${selectedXmlVariantSummary?.product_variant ?? "variant"}-bulk-udidi-post-package.zip`
                  : xmlMode === "bulkPatch"
                    ? xmlBulkPatchPreview?.package_file_name ??
                      `${selectedXmlFamilySummary?.product_family ?? "device"}-${selectedXmlVariantSummary?.product_variant ?? "variant"}-${selectedPatchScenarioId}-bulk-patch-package.zip`
                    : xmlBulkMarketInfoPreview?.package_file_name ??
                      `${selectedXmlFamilySummary?.product_family ?? "device"}-${selectedXmlVariantSummary?.product_variant ?? "variant"}-bulk-market-info-package.zip`);
      const objectUrl = URL.createObjectURL(downloadResult.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = resolvedFileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      setXmlActionMessage(
        xmlMode === "patch" || xmlMode === "bulkPatch"
          ? `Patch scenario ZIP download started for ${resolvedFileName}. Review recorded for this ZIP. If your browser does not prompt, check the default Downloads folder.`
          : `Download started for ${resolvedFileName}. Review recorded for this ZIP. If your browser does not prompt, check the default Downloads folder.`,
      );
      window.setTimeout(() => {
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }, 1500);
    } catch (requestError) {
      setXmlActionMessage(null);
      setError(requestError instanceof Error ? requestError.message : "Failed to download XML.");
    } finally {
      setIsDownloadingXml(false);
    }
  }

  return { generateXmlPreview, downloadXmlRecord };
}
