#!/usr/bin/env sh
set -eu

fail() {
  printf 'validate-production-recovery: %s\n' "$*" >&2
  exit 1
}

env_file="${1:-}"
read_setting() {
  setting_name="$1"
  current_value="$2"
  default_value="${3:-}"
  if [ -n "$current_value" ]; then
    printf '%s' "$current_value"
    return
  fi
  if [ -n "$env_file" ]; then
    [ -r "$env_file" ] || fail "cannot read environment file: $env_file"
    file_value="$(awk -v key="$setting_name" '
      index($0, key "=") == 1 { sub(/^[^=]*=/, ""); sub(/\r$/, ""); value=$0 }
      END { printf "%s", value }
    ' "$env_file")"
    if [ -n "$file_value" ]; then
      printf '%s' "$file_value"
      return
    fi
  fi
  printf '%s' "$default_value"
}

require_uint() {
  name="$1"
  value="$2"
  case "$value" in
    ''|*[!0-9]*) fail "$name must be an unsigned integer" ;;
  esac
}

backup_path="$(read_setting POSTGRES_BACKUP_PATH "${POSTGRES_BACKUP_PATH:-}")"
wal_path="$(read_setting POSTGRES_WAL_ARCHIVE_PATH "${POSTGRES_WAL_ARCHIVE_PATH:-}")"
[ -n "$backup_path" ] || fail "POSTGRES_BACKUP_PATH is required"
[ -n "$wal_path" ] || fail "POSTGRES_WAL_ARCHIVE_PATH is required"
case "$backup_path" in /*) ;; *) fail "POSTGRES_BACKUP_PATH must be absolute" ;; esac
case "$wal_path" in /*) ;; *) fail "POSTGRES_WAL_ARCHIVE_PATH must be absolute" ;; esac
[ "$backup_path" != "$wal_path" ] || fail "backup and WAL archive paths must be different directories"

rpo_minutes="$(read_setting PITR_RPO_MINUTES "${PITR_RPO_MINUTES:-}")"
rto_minutes="$(read_setting PITR_RTO_MINUTES "${PITR_RTO_MINUTES:-}")"
archive_timeout="$(read_setting POSTGRES_ARCHIVE_TIMEOUT_SECONDS "${POSTGRES_ARCHIVE_TIMEOUT_SECONDS:-}" 300)"
wal_min_free_kb="$(read_setting WAL_MIN_FREE_KB "${WAL_MIN_FREE_KB:-}" 524288)"
require_uint PITR_RPO_MINUTES "$rpo_minutes"
require_uint PITR_RTO_MINUTES "$rto_minutes"
require_uint POSTGRES_ARCHIVE_TIMEOUT_SECONDS "$archive_timeout"
require_uint WAL_MIN_FREE_KB "$wal_min_free_kb"
[ "$rpo_minutes" -ge 1 ] || fail "PITR_RPO_MINUTES must be at least 1"
[ "$rto_minutes" -ge 1 ] || fail "PITR_RTO_MINUTES must be at least 1"
[ "$archive_timeout" -ge 60 ] || fail "POSTGRES_ARCHIVE_TIMEOUT_SECONDS must be at least 60"
[ "$wal_min_free_kb" -ge 16384 ] || fail "WAL_MIN_FREE_KB must reserve at least one 16 MiB WAL segment"
[ "$archive_timeout" -le $((rpo_minutes * 60)) ] || \
  fail "archive timeout exceeds the declared PITR RPO"

backup_interval="$(read_setting BACKUP_INTERVAL_SECONDS "${BACKUP_INTERVAL_SECONDS:-}" 86400)"
backup_max_age="$(read_setting BACKUP_MAX_AGE_SECONDS "${BACKUP_MAX_AGE_SECONDS:-}" 93600)"
base_interval="$(read_setting BASE_BACKUP_INTERVAL_DAYS "${BASE_BACKUP_INTERVAL_DAYS:-}" 7)"
base_retention="$(read_setting BASE_BACKUP_RETENTION_DAYS "${BASE_BACKUP_RETENTION_DAYS:-}" 35)"
for pair in \
  "BACKUP_INTERVAL_SECONDS:$backup_interval" \
  "BACKUP_MAX_AGE_SECONDS:$backup_max_age" \
  "BASE_BACKUP_INTERVAL_DAYS:$base_interval" \
  "BASE_BACKUP_RETENTION_DAYS:$base_retention"; do
  require_uint "${pair%%:*}" "${pair#*:}"
done
[ "$backup_max_age" -gt "$backup_interval" ] || fail "backup health window must exceed its interval"
[ "$base_retention" -ge $((base_interval * 2)) ] || fail "base backup retention must cover two intervals"

printf 'Production recovery declaration is consistent (RPO=%sm, RTO=%sm).\n' "$rpo_minutes" "$rto_minutes"
