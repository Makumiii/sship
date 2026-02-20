#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEMO_HOME="${1:-${ROOT_DIR}/.demo-home}"

mkdir -p "${DEMO_HOME}/.ssh" "${DEMO_HOME}/.sship"

# Keep demo environment deterministic.
rm -f "${DEMO_HOME}/.ssh"/demo* "${DEMO_HOME}/.ssh"/id_ed25519* "${DEMO_HOME}/.ssh"/config 2>/dev/null || true
rm -f "${DEMO_HOME}/.sship/"*.json 2>/dev/null || true

ssh-keygen -t ed25519 -N '' -f "${DEMO_HOME}/.ssh/demo_server" -C "demo-server@sship" >/dev/null

cd "${ROOT_DIR}"
bun run build >/dev/null

HOME="${DEMO_HOME}" node dist/index.js init --fix >/dev/null
HOME="${DEMO_HOME}" node dist/index.js create --template github -n demo-github -e demo@example.com -H github.com -u git -p '' >/dev/null
HOME="${DEMO_HOME}" node dist/index.js servers add -n demo-prod -H 10.0.0.10 -u ubuntu -k "${DEMO_HOME}/.ssh/demo_server" >/dev/null

echo "Prepared demo HOME at: ${DEMO_HOME}"
