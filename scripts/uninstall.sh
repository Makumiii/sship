#!/usr/bin/env bash
set -euo pipefail

SSHIP_INSTALL_DIR="$HOME/sship"
SSHIP_SYMLINK="$HOME/.local/bin/sship"

echo "Uninstalling SSHIP..." 

rm -rf "$SSHIP_INSTALL_DIR"
rm -f "$SSHIP_SYMLINK"
rm -f "$HOME/.sship/profiles.json"

echo "SSHIP uninstalled successfully."
