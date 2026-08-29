import { useRef, useState, type ChangeEvent } from "react";

import { api } from "./api";
import type { OperationAssessment, SuccessXmlUploadResult, TestingSubjectReadModelSummary } from "./types";

type UploadMode = "post" | "patch" | "marketInfo" | "bulkPost" | "bulkUdidiPost" | "bulkPatch" | "bulkMarketInfo";

type UploadScope = {
  productFamily: string;
  productVariant: string;
  mode: UploadMode;
  basicUdiDi?: string | null;
};

type UseSuccessXmlUploadArgs = {
  scope: UploadScope | null;
  setError: (message: string | null) => void;
  setXmlActionMessage: (message: string | null) => void;
  setTestingSubjectSummaries: (summaries: TestingSubjectReadModelSummary[]) => void;
  setXmlOperationAssessment: (assessment: OperationAssessment | null) => void;
  setXmlOperationAssessmentError: (message: string | null) => void;
  clearPreviewState: () => void;
  onUploadRecorded?: (result: SuccessXmlUploadResult) => void;
};

export function useSuccessXmlUpload({
  scope,
  setError,
  setXmlActionMessage,
  setTestingSubjectSummaries,
  setXmlOperationAssessment,
  setXmlOperationAssessmentError,
  clearPreviewState,
  onUploadRecorded,
}: UseSuccessXmlUploadArgs) {
  const [isUploadingSuccessXml, setIsUploadingSuccessXml] = useState<boolean>(false);
  const successXmlInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadSuccessXml(file: File): Promise<void> {
    if (!scope) {
      return;
    }

    setIsUploadingSuccessXml(true);
    setError(null);
    setXmlActionMessage(`Uploading success XML for ${file.name}...`);

    try {
      const xmlContent = await file.text();
      const result = await api.uploadSuccessXml(file.name, xmlContent);
      const assessmentRequest =
        scope.mode === "patch"
          ? api.assessSinglePatch(scope.productFamily, scope.productVariant)
          : scope.mode === "post"
            ? api.assessSinglePost(scope.productFamily, scope.productVariant)
            : scope.mode === "marketInfo"
              ? null
            : scope.mode === "bulkMarketInfo"
              ? null
            : scope.mode === "bulkPatch"
              ? api.assessBulkPatch(scope.productFamily, scope.productVariant, scope.basicUdiDi ?? undefined)
              : api.assessBulkPost(scope.productFamily, scope.productVariant);
      const updatedSummariesPromise = api.testingSubjectSummaries({
        product_family: scope.productFamily,
        product_variant: scope.productVariant,
        limit: 10000,
      });
      const [updatedSummaries, updatedAssessment] = await Promise.all([
        updatedSummariesPromise,
        assessmentRequest ?? Promise.resolve<OperationAssessment | null>(null),
      ]);

      setTestingSubjectSummaries(updatedSummaries);
      if (assessmentRequest) {
        setXmlOperationAssessment(updatedAssessment);
        setXmlOperationAssessmentError(null);
      }
      onUploadRecorded?.(result);
      clearPreviewState();
      const operationLabel =
        scope.mode === "patch"
          ? "PATCH"
          : scope.mode === "post"
            ? "POST"
            : scope.mode === "marketInfo"
              ? "Market Info"
            : scope.mode === "bulkMarketInfo"
              ? "Bulk Market Info"
            : scope.mode === "bulkPatch"
              ? "Bulk PATCH"
              : "Bulk POST";
      setXmlActionMessage(
        result.duplicate_event
          ? `${result.summary_message} This success XML was already recorded and the ${operationLabel} workspace was refreshed.`
          : `${result.summary_message} The tracked testing state and ${operationLabel} workspace were refreshed.`,
      );
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to upload success XML.";
      setError(message);
      setXmlActionMessage(message);
    } finally {
      setIsUploadingSuccessXml(false);
      if (successXmlInputRef.current) {
        successXmlInputRef.current.value = "";
      }
    }
  }

  function handleUploadSuccessXmlClick(): void {
    successXmlInputRef.current?.click();
  }

  function handleSuccessXmlSelected(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    void uploadSuccessXml(file);
  }

  return {
    isUploadingSuccessXml,
    successXmlInputRef,
    handleUploadSuccessXmlClick,
    handleSuccessXmlSelected,
  };
}
