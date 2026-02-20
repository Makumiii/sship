#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1}"
ARCHIVE_NAME="$HOME/sship_backup.tar.gz"
PASS_PHRASE="${2:-}"



tar -czf "$ARCHIVE_NAME" -C "$BACKUP_DIR" .

rm -rf "$BACKUP_DIR"

if [  -z "$PASS_PHRASE" ]; then 
    echo "Skipping encryption of backup archive."
else
    if gpg --batch --yes --pinentry-mode loopback --passphrase "$PASS_PHRASE" -c "$ARCHIVE_NAME"; then
        echo "Encrypted backup archive created: ${ARCHIVE_NAME}.gpg"
        rm -f "$ARCHIVE_NAME"
    else
        echo "Encryption failed. Keeping unencrypted archive: $ARCHIVE_NAME"
    fi
fi

echo "SSHIP backup complete: $ARCHIVE_NAME"
