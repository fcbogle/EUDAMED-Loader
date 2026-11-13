"""Create or inspect copied Dev input batches; never open application databases."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.dev_input_batches import create_dev_batch, inspect_dev_batch


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create")
    create.add_argument("--project-root", type=Path, required=True)
    create.add_argument("--xml-dir", type=Path, required=True)
    create.add_argument("--batch-id", required=True)
    inspect = commands.add_parser("inspect")
    inspect.add_argument("batch_dir", type=Path)
    inspect.add_argument("--exclude-workbook", action="append", default=[], help="Report an explicit inspection scope without changing application configuration")
    args = parser.parse_args()
    try:
        if args.command == "create":
            print(create_dev_batch(project_root=args.project_root, xml_dir=args.xml_dir, batch_id=args.batch_id))
            return 0
        result = inspect_dev_batch(args.batch_dir, excluded_workbook_names=tuple(args.exclude_workbook))
        print(json.dumps(result, indent=2))
        return 0 if result["inspection_complete"] else 1
    except (ValueError, OSError) as exc:
        parser.exit(1, f"{exc}\n")


if __name__ == "__main__":
    raise SystemExit(main())
