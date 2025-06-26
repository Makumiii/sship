#!/usr/bin/env bash

SSH_FOLDER_LOCATION="$HOME/.ssh"
BACKUP_DIR="/tmp/sship-backup"
ARCHIVE_NAME="$HOME/sship_backup.tar.gz"
PASS_PHRASE="$1"

rm -rf "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

find "$SSH_FOLDER_LOCATION" -maxdepth 1 -type f \( \
    -name "id_*" -o -name "*.pub" -o -name "config" \
\) ! \( \
    -name "known_hosts" -o -name "authorized_keys" -o -name "*.sock" -o -name "control" -o -name "*.pid" \
\) -exec cp {} "$BACKUP_DIR" \;

# Create tar.gz archive
tar -czf "$ARCHIVE_NAME" -C "$BACKUP_DIR" .

rm -rf "$BACKUP_DIR"
#encryption 

if [  -z "$PASS_PHRASE" ]; then 
    echo "skipping encryption of backup archive "
else
    gpg --batch --yes --passphrase "$PASS_PHRASE" -c "$ARCHIVE_NAME"
    echo "Encrypted backup archive created: ${ARCHIVE_NAME}.gpg"
    rm -f "$ARCHIVE_NAME"
fi

echo "sship backup complete: $ARCHIVE_NAME"
