import type { VariantMappingSummary, VariantValidationSummary } from "./types";

export function matchingProductionMappingVariants(
  mapping: VariantMappingSummary,
  variants: VariantValidationSummary[],
  family: string,
  variant: string,
): VariantValidationSummary[] {
  return variants.filter(summary =>
    summary.source_workbook === mapping.workbook &&
    summary.source_sheet === mapping.sheet &&
    summary.product_variant === mapping.device_model &&
    (!family || summary.product_family === family) &&
    (!variant || summary.product_variant === variant),
  );
}
