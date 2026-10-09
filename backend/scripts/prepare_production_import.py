"""Prepare the production review workbook; this command does not import SQLite."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.production_workbook_preparation import prepare_workbook

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--template-dir", type=Path, default=ROOT / "data/prod/template")
    parser.add_argument("--xml-dir", type=Path, default=ROOT / "data/prod/eudamed_xml")
    parser.add_argument("--parent-reference", type=Path, default=ROOT / "data/prod/template/BasicUDIs 9th October.xlsx")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data/prod/import_file")
    parser.add_argument("--encoding-override", action="append", default=[], metavar="FILENAME=ENCODING",
                        help="Explicit per-file override, recorded in the audit; repeat as needed")
    parser.add_argument("--parent-market-override", action="append", default=[], metavar="ISSUER:PARENT=COUNTRY,COUNTRY",
                        help="Approved proposed parent markets; first country is first placement")
    parser.add_argument("--previous-audit", type=Path, help="Report identities removed since an earlier preparation")
    args = parser.parse_args()
    overrides = {}
    for item in args.encoding_override:
        filename, separator, encoding = item.partition("=")
        if not separator or not filename or not encoding or filename in overrides:
            parser.error("Each encoding override must be a unique FILENAME=ENCODING")
        overrides[filename] = encoding
    markets = {}
    for item in args.parent_market_override:
        identity, separator, values = item.partition("=")
        issuer, colon, parent = identity.partition(":")
        countries = [v.strip() for v in values.split(",")]
        key = (issuer.strip().upper(), parent.strip())
        if not separator or not colon or not all(key) or not all(countries) or key in markets:
            parser.error("Each market override must be a unique ISSUER:PARENT=COUNTRY,COUNTRY")
        markets[key] = countries
    result = prepare_workbook(template_dir=args.template_dir, xml_dir=args.xml_dir,
                              parent_reference=args.parent_reference, output_dir=args.output_dir,
                              encoding_overrides=overrides, parent_market_overrides=markets,
                              previous_audit=args.previous_audit)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
