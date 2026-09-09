import { api } from "./api";
import type { XmlMode } from "./useXmlOperationAssessment";

export type AssessmentScope = {
  mode: XmlMode;
  productFamily: string;
  productVariant: string;
  catalogueNumber?: string | null;
  basicUdiDi?: string | null;
};

export function assessmentScopeKey(scope: AssessmentScope | null): string {
  return JSON.stringify(scope ? [scope.mode, scope.productFamily, scope.productVariant, scope.catalogueNumber ?? null, scope.basicUdiDi ?? null] : null);
}

export function requestXmlAssessment(scope: AssessmentScope) {
  const { productFamily, productVariant, catalogueNumber, basicUdiDi } = scope;
  switch (scope.mode) {
    case "post": return api.assessSinglePost(productFamily, productVariant, catalogueNumber);
    case "patch": return api.assessSinglePatch(productFamily, productVariant, catalogueNumber);
    case "marketInfo": return api.assessSingleMarketInfo(productFamily, productVariant, catalogueNumber);
    case "bulkPatch": return api.assessBulkPatch(productFamily, productVariant, basicUdiDi);
    case "bulkMarketInfo": return api.assessBulkMarketInfo(productFamily, productVariant, basicUdiDi);
    default: return api.assessBulkPost(productFamily, productVariant);
  }
}
