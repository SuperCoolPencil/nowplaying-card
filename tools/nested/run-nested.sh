#!/bin/bash
# GNOME 49+ development window; source changes restart only this preview.
set -euo pipefail
src=$(cd "$(dirname "$0")/../.." && pwd)
exec python3 "$src/tools/nested/dev.py"
