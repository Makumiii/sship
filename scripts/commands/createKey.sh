#!/usr/bin/env bash
set -euo pipefail

CONTAINING_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

# Get the JSON string from the first argument
RESPONSES_JSON="$1"

# Parse the JSON using jq
EMAIL="$(echo "$RESPONSES_JSON" | jq -r '.email')"
PASSPHRASE="$(echo "$RESPONSES_JSON" | jq -r '.passphrase')"
NAME="$(echo "$RESPONSES_JSON" | jq -r '.name')"
HOST="$(echo "$RESPONSES_JSON" | jq -r '.host')"
MACHINE_USER="$(echo "$RESPONSES_JSON" | jq -r '.user')"

# Check if required fields are present (POSIX compliant)
if [ -z "${EMAIL}" ] || [ "${EMAIL}" = "null" ]; then
    echo "[SSHIP] createKey.sh: Error: 'email' is missing. Exiting."
    exit 1
fi

if [ "${PASSPHRASE}" = "null" ]; then
    PASSPHRASE=""
fi

if [ -z "${NAME}" ] || [ "${NAME}" = "null" ]; then
    echo "[SSHIP] createKey.sh: Error: 'name' is missing. Exiting."
    exit 1
fi

if [ -z "${MACHINE_USER}" ] || [ "${MACHINE_USER}" = "null" ]; then
    echo "[SSHIP] createKey.sh: Error: 'user' is missing. Exiting."
    exit 1
fi

if [ -z "${HOST}" ] || [ "${HOST}" = "null" ]; then
    echo "[SSHIP] createKey.sh: Error: 'host' is missing. Exiting."
    exit 1
fi

ssh-keygen -t ed25519 -C "${EMAIL}" -N "${PASSPHRASE}" -f ~/".ssh/${NAME}"
echo "SSH key creation complete."

"$CONTAINING_DIR/sshConf.sh" "${NAME}" "${MACHINE_USER}" "${HOST}"
echo "SSH configuration added."