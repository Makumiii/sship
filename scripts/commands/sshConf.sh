#!/usr/bin/env bash 
set -euo pipefail
PATH_TO_CONF="$HOME/.ssh"
CONF_FILE="config"
NAME="$1"
MACHINE_USER="$2"
HOST="$3"

HOST_ALIAS="$NAME"
IDENTITY_FILE="$HOME/.ssh/$NAME"

if [ -z "$NAME" ] || [ -z "$MACHINE_USER" ] || [ -z "$HOST" ]; then
    echo "Usage: $0 <name> <machine_user> <host>"
    exit 1
fi

if [ ! -d "$PATH_TO_CONF" ]; then
    mkdir -p "$PATH_TO_CONF"
fi

if [ ! -f "$PATH_TO_CONF/$CONF_FILE" ]; then
    touch "$PATH_TO_CONF/$CONF_FILE"
fi

# Remove any existing block for this alias to keep config idempotent.
TMP_FILE="$(mktemp)"
awk -v host="$HOST_ALIAS" '
BEGIN { skip=0 }
/^Host[ \t]+/ {
    n = split($0, parts, /[ \t]+/)
    skip=0
    for (i=2; i<=n; i++) {
        if (parts[i] == host) {
            skip=1
            break
        }
    }
}
{
    if (!skip) print $0
}
' "$PATH_TO_CONF/$CONF_FILE" > "$TMP_FILE"
mv "$TMP_FILE" "$PATH_TO_CONF/$CONF_FILE"

cat <<EOF >> "$PATH_TO_CONF/$CONF_FILE"
Host $HOST_ALIAS
    HostName $HOST
    User $MACHINE_USER
    IdentityFile $IDENTITY_FILE
EOF
echo "SSH configuration for $HOST_ALIAS added to $PATH_TO_CONF/$CONF_FILE"
