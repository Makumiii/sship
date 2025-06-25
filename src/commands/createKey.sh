#!/usr/bin/env bash

echo "Creating SSH key..."
TASK="create"
TS_FILE_LOCATION="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_FILE="${TS_FILE_LOCATION}/createKey.ts"
TEMP_FILE="/tmp/sship/sship-${TASK}-responses.json"

echo "Running TypeScript file to get key details..."
deno run -A "${TS_FILE}"


echo "Extracting email from input..."
EMAIL="$(jq -r '.email' < "${TEMP_FILE}")"

echo "Extracting passphrase from input..."
PASSPHRASE="$(jq -r '.passphrase' < "${TEMP_FILE}")"

echo "Extracting key name from input..."
NAME="$(jq -r '.name' < "${TEMP_FILE}")"
# Check if required fields are present (POSIX compliant)
if [ -z "${EMAIL}" ] || [ "${EMAIL}" = "null" ]; then
    echo "Error: 'email' is missing in ${TEMP_FILE}."
    exit 1
fi

if [ -z "${PASSPHRASE}" ] || [ "${PASSPHRASE}" = "null" ]; then
    echo "Error: 'passphrase' is missing in ${TEMP_FILE}."
    exit 1
fi

if [ -z "${NAME}" ] || [ "${NAME}" = "null" ]; then
    echo "Error: 'name' is missing in ${TEMP_FILE}."
    exit 1
fi

echo "Generating SSH key with name: ${NAME}"
ssh-keygen -t ed25519 -C "${EMAIL}" -N "${PASSPHRASE}" -f ~/".ssh/${NAME}"

echo "SSH key creation complete."