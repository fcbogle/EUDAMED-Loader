import type { MarketCountryReferenceEntry } from "./types";

const SPECIAL_FLAG_BY_CODE: Record<string, string> = {
  EL: "🇬🇷",
  XI: "🇬🇧",
};

function emojiFlagFromCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (SPECIAL_FLAG_BY_CODE[normalized]) {
    return SPECIAL_FLAG_BY_CODE[normalized];
  }
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return "🏳️";
  }
  return String.fromCodePoint(...normalized.split("").map((char) => 127397 + char.charCodeAt(0)));
}

export function resolveMarketCountryEntry(
  reference: MarketCountryReferenceEntry[],
  value: string | null | undefined,
): MarketCountryReferenceEntry | null {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return null;
  }
  const folded = normalized.toUpperCase();
  return (
    reference.find(
      (entry) =>
        entry.code.toUpperCase() === folded ||
        entry.name.toUpperCase() === folded ||
        entry.aliases.some((alias) => alias.toUpperCase() === folded),
    ) ?? null
  );
}

export function resolveMarketCountryName(
  reference: MarketCountryReferenceEntry[],
  value: string | null | undefined,
): string {
  return resolveMarketCountryEntry(reference, value)?.name ?? (value ?? "").trim();
}

export function resolveMarketCountryCode(
  reference: MarketCountryReferenceEntry[],
  value: string | null | undefined,
): string {
  const resolved = resolveMarketCountryEntry(reference, value);
  if (resolved) {
    return resolved.code;
  }
  return (value ?? "").trim().toUpperCase();
}

export function resolveMarketCountryFlag(
  reference: MarketCountryReferenceEntry[],
  value: string | null | undefined,
): string {
  const resolved = resolveMarketCountryEntry(reference, value);
  return emojiFlagFromCode(resolved?.code ?? (value ?? ""));
}
