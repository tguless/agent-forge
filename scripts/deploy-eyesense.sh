#!/usr/bin/env bash
# Deploy Agent Forge on the eyesense home server.
#
# Run ON eyesense after the repo is cloned:
#   ssh eyesense 'cd ~/agent-forge && ./scripts/deploy-eyesense.sh'
#
# One-time server setup:
#   git clone git@github.com:tguless/agent-forge.git ~/agent-forge
#   cd ~/agent-forge && cp .env.example .env.local   # edit secrets on server
#
# If .env.local is missing, this script seeds ANTHROPIC_* from ~/patent-researcher/.env.local
# when present (GEMINI_API_KEY must be added manually for image generation).
#
# Prerequisites:
#   - Docker + docker compose
#   - Home router forwards external TCP 8911 (CloudFront origin for agent.paperiq.ai)

set -euo pipefail
cd "$(dirname "$0")/.."

GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

bootstrap_env() {
  if [ -f .env.local ]; then
    return 0
  fi
  if [ -f "$HOME/patent-researcher/.env.local" ]; then
    echo "Creating .env.local from patent-researcher Anthropic keys..."
    {
      grep -E '^(ANTHROPIC_API_KEY|ANTHROPIC_MODEL)=' "$HOME/patent-researcher/.env.local" || true
      echo 'NEXT_PUBLIC_APP_URL=https://agent.paperiq.ai'
      echo '# Optional — Nano Banana image generation'
      echo 'GEMINI_API_KEY='
    } > .env.local
    echo "Created .env.local (add GEMINI_API_KEY for visual assets)."
    return 0
  fi
  echo "Missing .env.local on server." >&2
  echo "  cp .env.example .env.local   # then edit keys on eyesense" >&2
  exit 1
}

bootstrap_env

if [ "${DEPLOY_SKIP_GIT_PULL:-}" != "1" ]; then
  echo "Pulling latest from ${GIT_REMOTE}/${GIT_BRANCH} ..."
  git fetch "$GIT_REMOTE" "$GIT_BRANCH"
  git checkout "$GIT_BRANCH"
  git pull --ff-only "$GIT_REMOTE" "$GIT_BRANCH"
fi

echo "Deploying at $(pwd) @ $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"

export NEXT_PUBLIC_APP_URL="$(grep '^NEXT_PUBLIC_APP_URL=' .env.local | cut -d= -f2- | tr -d '"' || echo 'https://agent.paperiq.ai')"

${COMPOSE} up -d --build web

echo "Waiting for web on :8911..."
for _ in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8911/ >/dev/null 2>&1; then
    echo "Agent Forge is up on http://127.0.0.1:8911"
    echo "Public URL (after CloudFront): https://agent.paperiq.ai"
    exit 0
  fi
  sleep 2
done

echo "WARNING: web did not respond on :8911 — check: ${COMPOSE} logs web --tail 50"
exit 1
