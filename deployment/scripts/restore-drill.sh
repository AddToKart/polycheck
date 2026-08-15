#!/usr/bin/env sh
set -eu

backup_file="${1:-/backups/latest.dump}"
: "${POSTGRES_PASSWORD_FILE:?POSTGRES_PASSWORD_FILE is required}"

fail() {
  printf 'restore-drill: %s\n' "$*" >&2
  exit 1
}

# The drill runs against whatever PostgreSQL PGHOST points at — normally the
# live cluster. Require an explicit confirmation so a stray run can never
# consume production resources or boot the production stack unintentionally.
[ "${RUN_RESTORE_DRILL:-}" = "1" ] || \
  fail "set RUN_RESTORE_DRILL=1 to confirm this drill may run against the current stack"

[ -r "$POSTGRES_PASSWORD_FILE" ] || fail "PostgreSQL password secret is not readable"
IFS= read -r PGPASSWORD < "$POSTGRES_PASSWORD_FILE" || true
[ -n "${PGPASSWORD:-}" ] || fail "PostgreSQL password secret is empty"
export PGPASSWORD

[ -f "$backup_file" ] || fail "backup does not exist: $backup_file"
resolved="$(readlink -f "$backup_file")"
case "$resolved" in
  /backups/*) ;;
  *) fail "backup must resolve inside /backups" ;;
esac
checksum_file="${resolved}.sha256"
[ -f "$checksum_file" ] || fail "checksum does not exist: $checksum_file"
(
  cd "$(dirname "$resolved")" || exit 1
  sha256sum -c "$(basename "$checksum_file")" >/dev/null
)
pg_restore --list "$resolved" >/dev/null

drill_db="polycheck_restore_drill_$(date -u +%Y%m%d%H%M%S)_$$"
cleanup() {
  original_status="$?"
  trap - EXIT HUP INT TERM
  cleanup_log="/tmp/restore-drill-cleanup.$$.log"
  if ! dropdb --if-exists --force --no-password "$drill_db" >"$cleanup_log" 2>&1; then
    printf 'restore-drill: cleanup FAILED for temporary database %s\n' "$drill_db" >&2
    cat "$cleanup_log" >&2 || true
    [ "$original_status" -ne 0 ] || original_status=1
  fi
  rm -f "$cleanup_log"
  exit "$original_status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

createdb --no-password "$drill_db"
pg_restore --dbname "$drill_db" --no-owner --no-acl --exit-on-error --no-password "$resolved"
psql --dbname "$drill_db" --no-password --tuples-only --no-align \
  --command "SELECT CASE WHEN to_regclass('public.\"User\"') IS NOT NULL THEN 1 ELSE 0 END;" | grep -qx 1

printf 'Restore drill passed using isolated temporary database %s\n' "$drill_db"
