"""Shared normalization for the existing family/variant/catalogue identity rules."""
from __future__ import annotations


def normalize_identity(value: object) -> str:
    return "" if value is None else "".join(str(value).casefold().split())


def normalized_family_candidates(product_family: object) -> tuple[str, ...]:
    normalized = normalize_identity(product_family)
    if not normalized:
        return ()
    candidates = {normalized}
    candidates.update(filter(None, (normalize_identity(part) for part in str(product_family).split("/"))))
    return tuple(sorted(candidates))
