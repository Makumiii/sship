#!/usr/bin/env bash
echo "Changing directory to \$HOME..."
cd "$HOME" || exit 1

echo "Cloning SSHIP repository..."
git clone https://github.com/Makumiii/SSHIP.git

echo "Changing directory to SSHIP..."
cd "SSHIP" || exit 1

echo "Linking run.sh to \$HOME/.local/bin/sship..."
ln /src/run.sh "$HOME/.local/bin/sship"
echo "Making sship executable..."
chmod +x "$HOME/.local/bin/sship"
echo "Installation complete."