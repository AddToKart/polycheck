#!/usr/bin/env sh
set -eu

backup_file="${1:?Usage: restore-drill.sh /absolute/path/to/polycheck.dump}"
test -f "$backup_file"
pg_restore --list "$backup_file" >/dev/null

drill_db="polycheck_restore_drill_$(date -u +%Y%m%d%H%M%S)"
cleanup() {
  docker compose --env-file .env.production exec -T postgres \
    sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" dropdb --if-exists --force --username polycheck "$1"' sh "$drill_db"
}
trap cleanup EXIT INT TERM

docker compose --env-file .env.production exec -T postgres \
  sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" createdb --username polycheck "$1"' sh "$drill_db"
docker compose --env-file .env.production exec -T postgres \
  sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --username polycheck --dbname "$1" --no-owner --no-acl --exit-on-error' sh "$drill_db" \
  < "$backup_file"
docker compose --env-file .env.production exec -T postgres \
  sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql --username polycheck --dbname "$1" --tuples-only --command "SELECT COUNT(*) FROM \"User\";"' sh "$drill_db"

printf 'Restore drill passed using temporary database %s\n' "$drill_db"
