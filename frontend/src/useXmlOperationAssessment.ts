import { useEffect, useState } from "react";

import { api } from "./api";
import type { OperationAssessment } from "./types";

export type XmlMode =
  | "post"
  | "single"
  | "marketInfo"
  | "bulkPost"
  | "bulkUdidiPost"
  | "patch"
  | "bulkPatch"
  | "bulkMarketInfo";

type UseXmlOperationAssessmentArgs = {
  activeTab: string;
  xmlMode: XmlMode;
  selectedProductFamily: string | null | undefined;
  selectedProductVariant: string | null | undefined;
  selectedBulkPatchBasicUdiDi: string;
};

export function useXmlOperationAssessment({
  activeTab,
  xmlMode,
  selectedProductFamily,
  selectedProductVariant,
  selectedBulkPatchBasicUdiDi,
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
    if (xmlMode === "single" || xmlMode === "marketInfo" || xmlMode === "bulkMarketInfo") {
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
        const assessment =
          xmlMode === "post"
            ? await api.assessSinglePost(selectedProductFamily, selectedProductVariant)
            : xmlMode === "patch"
              ? await api.assessSinglePatch(selectedProductFamily, selectedProductVariant)
              : xmlMode === "bulkPatch"
                ? await api.assessBulkPatch(
                    selectedProductFamily,
                    selectedProductVariant,
                    selectedBulkPatchBasicUdiDi || undefined,
                  )
                : await api.assessBulkPost(selectedProductFamily, selectedProductVariant);
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
    selectedBulkPatchBasicUdiDi,
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
