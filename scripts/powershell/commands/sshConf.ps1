# Exit immediately if a command exits with a non-zero status.
$ErrorActionPreference = "Stop"

# Function to display usage
function usage {
  Write-Host "Usage: $($MyInvocation.MyCommand.Name) <name> <host> <user> <key_path> <profile>"
  exit 1
}

# Check if all arguments are provided
if ([string]::IsNullOrEmpty($args[0]) -or [string]::IsNullOrEmpty($args[1]) -or [string]::IsNullOrEmpty($args[2]) -or [string]::IsNullOrEmpty($args[3]) -or [string]::IsNullOrEmpty($args[4])) {
  usage
}

$NAME = $args[0]
$SSH_HOST = $args[1]
$USER = $args[2]
$KEY_PATH = $args[3]
$PROFILE = $args[4]

$SSH_CONFIG = Join-Path $HOME ".ssh\config"

# Ensure the config file exists
if (-not (Test-Path $SSH_CONFIG)) {
  New-Item -ItemType File -Path $SSH_CONFIG | Out-Null
}


# Remove existing entry for the host if it exists
$configContent = Get-Content $SSH_CONFIG -Raw
$blockRegex = "(?m)^Host\s+$([regex]::Escape($SSH_HOST))\b(?:\r?\n(?!Host\b)[ \t]+\S.*)*"

if ($configContent -match $blockRegex) {
  $newConfigContent = $configContent -replace $blockRegex, ""
  Set-Content -Path $SSH_CONFIG -Value $newConfigContent
  Write-Host "Removed existing SSH configuration for Host $SSH_HOST."
}

# Add new entry
Add-Content -Path $SSH_CONFIG -Value "`nHost $SSH_HOST"
Add-Content -Path $SSH_CONFIG -Value "  HostName $SSH_HOST"
Add-Content -Path $SSH_CONFIG -Value "  User $USER"
Add-Content -Path $SSH_CONFIG -Value "  IdentityFile $KEY_PATH"
Add-Content -Path $SSH_CONFIG -Value "  IdentitiesOnly yes"
Add-Content -Path $SSH_CONFIG -Value "  AddKeysToAgent yes"
Add-Content -Path $SSH_CONFIG -Value "  # Profile: $PROFILE"

Write-Host "SSH configuration updated for Host $SSH_HOST."
