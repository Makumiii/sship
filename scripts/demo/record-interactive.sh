#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/.local/bin:${PATH}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEMO_HOME="${DEMO_HOME:-${ROOT_DIR}/.demo-home}"
CAST_PATH="${1:-${ROOT_DIR}/assets/interactive-cli.cast}"
GIF_PATH="${CAST_PATH%.cast}.gif"

if ! command -v asciinema >/dev/null 2>&1; then
  echo "asciinema is required. Install it, then rerun this script."
  exit 1
fi

mkdir -p "$(dirname "${CAST_PATH}")"

"${ROOT_DIR}/scripts/demo/setup-demo-home.sh" "${DEMO_HOME}" >/dev/null

echo "Recording interactive CLI to ${CAST_PATH}"
echo "Use Ctrl+D in the app to exit recording when done."

cd "${ROOT_DIR}"
asciinema rec \
  --overwrite \
  --idle-time-limit 1.2 \
  --title "SSHIP Interactive CLI" \
  --command "bash -lc 'cd \"${ROOT_DIR}\" && HOME=\"${DEMO_HOME}\" node dist/index.js'" \
  "${CAST_PATH}"

if command -v agg >/dev/null 2>&1; then
  echo "Rendering GIF demo to ${GIF_PATH}"
  agg --font-size 18 "${CAST_PATH}" "${GIF_PATH}" >/dev/null
else
  echo "Optional: install agg to render an embeddable GIF from the cast."
fi
