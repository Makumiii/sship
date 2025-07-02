#!/usr/bin/env bash 
TS_FILE_LOCATION="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

TS_FILE="${TS_FILE_LOCATION}/deleteKey.ts"

cd "$HOME" || exit 1
SSH_KEYS_LOCATION="$(pwd)"

echo "$SSH_KEYS_LOCATION"

deno run -A "${TS_FILE}" "${SSH_KEYS_LOCATION}"

