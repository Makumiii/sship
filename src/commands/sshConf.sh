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
    mkdir -p "$PATH_TO_CONF "
    
fi

if [ ! -f "$PATH_TO_CONF/$CONF_FILE" ]; then
    touch "$PATH_TO_CONF/$CONF_FILE"
fi

cat <<EOF >> "$PATH_TO_CONF/$CONF_FILE"
Host $HOST_ALIAS
    HostName $HOST
    User $MACHINE_USER
    IdentityFile $IDENTITY_FILE
EOF
echo "SSH configuration for $HOST_ALIAS added to $PATH_TO_CONF/$CONF_FILE"