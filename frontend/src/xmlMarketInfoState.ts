import type { RegisteredDeviceAnchor, TestingSubjectReadModelSummary } from "./types";

type SelectionAnchorInput = {
  product_family: string;
  product_variant: string;
  catalogue_number: string;
  primary_udi_di: string | null;
};

export type MarketInfoScenarioItem = {
  id: string;
  country: string;
  originalPlacedOnMarket: boolean;
};

export function buildSelectionAnchor(record: SelectionAnchorInput): RegisteredDeviceAnchor {
  return {
    product_family: record.product_family,
    product_variant: record.product_variant,
    catalogue_number: record.catalogue_number,
    primary_udi_di: record.primary_udi_di ?? "Pending",
    post_file_name: "Pending preview",
    patch_file_name: "Pending preview",
    post_valid: false,
    patch_valid: false,
    eudamed_status: "Selection target",
  };
}

export function fieldValue(
  record: { fields: Array<{ canonical_path: string; value: string | null }> } | null,
  canonicalPath: string,
): string | null {
  return record?.fields.find((field) => field.canonical_path === canonicalPath)?.value ?? null;
}

export function basicUdiDiForRecord(
  record: { fields: Array<{ canonical_path: string; value: string | null }> } | null,
): string | null {
  return fieldValue(record, "basic_device.basic_udi_di") ?? fieldValue(record, "device_record.basic_udi_identifier");
}

export function parseBooleanString(value: string | null | undefined): boolean | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" ? true : normalized === "false" ? false : null;
}

export function parseCatalogueNumberList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .replace(/\r/g, "\n")
        .split(/[\n,;]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

export function createMarketInfoScenarioId(): string {
  return `market-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildMarketInfoScenarioItems(
  items: Array<{ country: string; original_placed_on_market: boolean }>,
): MarketInfoScenarioItem[] {
  if (items.length < 1) {
    return [{ id: createMarketInfoScenarioId(), country: "", originalPlacedOnMarket: false }];
  }
  return items.map((item) => ({
    id: createMarketInfoScenarioId(),
    country: item.country,
    originalPlacedOnMarket: item.original_placed_on_market,
  }));
}

export function buildCurrentMarketInfoItemsForCatalogue(args: {
  catalogueNumber: string | null | undefined;
  testingSubjectSummaries: TestingSubjectReadModelSummary[];
  selectedXmlVariantRecords: Array<{
    catalogue_number: string | null;
    market_availability_items?: Array<{ country: string; original_placed_on_market: boolean }>;
  }>;
}): MarketInfoScenarioItem[] {
  const { catalogueNumber, testingSubjectSummaries, selectedXmlVariantRecords } = args;
  if (!catalogueNumber) {
    return [];
  }
  const trackedItems = testingSubjectSummaries.find(
    (summary) => summary.catalogue_number === catalogueNumber,
  )?.latest_successful_market_info_state?.market_countries;
  if (trackedItems?.length) {
    return trackedItems.map((item, index) => ({
      id: `tracked-market-${catalogueNumber}-${index}-${item.country}`,
      country: item.country,
      originalPlacedOnMarket: item.original_placed_on_market,
    }));
  }
  return (selectedXmlVariantRecords.find((record) => record.catalogue_number === catalogueNumber)?.market_availability_items ?? []).map(
    (item, index) => ({
      id: `current-market-${catalogueNumber}-${index}-${item.country}`,
      country: item.country,
      originalPlacedOnMarket: item.original_placed_on_market,
    }),
  );
}
