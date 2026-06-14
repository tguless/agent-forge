#!/bin/sh
set -e
mkdir -p /app/data /app/data/agents /app/data/businesses /app/.forge_tmp /app/.forge_tmp/numba
for dir in /app/data /app/data/agents /app/data/businesses /app/.forge_tmp; do
  chown -R nextjs:nodejs "$dir"
done
exec gosu nextjs "$@"
