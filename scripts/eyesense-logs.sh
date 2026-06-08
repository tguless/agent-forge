#!/usr/bin/env bash
set -euo pipefail
HOST="${EYESENSE_HOST:-eyesense}"
REMOTE_DIR="${EYESENSE_REMOTE_DIR:-agent-forge}"
TAIL="${1:-80}"
ssh "$HOST" "cd ~/${REMOTE_DIR} && docker compose -f docker-compose.yml -f docker-compose.prod.yml logs web --tail ${TAIL}"
