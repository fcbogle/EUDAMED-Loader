from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class MarketCountryReferenceEntry:
    name: str
    code: str
    aliases: tuple[str, ...] = ()


MARKET_COUNTRY_REFERENCE: tuple[MarketCountryReferenceEntry, ...] = (
    MarketCountryReferenceEntry("Austria", "AT"),
    MarketCountryReferenceEntry("Belgium", "BE"),
    MarketCountryReferenceEntry("Bulgaria", "BG"),
    MarketCountryReferenceEntry("Croatia", "HR"),
    MarketCountryReferenceEntry("Cyprus", "CY"),
    MarketCountryReferenceEntry("Czechia", "CZ", aliases=("Czech Republic",)),
    MarketCountryReferenceEntry("Denmark", "DK"),
    MarketCountryReferenceEntry("Estonia", "EE"),
    MarketCountryReferenceEntry("Finland", "FI"),
    MarketCountryReferenceEntry("France", "FR"),
    MarketCountryReferenceEntry("Germany", "DE"),
    MarketCountryReferenceEntry("Greece", "EL", aliases=("GR",)),
    MarketCountryReferenceEntry("Hungary", "HU"),
    MarketCountryReferenceEntry("Ireland", "IE"),
    MarketCountryReferenceEntry("Italy", "IT"),
    MarketCountryReferenceEntry("Latvia", "LV"),
    MarketCountryReferenceEntry("Lithuania", "LT"),
    MarketCountryReferenceEntry("Luxembourg", "LU"),
    MarketCountryReferenceEntry("Malta", "MT"),
    MarketCountryReferenceEntry("Netherlands", "NL"),
    MarketCountryReferenceEntry("Norway", "NO"),
    MarketCountryReferenceEntry("Poland", "PL"),
    MarketCountryReferenceEntry("Portugal", "PT"),
    MarketCountryReferenceEntry("Romania", "RO"),
    MarketCountryReferenceEntry("Slovakia", "SK"),
    MarketCountryReferenceEntry("Slovenia", "SI"),
    MarketCountryReferenceEntry("Spain", "ES"),
    MarketCountryReferenceEntry("Sweden", "SE"),
    MarketCountryReferenceEntry("Iceland", "IS"),
    MarketCountryReferenceEntry("Liechtenstein", "LI"),
    MarketCountryReferenceEntry("Turkey", "TR"),
    MarketCountryReferenceEntry("Northern Ireland", "XI"),
)


def market_country_reference_payload() -> list[dict[str, object]]:
    return [asdict(entry) for entry in MARKET_COUNTRY_REFERENCE]


def normalize_market_country_code(value: str | None) -> str | None:
    if value in (None, ""):
        return None
    token = value.strip()
    if not token:
        return None
    normalized = token.casefold()
    for entry in MARKET_COUNTRY_REFERENCE:
        if normalized == entry.name.casefold():
            return entry.code
        if normalized == entry.code.casefold():
            return entry.code
        if any(normalized == alias.casefold() for alias in entry.aliases):
            return entry.code
    return token.upper()
