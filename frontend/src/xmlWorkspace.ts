import type { CanonicalValidationRecord, PostRegistrationPreview } from "./types";

export type XmlWorkspaceRecord = {
  catalogue_number: string | null;
  product_family: string | null;
  product_variant: string | null;
  trade_name: string | null;
  primary_udi_di: string | null;
  issuing_entity: string | null;
};

export type XmlSelectionRequestArgs = {
  product_family: string;
  product_variant: string;
  catalogue_number: string;
  primary_udi_di: string | null;
};

export function findRecordByCatalogueNumber(
  records: CanonicalValidationRecord[],
  catalogueNumber: string | null | undefined,
): CanonicalValidationRecord | null {
  if (!catalogueNumber) {
    return null;
  }
  return records.find((record) => record.catalogue_number === catalogueNumber) ?? null;
}

export function resolvePatchWorkspaceRecord(
  records: CanonicalValidationRecord[],
  assessedCatalogueNumber: string | null | undefined,
  fallbackRecord: CanonicalValidationRecord | null,
): CanonicalValidationRecord | null {
  return findRecordByCatalogueNumber(records, assessedCatalogueNumber) ?? fallbackRecord;
}

export function resolvePatchRequestArgs(
  record: CanonicalValidationRecord | null,
  fallback: {
    assessedCatalogueNumber: string | null | undefined;
    assessedPrimaryUdiDi: string | null | undefined;
    selectedProductFamily: string | null | undefined;
    selectedProductVariant: string | null | undefined;
  },
): XmlSelectionRequestArgs | null {
  if (record?.catalogue_number) {
    return {
      product_family: record.product_family,
      product_variant: record.product_variant,
      catalogue_number: record.catalogue_number,
      primary_udi_di: record.primary_udi_di ?? fallback.assessedPrimaryUdiDi ?? null,
    };
  }
  if (
    fallback.assessedCatalogueNumber &&
    fallback.selectedProductFamily &&
    fallback.selectedProductVariant
  ) {
    return {
      product_family: fallback.selectedProductFamily,
      product_variant: fallback.selectedProductVariant,
      catalogue_number: fallback.assessedCatalogueNumber,
      primary_udi_di: fallback.assessedPrimaryUdiDi ?? null,
    };
  }
  return null;
}

export function resolveMarketInfoRequestArgs(
  record: CanonicalValidationRecord | null,
): XmlSelectionRequestArgs | null {
  if (!record?.catalogue_number) {
    return null;
  }
  return {
    product_family: record.product_family,
    product_variant: record.product_variant,
    catalogue_number: record.catalogue_number,
    primary_udi_di: record.primary_udi_di,
  };
}

export function resolvePostWorkspaceRecord(
  preview: PostRegistrationPreview | null,
  candidateRecord: CanonicalValidationRecord | null,
  assessmentAvailable: boolean,
): XmlWorkspaceRecord | null {
  if (preview && candidateRecord) {
    return {
      catalogue_number: preview.catalogue_number,
      product_family: preview.product_family ?? candidateRecord.product_family,
      product_variant: preview.product_variant ?? candidateRecord.product_variant,
      trade_name: candidateRecord.trade_name,
      primary_udi_di: preview.primary_udi_di,
      issuing_entity: candidateRecord.issuing_entity,
    };
  }
  if (assessmentAvailable && candidateRecord) {
    return {
      catalogue_number: candidateRecord.catalogue_number,
      product_family: candidateRecord.product_family,
      product_variant: candidateRecord.product_variant,
      trade_name: candidateRecord.trade_name,
      primary_udi_di: candidateRecord.primary_udi_di,
      issuing_entity: candidateRecord.issuing_entity,
    };
  }
  return null;
}
