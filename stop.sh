#!/usr/bin/env bash
#
# Stop Agent Forge (kills the tracked PID + its children, then anything left on the port).
#   ./stop.sh
#   PORT=4000 ./stop.sh
#
set -uo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3030}"
PID_FILE=".forge.pid"
stopped=0

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    pkill -P "$PID" 2>/dev/null || true   # children (next-server worker)
    kill "$PID" 2>/dev/null || true       # parent
    stopped=1
  fi
  rm -f "$PID_FILE"
fi

# Fallback: kill whatever is still bound to the port.
if command -v lsof >/dev/null 2>&1; then
  PORT_PIDS="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
  if [ -n "$PORT_PIDS" ]; then
    echo "$PORT_PIDS" | xargs kill 2>/dev/null || true
    sleep 1
    STILL="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
    [ -n "$STILL" ] && echo "$STILL" | xargs kill -9 2>/dev/null || true
    stopped=1
  fi
fi

if [ "$stopped" = "1" ]; then
  echo "Agent Forge stopped (port $PORT)."
else
  echo "Agent Forge was not running."
fi
