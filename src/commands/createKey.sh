#!/usr/bin/env bash
set -euo pipefail

TASK="create"
CONTAINING_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

TS_FILE="${CONTAINING_DIR}/createKey.ts"
TEMP_FILE="/tmp/sship/sship-${TASK}-responses.json"

deno run -A "${TS_FILE}"

EMAIL="$(jq -r '.email' < "${TEMP_FILE}")"
PASSPHRASE="$(jq -r '.passphrase' < "${TEMP_FILE}")"
NAME="$(jq -r '.name' < "${TEMP_FILE}")"
HOST="$(jq -r '.host' < "${TEMP_FILE}")"
MACHINE_USER="$(jq -r '.user' < "${TEMP_FILE}")"

# Check if required fields are present (POSIX compliant)
if [ -z "${EMAIL}" ] || [ "${EMAIL}" = "null" ]; then
    echo "[SSHIP] createKey.sh: Error: 'email' is missing in ${TEMP_FILE}. Exiting."
    exit 1
fi

if [ -z "${PASSPHRASE}" ] || [ "${PASSPHRASE}" = "null" ]; then
    echo "[SSHIP] createKey.sh: Error: 'passphrase' is missing in ${TEMP_FILE}. Exiting."
    exit 1
fi

if [ -z "${NAME}" ] || [ "${NAME}" = "null" ]; then
    echo "[SSHIP] createKey.sh: Error: 'name' is missing in ${TEMP_FILE}. Exiting."
    exit 1
fi

if [ -z "${MACHINE_USER}" ] || [ "${MACHINE_USER}" = "null" ]; then
    echo "[SSHIP] createKey.sh: Error: 'user' is missing in ${TEMP_FILE}. Exiting."
    exit 1
fi

if [ -z "${HOST}" ] || [ "${HOST}" = "null" ]; then
    echo "[SSHIP] createKey.sh: Error: 'host' is missing in ${TEMP_FILE}. Exiting."
    exit 1
fi

ssh-keygen -t ed25519 -C "${EMAIL}" -N "${PASSPHRASE}" -f ~/".ssh/${NAME}"
echo "SSH key creation complete."

"$CONTAINING_DIR/sshConf.sh" "${NAME}" "${MACHINE_USER}" "${HOST}"
echo "SSH configuration added."
