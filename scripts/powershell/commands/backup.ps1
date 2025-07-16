# Exit immediately if a command exits with a non-zero status.
$ErrorActionPreference = "Stop"

# Function to display usage
function usage {
  Write-Host "Usage: $($MyInvocation.MyCommand.Name) <temp_dir> <passphrase>"
  exit 1
}

# Check if arguments are provided
if ([string]::IsNullOrEmpty($args[0]) -or [string]::IsNullOrEmpty($args[1])) {
  usage
}

$TEMP_DIR = $args[0]
$PASSPHRASE = $args[1]
$BACKUP_FILE = "$HOME\sship_backup.tar.gz"

Write-Host "Creating tar archive..."
tar -czf "$BACKUP_FILE" -C "$TEMP_DIR" .

Write-Host "Encrypting backup file..."
gpg --batch --yes --passphrase "$PASSPHRASE" -c "$BACKUP_FILE"

Write-Host "Removing unencrypted backup file..."
Remove-Item -Path "$BACKUP_FILE"

Write-Host "Backup created and encrypted at ${BACKUP_FILE}.gpg"

# Clean up temporary directory
Remove-Item -Path "$TEMP_DIR" -Recurse -Force
Write-Host "Temporary directory $TEMP_DIR removed."
