#!/usr/bin/env bash
set -euo pipefail

SSH_FOLDER_LOCATION="$HOME/.ssh"
BACKUP_DIR="/tmp/sship-backup"
ARCHIVE_NAME="$HOME/sship_backup.tar.gz"
PASS_PHRASE="${1:-}"

rm -rf "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

find "$SSH_FOLDER_LOCATION" -maxdepth 1 -type f \( \
    -name "id_*" -o -name "*.pub" -o -name "config" \
\) ! \( \
    -name "known_hosts" -o -name "authorized_keys" -o -name "*.sock" -o -name "control" -o -name "*.pid" \
\) -exec cp {} "$BACKUP_DIR" \;

tar -czf "$ARCHIVE_NAME" -C "$BACKUP_DIR" .

rm -rf "$BACKUP_DIR"

if [  -z "$PASS_PHRASE" ]; then 
    echo "Skipping encryption of backup archive."
else
    gpg --batch --yes --passphrase "$PASS_PHRASE" -c "$ARCHIVE_NAME"
    echo "Encrypted backup archive created: ${ARCHIVE_NAME}.gpg"
    rm -f "$ARCHIVE_NAME"
fi

echo "SSHIP backup complete: $ARCHIVE_NAME"
