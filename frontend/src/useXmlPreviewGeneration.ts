import { api } from "./api";
import type { XmlMode } from "./useXmlOperationAssessment";
import type {
  BulkMarketInfoPreview,
  BulkPatchPreview,
  BulkPostPreview,
  BulkUdidiPostPreview,
  GeneratedPatchScenarioPreview,
  MarketInfoPutPreview,
  PostRegistrationPreview,
  SingleRecordXmlPreview,
} from "./types";

type XmlFamilySelection = {
  product_family: string;
};

type XmlVariantSelection = {
  product_variant: string;
};

type XmlRecord = {
  catalogue_number: string | null;
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
  setXmlPreview: SetValue<SingleRecordXmlPreview | null>;
  setXmlBulkPostPreview: SetValue<BulkPostPreview | null>;
  setXmlBulkUdidiPostPreview: SetValue<BulkUdidiPostPreview | null>;
  setXmlPairPreview: SetValue<PostRegistrationPreview | null>;
  setXmlMarketInfoPreview: SetValue<MarketInfoPutPreview | null>;
  setXmlPatchPreview: SetValue<GeneratedPatchScenarioPreview | null>;
  setXmlBulkPatchPreview: SetValue<BulkPatchPreview | null>;
  setXmlBulkMarketInfoPreview: SetValue<BulkMarketInfoPreview | null>;
  setError: SetValue<string | null>;
  setXmlActionMessage: SetValue<string | null>;
  setIsGeneratingXml: SetValue<boolean>;
};

export function useXmlPreviewGeneration(args: UseXmlPreviewGenerationArgs) {
  async function generateXmlPreview(): Promise<void> {
    const {
      xmlMode,
      selectedXmlFamilySummary,
      selectedXmlVariantSummary,
      selectedXmlRecord,
      selectedMarketInfoRequestArgs,
      selectedPairRequestArgs,
      selectedPatchScenarioId,
      patchVersionInput,
      normalizedMarketInfoVersion,
      currentMarketInfoScenarioInputs,
      currentPatchScenarioInputs,
      normalizedBulkRecordCount,
      selectedXmlChunkSequence,
      effectiveBulkUdidiPostCatalogueNumbers,
      selectedBulkMarketInfoParentGroup,
      normalizedBulkMarketInfoScenarioItems,
      resolveBulkMarketInfoCatalogueNumbers,
      selectedBulkPatchParentGroup,
      resolveBulkPatchCatalogueNumbers,
      setXmlPreview,
      setXmlBulkPostPreview,
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
      (xmlMode === "single" || xmlMode === "bulkPost" || xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch" || xmlMode === "bulkMarketInfo") &&
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
        setXmlPairPreview(preview);
      } else if (xmlMode === "single") {
        if (!selectedXmlRecord?.catalogue_number || !selectedXmlFamilySummary || !selectedXmlVariantSummary) return;
        const preview = await api.previewXmlRecord(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
          selectedXmlRecord.catalogue_number,
        );
        setXmlPreview(preview);
      } else if (xmlMode === "marketInfo") {
        if (!selectedMarketInfoRequestArgs) return;
        const preview = await api.previewXmlMarketInfoPut(
          selectedMarketInfoRequestArgs.product_family,
          selectedMarketInfoRequestArgs.product_variant,
          selectedMarketInfoRequestArgs.catalogue_number,
          normalizedMarketInfoVersion,
          currentMarketInfoScenarioInputs(),
        );
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
        setXmlPatchPreview(preview);
      } else if (xmlMode === "bulkPost") {
        if (!selectedXmlFamilySummary || !selectedXmlVariantSummary) return;
        setXmlActionMessage("Generating Bulk Basic UDI POST preview...");
        const preview = await api.previewBulkPost(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
          normalizedBulkRecordCount,
          selectedXmlChunkSequence,
        );
        setXmlBulkPostPreview(preview);
        setXmlActionMessage(
          `Bulk Basic UDI POST preview generated for ${selectedXmlFamilySummary.product_family} / ${selectedXmlVariantSummary.product_variant}, chunk ${preview.selected_chunk_sequence}.`,
        );
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
        setXmlBulkPatchPreview(preview);
        setXmlActionMessage(
          `Bulk PATCH preview generated for ${selectedXmlFamilySummary.product_family} / ${selectedXmlVariantSummary.product_variant} / ${selectedBulkPatchParentGroup.basic_udi_di}.`,
        );
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to generate XML preview.";
      setError(message);
      setXmlActionMessage(message);
    } finally {
      setIsGeneratingXml(false);
    }
  }

  return { generateXmlPreview };
}
