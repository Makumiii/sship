#!/usr/bin/env bash
set -euo pipefail

SSHIP_INSTALL_DIR="$HOME/sship"
SSHIP_SYMLINK="$HOME/.local/bin/sship"

echo "Uninstalling SSHIP..." 

rm -rf "$SSHIP_INSTALL_DIR"
rm -f "$SSHIP_SYMLINK"
rm -rf "$HOME/.sship"

# Also remove npm global installation if it exists
npm uninstall -g sship 2>/dev/null || true

echo "SSHIP uninstalled successfully."
