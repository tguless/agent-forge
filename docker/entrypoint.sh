#!/bin/sh
set -e
mkdir -p /app/data /app/public/agents /app/.forge_tmp
for dir in /app/data /app/public/agents /app/.forge_tmp; do
  chown -R nextjs:nodejs "$dir"
done
exec gosu nextjs "$@"
