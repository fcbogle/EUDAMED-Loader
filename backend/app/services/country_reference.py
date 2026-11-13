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


UNCONFIRMED_COUNTRY_REASON = "Proposed market country contains '?'; confirmation required"


def tentative_market_fields(fields: dict) -> list[tuple[str, object]]:
    """Find uncertainty in source market-country columns, never unrelated free text."""
    found = []
    for name, value in fields.items():
        label = " ".join(str(name).casefold().split())
        if (("member state" in label and "market" in label) or "market countr" in label):
            if isinstance(value, str) and '?' in value:
                found.append((str(name), value))
    return found


def market_country_errors(record) -> list[str]:
    values = [item.country for item in record.market_availability_items]
    values += [field.value for field in record.fields
               if field.canonical_path == 'device_record.market_availability.first_eu_market_country']
    return [f"Market country {value!r} contains '?'. Confirm the country before importing or generating XML."
            for value in sorted({value for value in values if isinstance(value, str) and '?' in value})]


def apply_market_country_readiness(record) -> bool:
    errors = market_country_errors(record)
    if not errors:
        return False
    for error in errors:
        if error not in record.xml_blockers:
            record.xml_blockers.append(error)
    record.xml_readiness.status = 'incomplete'
    return True


def normalize_market_country_code(value: str | None) -> str | None:
    if value in (None, ""):
        return None
    if "?" in value:
        raise ValueError(f"Market country {value!r} contains '?'. Confirm the country before XML generation.")
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
