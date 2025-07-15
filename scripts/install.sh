#!/usr/bin/env bash
set -euo pipefail

echo "Changing directory to \$HOME..."
cd "$HOME" || { echo "Error: Failed to change directory to \$HOME."; exit 1; }

echo "Cloning SSHIP repository..."
git clone https://github.com/Makumiii/sship.git || { echo "Error: Failed to clone repository."; exit 1; }

echo "Changing directory to sship..."
cd "sship" || { echo "Error: Failed to change directory to sship."; exit 1; }

echo "Linking run.sh to \$HOME/.local/bin/sship..."
ln -s "$(pwd)/src/main.ts" "$HOME/.local/bin/sship" || { echo "Error: Failed to create symlink."; exit 1; }

echo "Making sship executable..."
chmod +x "$HOME/.local/bin/sship" || { echo "Error: Failed to make sship executable."; exit 1; }

echo "Installation complete."
