#!/usr/bin/env bash
set -euo pipefail

CONTAINING_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

TS_FILE="${CONTAINING_DIR}/listKeys.ts"

cd "$HOME" || exit 1
SSH_KEYS_LOCATION="$(pwd)"

deno run -A "$TS_FILE" "$SSH_KEYS_LOCATION"