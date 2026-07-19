#!/bin/sh
set -eu

if [ "${1:-}" = "migrate" ]; then
  PRISMA_CLI="$(node -p "require.resolve('prisma/build/index.js')")"
  exec node "$PRISMA_CLI" migrate deploy
fi

exec node dist/main.js
