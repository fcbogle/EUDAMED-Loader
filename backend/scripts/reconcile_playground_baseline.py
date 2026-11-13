"""Assess/apply a reviewed Playground export baseline to the existing Dev DB only."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('batch_id')
    parser.add_argument('--env-file',default='.env.dev')
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--expected-digest')
    parser.add_argument('--approved-by')
    args=parser.parse_args()
    os.environ['EUDAMED_ENVIRONMENT']='dev'
    os.environ['EUDAMED_ENV_FILE']=args.env_file
    from app.config import get_settings,validate_schema_package
    from app.services.playground_baseline_import import PlaygroundBaselineImporter
    get_settings.cache_clear()
    settings=get_settings();validate_schema_package(settings)
    service=PlaygroundBaselineImporter(settings)
    if args.apply:
        if not args.expected_digest or not args.approved_by:
            parser.error('--apply requires --expected-digest and --approved-by')
        result=service.apply(args.batch_id,expected_digest=args.expected_digest,approved_by=args.approved_by)
    else:
        report=service.prepare(args.batch_id)
        result={key:report[key] for key in ('batch_id','evidence_id','database_snapshot_sha256','summary','already_applied')}
        result['database']=str(service.database)
    print(json.dumps(result,indent=2))


if __name__=='__main__':
    main()
