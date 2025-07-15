#!/usr/bin/env bash
set -euo pipefail

CURRENT_FILE_LOCATION="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

COMMANDS_FILE_LOCATION="$CURRENT_FILE_LOCATION/commands"


USER_CHOSEN_TASK="$1"

if [ -z "${USER_CHOSEN_TASK}" ] || [ "${USER_CHOSEN_TASK}" = "null" ]; then
    echo "[SSHIP] Error: 'task' is missing. Exiting."
    exit 1
fi

if [ "${USER_CHOSEN_TASK}" = "create" ]; then
    "$COMMANDS_FILE_LOCATION/createKey.sh"
    
elif [ "${USER_CHOSEN_TASK}" = "delete" ]; then
    "$COMMANDS_FILE_LOCATION/deleteKey.sh"
elif [ "${USER_CHOSEN_TASK}" = "backup" ]; then
    "$COMMANDS_FILE_LOCATION/backup.sh" "$@"
elif [ "${USER_CHOSEN_TASK}" = "list" ]; then
    "$COMMANDS_FILE_LOCATION/listKeys.sh"
elif [ "${USER_CHOSEN_TASK}" = "uninstall" ]; then
    "$CURRENT_FILE_LOCATION/uninstall.sh"

else
    echo "[SSHIP] Error: Invalid task '${USER_CHOSEN_TASK}'. Exiting."
    exit 1
fi