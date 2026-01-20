#!/usr/bin/env bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

# Path to index.ts relative to SCRIPT_DIR
INDEX_TS_PATH="$SCRIPT_DIR/../src/index.ts"

# Execute index.ts using bun, passing all arguments
bun run "$INDEX_TS_PATH" "$@"
