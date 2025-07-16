#!/bin/bash
set -e
if [ -z "$1" ]; then
  echo "Usage: $0 <file_path>"
  exit 1
fi
FILE_PATH=$1
rm -f "$FILE_PATH"
echo "File removed: $FILE_PATH"
