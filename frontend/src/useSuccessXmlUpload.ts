import { useRef, useState, type ChangeEvent } from "react";

import { api } from "./api";
import type { OperationAssessment, TestingSubjectReadModelSummary } from "./types";

type UploadMode = "post" | "patch";

type UploadScope = {
  productFamily: string;
  productVariant: string;
  mode: UploadMode;
};

type UseSuccessXmlUploadArgs = {
  scope: UploadScope | null;
  setError: (message: string | null) => void;
  setXmlActionMessage: (message: string | null) => void;
  setTestingSubjectSummaries: (summaries: TestingSubjectReadModelSummary[]) => void;
  setXmlOperationAssessment: (assessment: OperationAssessment | null) => void;
  setXmlOperationAssessmentError: (message: string | null) => void;
  clearPreviewState: () => void;
};

export function useSuccessXmlUpload({
  scope,
  setError,
  setXmlActionMessage,
  setTestingSubjectSummaries,
  setXmlOperationAssessment,
  setXmlOperationAssessmentError,
  clearPreviewState,
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
      const [updatedSummaries, updatedAssessment] = await Promise.all([
        api.testingSubjectSummaries({
          product_family: scope.productFamily,
          product_variant: scope.productVariant,
          limit: 10000,
        }),
        scope.mode === "patch"
          ? api.assessSinglePatch(scope.productFamily, scope.productVariant)
          : api.assessSinglePost(scope.productFamily, scope.productVariant),
      ]);

      setTestingSubjectSummaries(updatedSummaries);
      setXmlOperationAssessment(updatedAssessment);
      setXmlOperationAssessmentError(null);
      clearPreviewState();
      setXmlActionMessage(
        result.duplicate_event
          ? `${result.summary_message} This success XML was already recorded and the ${scope.mode === "patch" ? "PATCH" : "POST"} assessment was refreshed.`
          : `${result.summary_message} The tracked testing state and ${scope.mode === "patch" ? "PATCH" : "POST"} assessment were refreshed.`,
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
