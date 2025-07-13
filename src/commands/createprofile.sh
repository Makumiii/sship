#!/usr/bin/env bash 
set -euo pipefail
PROFILE="$1"
shift 2
KEYS=("$@")


if [ ! -d "$PROFILE" ]; then
	mkdir -p "$PROFILE"
fi

for KEY in "${KEYS[@]}"; do
    if [ -f "$KEY" ]; then
        cp "$KEY" "$PROFILE/"
        echo "Copied $KEY to $PROFILE/"
    else
        echo "Warning: $KEY does not exist, skipping."
    fi
done

