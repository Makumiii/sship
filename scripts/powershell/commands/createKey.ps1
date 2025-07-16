# Exit immediately if a command exits with a non-zero status.
$ErrorActionPreference = "Stop"

# Function to display usage
function usage {
  Write-Host "Usage: $($MyInvocation.MyCommand.Name) <json_responses>"
  exit 1
}

# Check if JSON responses are provided
if ([string]::IsNullOrEmpty($args[0])) {
  usage
}

$JSON_RESPONSES = $args[0]

# Parse JSON responses using ConvertFrom-Json
$responses = $JSON_RESPONSES | ConvertFrom-Json
$EMAIL = $responses.email
$PASSPHRASE = $responses.passphrase
$NAME = $responses.name
$SSH_HOST = $responses.host
$USER = $responses.user
$PROFILE = $responses.profile

# Define SSH directory
$SSH_DIR = "$HOME\.ssh"
if (-not (Test-Path $SSH_DIR)) {
  New-Item -ItemType Directory -Path $SSH_DIR | Out-Null
}


$KEY_PATH = Join-Path $SSH_DIR $NAME

# Generate SSH key
Write-Host "Generating public/private ed25519 key pair."
if (-not ([string]::IsNullOrEmpty($PASSPHRASE))) {
  ssh-keygen -t ed25519 -f "$KEY_PATH" -C "$EMAIL" -N "$PASSPHRASE"
} else {
  ssh-keygen -t ed25519 -f "$KEY_PATH" -C "$EMAIL" -N ""
}

Write-Host "Your identification has been saved in $KEY_PATH"
Write-Host "Your public key has been saved in ${KEY_PATH}.pub"

# Display key fingerprint and randomart image
ssh-keygen -lf "${KEY_PATH}.pub"
ssh-keygen -lvf "${KEY_PATH}.pub"

Write-Host "SSH key creation complete."

# Add SSH configuration
Write-Host "SSH configuration for $NAME added to $SSH_DIR\config"
& (Join-Path $PSScriptRoot "sshConf.ps1") "$NAME" "$SSH_HOST" "$USER" "$KEY_PATH" "$PROFILE"
Write-Host "SSH configuration added."
