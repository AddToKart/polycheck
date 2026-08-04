#!/usr/bin/env sh
set -eu

: "${BACKUP_DIR:?Set BACKUP_DIR to a protected absolute directory}"

umask 077
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${BACKUP_DIR%/}/polycheck-${timestamp}.dump"
partial="${target}.partial"

mkdir -p "$BACKUP_DIR"
docker compose --env-file .env.production exec -T postgres \
  sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --username polycheck --dbname polycheck --format custom --no-owner --no-acl' \
  > "$partial"
mv "$partial" "$target"
sha256sum "$target" > "${target}.sha256"
pg_restore --list "$target" >/dev/null

printf 'Verified backup: %s\n' "$target"
