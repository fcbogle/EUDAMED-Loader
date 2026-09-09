import { useEffect, useState } from "react";

import { requestXmlAssessment } from "./xmlAssessmentRequest";
import type { OperationAssessment } from "./types";

export type XmlMode =
  | "post"
  | "marketInfo"
  | "bulkUdidiPost"
  | "patch"
  | "bulkPatch"
  | "bulkMarketInfo";

type UseXmlOperationAssessmentArgs = {
  activeTab: string;
  xmlMode: XmlMode;
  selectedProductFamily: string | null | undefined;
  selectedProductVariant: string | null | undefined;
  selectedPatchCatalogueNumber: string | null;
  selectedBulkPatchBasicUdiDi: string;
  selectedBulkMarketInfoBasicUdiDi: string;
};

export function useXmlOperationAssessment({
  activeTab,
  xmlMode,
  selectedProductFamily,
  selectedProductVariant,
  selectedPatchCatalogueNumber,
  selectedBulkPatchBasicUdiDi,
  selectedBulkMarketInfoBasicUdiDi,
}: UseXmlOperationAssessmentArgs) {
  const [xmlOperationAssessment, setXmlOperationAssessment] = useState<OperationAssessment | null>(null);
  const [xmlOperationAssessmentError, setXmlOperationAssessmentError] = useState<string | null>(null);
  const [isLoadingXmlOperationAssessment, setIsLoadingXmlOperationAssessment] = useState<boolean>(false);

  useEffect(() => {
    if (activeTab !== "xml") {
      return;
    }
    if (!selectedProductFamily || !selectedProductVariant) {
      setXmlOperationAssessment(null);
      setXmlOperationAssessmentError(null);
      setIsLoadingXmlOperationAssessment(false);
      return;
    }

    let cancelled = false;
    setIsLoadingXmlOperationAssessment(true);
    setXmlOperationAssessment(null);
    setXmlOperationAssessmentError(null);

    void (async () => {
      try {
        const assessment = await requestXmlAssessment({
          mode: xmlMode,
          productFamily: selectedProductFamily,
          productVariant: selectedProductVariant,
          catalogueNumber: xmlMode === "patch" || xmlMode === "marketInfo" ? selectedPatchCatalogueNumber : null,
          basicUdiDi: xmlMode === "bulkMarketInfo" ? selectedBulkMarketInfoBasicUdiDi : selectedBulkPatchBasicUdiDi,
        });
        if (!cancelled) {
          setXmlOperationAssessment(assessment);
        }
      } catch (requestError) {
        if (!cancelled) {
          setXmlOperationAssessment(null);
          setXmlOperationAssessmentError(
            requestError instanceof Error ? requestError.message : "Operation assessment is unavailable.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingXmlOperationAssessment(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    xmlMode,
    selectedProductFamily,
    selectedProductVariant,
    selectedPatchCatalogueNumber,
    selectedBulkPatchBasicUdiDi,
    selectedBulkMarketInfoBasicUdiDi,
  ]);

  return {
    xmlOperationAssessment,
    setXmlOperationAssessment,
    xmlOperationAssessmentError,
    setXmlOperationAssessmentError,
    isLoadingXmlOperationAssessment,
    setIsLoadingXmlOperationAssessment,
  };
}
