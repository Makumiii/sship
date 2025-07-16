#!/usr/bin/env bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

# Path to main.ts relative to SCRIPT_DIR
MAIN_TS_PATH="$SCRIPT_DIR/../src/main.ts"

# Execute main.ts using bun, passing all arguments
bun run "$MAIN_TS_PATH" "$@"
