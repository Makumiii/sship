# Exit immediately if a command exits with a non-zero status.
$ErrorActionPreference = "Stop"

# Function to display usage
function usage {
  Write-Host "Usage: $($MyInvocation.MyCommand.Name) <key_path>"
  exit 1
}

# Check if key_path is provided
if ([string]::IsNullOrEmpty($args[0])) {
  usage
}

$KEY_PATH = $args[0]

# Remove key files
Remove-Item -Path "$KEY_PATH", "${KEY_PATH}.pub" -ErrorAction SilentlyContinue

Write-Host "Key files removed: $KEY_PATH and ${KEY_PATH}.pub"
