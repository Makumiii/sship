#!/usr/bin/env bash
set -euo pipefail
echo "Uninstalling SSHIP..." 
echo "Removing $HOME/sship..."
rm -rf "$HOME/sship"
echo "Removing $HOME/.local/bin/sship..."
rm -f "$HOME/.local/bin/sship"
echo "SSHIP uninstalled successfully."