from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.testing_batch_backfill import TestingBatchBackfillService


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill EUDAMED submission batch audit rows.")
    parser.add_argument("--apply", action="store_true", help="Write the derived batch rows. The default is a dry run.")
    args = parser.parse_args()
    result = TestingBatchBackfillService().run(apply=args.apply)
    print(json.dumps({"mode": "apply" if args.apply else "dry_run", **result.as_dict()}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
