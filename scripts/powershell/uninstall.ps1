# Exit immediately if a command exits with a non-zero status.
$ErrorActionPreference = "Stop"

# Define the installation directory
$INSTALL_DIR = "$HOME\sship"
$LOCAL_BIN = "$HOME\.local\bin"
$SSHIP_EXEC = "$LOCAL_BIN\sship.ps1"

Write-Host "Starting SSHIP uninstallation..."

# Remove symbolic link (or wrapper script)
if (Test-Path $SSHIP_EXEC) {
  Write-Host "Removing SSHIP executable: $SSHIP_EXEC"
  Remove-Item -Path $SSHIP_EXEC -Force
} else {
  Write-Host "SSHIP executable not found: $SSHIP_EXEC"
}

# Remove installation directory
if (Test-Path $INSTALL_DIR) {
  Write-Host "Removing SSHIP installation directory: $INSTALL_DIR"
  Remove-Item -Path $INSTALL_DIR -Recurse -Force
} else {
  Write-Host "SSHIP installation directory not found: $INSTALL_DIR"
}

Write-Host "SSHIP uninstallation complete."
