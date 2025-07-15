#!/usr/bin/env bash
set -euo pipefail

SSHIP_INSTALL_DIR="$HOME/sship"
SSHIP_BIN_DIR="$HOME/.local/bin"
SSHIP_BIN_PATH="$SSHIP_BIN_DIR/sship"
SSHIP_RUN_SCRIPT_PATH="$SSHIP_INSTALL_DIR/scripts/run.sh"

echo "Ensuring $SSHIP_BIN_DIR exists..."
mkdir -p "$SSHIP_BIN_DIR" || { echo "Error: Failed to create $SSHIP_BIN_DIR."; exit 1; }

if [ -d "$SSHIP_INSTALL_DIR" ]; then
    echo "SSHIP directory already exists. Updating..."
    cd "$SSHIP_INSTALL_DIR" || { echo "Error: Failed to change directory to $SSHIP_INSTALL_DIR."; exit 1; }
    git pull || { echo "Error: Failed to pull latest changes."; exit 1; }
else
    echo "Cloning SSHIP repository..."
    cd "$HOME" || { echo "Error: Failed to change directory to $HOME."; exit 1; }
    git clone https://github.com/Makumiii/sship.git || { echo "Error: Failed to clone repository."; exit 1; }
    # After cloning, we are in $HOME, so we need to cd into $SSHIP_INSTALL_DIR
    cd "$SSHIP_INSTALL_DIR" || { echo "Error: Failed to change directory to $SSHIP_INSTALL_DIR."; exit 1; }
fi

echo "Linking sship executable..."
# Use -f to force overwrite if symlink already exists
ln -sf "$SSHIP_RUN_SCRIPT_PATH" "$SSHIP_BIN_PATH" || { echo "Error: Failed to create symlink."; exit 1; }



echo "Installation/Update complete."