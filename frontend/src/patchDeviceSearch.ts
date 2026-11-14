import type { CanonicalValidationRecord } from "./types";

export type PatchDeviceSearchOption = {
  key: string;
  record: CanonicalValidationRecord;
  blockedReason: string | null;
};

const normalise = (value: string | null) => (value ?? "").trim().toLocaleLowerCase();
const catalogueScope = (record: CanonicalValidationRecord) => JSON.stringify([
  record.product_family, record.product_variant, record.catalogue_number,
]);

// Index once per imported snapshot. Never convert identifiers to numbers.
export function patchDeviceSearchOptions(records: CanonicalValidationRecord[]): PatchDeviceSearchOption[] {
  const identities = new Map<string, Set<string>>();
  const unique = new Map<string, CanonicalValidationRecord>();
  for (const record of records) {
    const identity = JSON.stringify([record.issuing_entity, record.primary_udi_di]);
    const scope = catalogueScope(record);
    const values = identities.get(scope) ?? new Set<string>();
    values.add(identity);
    identities.set(scope, values);
    const key = JSON.stringify([scope, identity]);
    // Conflicting duplicate source rows must not hide a blocked record.
    if (!unique.has(key) || record.xml_readiness.status !== "complete") unique.set(key, record);
  }
  return [...unique].map(([key, record]) => ({
    key, record,
    blockedReason: !record.catalogue_number || !record.primary_udi_di || !record.issuing_entity
      ? "Device identity is incomplete. Review the imported data."
      : identities.get(catalogueScope(record))!.size > 1
        ? "This catalogue identifies multiple devices in the model. Resolve the identity before PATCH."
        : record.xml_readiness.status !== "complete"
          ? "Review the device’s XML data blockers before selecting it for PATCH."
          : null,
  }));
}

export function searchPatchDevices(options: PatchDeviceSearchOption[], query: string) {
  const search = normalise(query);
  if (search.length < 2) return { total: 0, results: [] as PatchDeviceSearchOption[] };
  const rank = (option: PatchDeviceSearchOption) => {
    const values = [option.record.primary_udi_di, option.record.catalogue_number].map(normalise);
    return values.includes(search) ? 0 : values.some(value => value.startsWith(search)) ? 1 : 2;
  };
  const matches = options.filter(({ record }) =>
    [record.primary_udi_di, record.catalogue_number].some(value => normalise(value).includes(search)));
  matches.sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key));
  return { total: matches.length, results: matches.slice(0, 10) };
}

export function scopePatchDevices(options: PatchDeviceSearchOption[], family: string | null, variant: string | null) {
  return family && variant ? options.filter(option => option.record.product_family === family &&
    option.record.product_variant === variant) : [];
}

// An explicit search selection must never fall back to another device.
export function resolvePatchSearchSelection(options: PatchDeviceSearchOption[], key: string,
  family: string | null, variant: string | null): CanonicalValidationRecord | null {
  const option = options.find(value => value.key === key);
  return option && !option.blockedReason && option.record.product_family === family &&
    option.record.product_variant === variant ? option.record : null;
}

type DeviceIdentity = {
  product_family: string | null;
  product_variant: string | null;
  catalogue_number: string | null;
  primary_udi_di: string | null;
};
export function patchSearchBaselineMatches(selected: DeviceIdentity | null, baseline: DeviceIdentity | null): boolean {
  return Boolean(selected?.primary_udi_di && baseline &&
    selected.product_family === baseline.product_family && selected.product_variant === baseline.product_variant &&
    selected.catalogue_number === baseline.catalogue_number && selected.primary_udi_di === baseline.primary_udi_di);
}
