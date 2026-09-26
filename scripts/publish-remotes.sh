#!/bin/sh
# Run from any directory; publish the repository containing this script.
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec python3 "$script_dir/publish_remotes.py" "$@"
