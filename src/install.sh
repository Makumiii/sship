#!/usr/bin/env bash
set -euo pipefail
echo "Changing directory to \$HOME..."
cd "$HOME" || exit 1

echo "Cloning SSHIP repository..."
git clone https://github.com/Makumiii/sship.git

echo "Changing directory to sship..."
cd "sship" || exit 1

echo "Linking run.sh to \$HOME/.local/bin/sship..."
ln -s "$(pwd)/src/run.sh" "$HOME/.local/bin/sship"
echo "Making sship executable..."
chmod +x "$HOME/.local/bin/sship"
echo "Installation complete."
