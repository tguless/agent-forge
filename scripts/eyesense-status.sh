#!/usr/bin/env bash
set -euo pipefail
HOST="${EYESENSE_HOST:-eyesense}"
REMOTE_DIR="${EYESENSE_REMOTE_DIR:-agent-forge}"
ssh "$HOST" bash -s <<EOF
set -euo pipefail
cd "\$HOME/${REMOTE_DIR}" 2>/dev/null || { echo "No ~/agent-forge on eyesense"; exit 1; }
echo "=== docker ps (agent-forge) ==="
docker ps --filter name=agent-forge --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo
echo "=== HTTP localhost:8911 ==="
curl -sI -m 5 http://127.0.0.1:8911/ | head -5 || echo "not responding"
echo
echo "=== git ==="
git rev-parse --short HEAD 2>/dev/null; git log -1 --oneline 2>/dev/null || true
EOF
