"""Explicit profile launcher; --check-config never starts services or opens SQLite."""
from __future__ import annotations

import argparse
import os


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", choices=("dev", "prod"), required=True)
    parser.add_argument("--env-file", help="Optional profile file path (relative to project root)")
    parser.add_argument("--check-config", action="store_true")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    os.environ["EUDAMED_ENVIRONMENT"] = args.environment
    if args.env_file:
        os.environ["EUDAMED_ENV_FILE"] = args.env_file
    from app.config import get_settings, validate_schema_package

    get_settings.cache_clear()
    try:
        settings = get_settings()
        validate_schema_package(settings)
    except ValueError as exc:
        parser.error(str(exc))
    print(f"Environment: {settings.environment} | XML schema: {settings.eudamed_message_schema_version}")
    print(f"Profile: {settings.environment_file}")
    print(f"Schema directory: {settings.schema_dir}")
    print(f"Database: {settings.testing_state_db_path}")
    if args.check_config:
        print("Configuration valid; no services started and no database opened.")
        return
    import uvicorn

    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
