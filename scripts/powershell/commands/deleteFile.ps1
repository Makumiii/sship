# Exit immediately if a command exits with a non-zero status.
$ErrorActionPreference = "Stop"

# Function to display usage
function usage {
  Write-Host "Usage: $($MyInvocation.MyCommand.Name) <file_path>"
  exit 1
}

# Check if file_path is provided
if ([string]::IsNullOrEmpty($args[0])) {
  usage
}

$FILE_PATH = $args[0]

# Remove file
Remove-Item -Path "$FILE_PATH" -ErrorAction SilentlyContinue

Write-Host "File removed: $FILE_PATH"
