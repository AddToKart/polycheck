#!/usr/bin/env sh
set -eu
for name in RUNTIME_DATABASE_PASSWORD MIGRATOR_DATABASE_PASSWORD BACKUP_DATABASE_PASSWORD; do
  case "$name" in
    RUNTIME_DATABASE_PASSWORD) value="${RUNTIME_DATABASE_PASSWORD:-}" ;;
    MIGRATOR_DATABASE_PASSWORD) value="${MIGRATOR_DATABASE_PASSWORD:-}" ;;
    BACKUP_DATABASE_PASSWORD) value="${BACKUP_DATABASE_PASSWORD:-}" ;;
  esac
  [ "${#value}" -ge 24 ] || { printf '%s must contain at least 24 characters\n' "$name" >&2; exit 1; }
done
[ "$RUNTIME_DATABASE_PASSWORD" != "$MIGRATOR_DATABASE_PASSWORD" ]
[ "$RUNTIME_DATABASE_PASSWORD" != "$BACKUP_DATABASE_PASSWORD" ]
[ "$MIGRATOR_DATABASE_PASSWORD" != "$BACKUP_DATABASE_PASSWORD" ]
PGPASSWORD="$(cat /run/secrets/postgres_password)"
export PGPASSWORD
exec psql -X -v ON_ERROR_STOP=1 -f /provision-roles.sql
