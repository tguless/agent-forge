#!/usr/bin/env bash
# From your laptop: verify git push, then SSH to eyesense and run deploy-eyesense.sh.
#
# Usage:
#   git commit … && git push
#   ./scripts/trigger-eyesense-deploy.sh
#
# Options:
#   DEPLOY_SKIP_GIT_CHECK=1
#   EYESENSE_HOST=eyesense
#   EYESENSE_REMOTE_DIR=agent-forge

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${EYESENSE_HOST:-eyesense}"
REMOTE_DIR="${EYESENSE_REMOTE_DIR:-agent-forge}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"

cd "$ROOT"

if [ "${DEPLOY_SKIP_GIT_CHECK:-}" != "1" ]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "Uncommitted changes — commit and push first:" >&2
    git status --short >&2
    exit 1
  fi
  git fetch "$GIT_REMOTE" "$GIT_BRANCH"
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse "$GIT_REMOTE/$GIT_BRANCH")" ]; then
    echo "Push to $GIT_REMOTE/$GIT_BRANCH before deploy:" >&2
    echo "  git push $GIT_REMOTE $GIT_BRANCH" >&2
    exit 1
  fi
  echo "Git OK: $(git rev-parse --short HEAD) on $GIT_REMOTE/$GIT_BRANCH"
fi

REPO_URL="$(git remote get-url "$GIT_REMOTE")"

ssh "$HOST" bash -s <<EOF
set -euo pipefail
REMOTE_DIR="\$HOME/${REMOTE_DIR}"
REPO_URL='$REPO_URL'
GIT_BRANCH='$GIT_BRANCH'

if [ ! -d "\$REMOTE_DIR/.git" ]; then
  echo "First-time setup: cloning \$REPO_URL ..."
  git clone --branch "\$GIT_BRANCH" "\$REPO_URL" "\$REMOTE_DIR"
fi

cd "\$REMOTE_DIR"
chmod +x scripts/deploy-eyesense.sh
exec ./scripts/deploy-eyesense.sh
EOF
