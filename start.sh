#!/usr/bin/env bash
#
# Start Agent Forge.
#   ./start.sh         -> dev mode (hot reload), default
#   ./start.sh prod    -> production build + start
#   PORT=4000 ./start.sh
#
set -euo pipefail
cd "$(dirname "$0")"

# better-sqlite3 is a native addon compiled per Node ABI. This project's deps were
# installed/built on Node 18, so prefer that version if nvm is available. The ABI
# self-heal below rebuilds for whatever Node ends up active, so this is best-effort.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
set +u
for _nvm_sh in "$NVM_DIR/nvm.sh" "/opt/homebrew/opt/nvm/nvm.sh" "/usr/local/opt/nvm/nvm.sh"; do
  if [ -s "$_nvm_sh" ]; then . "$_nvm_sh" >/dev/null 2>&1 || true; nvm use 18 >/dev/null 2>&1 || true; break; fi
done
set -u

PORT="${PORT:-3030}"
MODE="${1:-dev}"
PID_FILE=".forge.pid"
LOG_FILE="forge.log"
NEXT_BIN="node_modules/next/dist/bin/next"

# Already running?
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Agent Forge already running (PID $(cat "$PID_FILE")) -> http://localhost:$PORT"
  echo "Use ./stop.sh first if you want to restart."
  exit 0
fi
rm -f "$PID_FILE"

# Dependencies
if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run)..."
  npm install
fi

# Native module ABI guard: better-sqlite3 must match the active Node version,
# otherwise every DB call fails with ERR_DLOPEN_FAILED (HTTP 500). Rebuild if needed.
if [ -d node_modules/better-sqlite3 ] && ! node -e "require('better-sqlite3')" >/dev/null 2>&1; then
  echo "better-sqlite3 was built for a different Node version; rebuilding for $(node -v) ..."
  npm rebuild better-sqlite3 || npm install better-sqlite3 --build-from-source
fi

# Env sanity check
if [ ! -f .env.local ]; then
  echo "WARNING: .env.local not found."
  echo "  Run: cp .env.example .env.local  and add your ANTHROPIC_API_KEY (GEMINI_API_KEY optional)."
elif ! grep -q '^ANTHROPIC_API_KEY=..' .env.local; then
  echo "WARNING: ANTHROPIC_API_KEY looks empty in .env.local -- generation will fail until it is set."
fi

echo "Starting Agent Forge ($MODE) on port $PORT ..."

if [ "$MODE" = "prod" ]; then
  npm run build
  PORT="$PORT" nohup node "$NEXT_BIN" start -p "$PORT" >"$LOG_FILE" 2>&1 &
else
  PORT="$PORT" nohup node "$NEXT_BIN" dev -p "$PORT" >"$LOG_FILE" 2>&1 &
fi

echo $! >"$PID_FILE"

# Wait for readiness (up to ~40s)
for _ in $(seq 1 80); do
  if grep -qiE "ready in|started server" "$LOG_FILE" 2>/dev/null; then
    echo ""
    echo "Agent Forge is up -> http://localhost:$PORT"
    echo "  Logs:  tail -f agent-forge/forge.log"
    echo "  Stop:  ./stop.sh"
    exit 0
  fi
  if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Server exited during startup. Last log lines:"
    tail -n 20 "$LOG_FILE" || true
    rm -f "$PID_FILE"
    exit 1
  fi
  sleep 0.5
done

echo "... still starting. Check status with: tail -f agent-forge/forge.log"
echo "URL: http://localhost:$PORT"
