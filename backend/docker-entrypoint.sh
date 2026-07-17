#!/bin/sh
set -eu

PRISMA_CLI="$(node -p "require.resolve('prisma/build/index.js')")"
node "$PRISMA_CLI" migrate deploy

exec node dist/main.js
