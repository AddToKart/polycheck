#!/usr/bin/env sh
set -eu
umask 077
: "${RESTIC_REPOSITORY:?A remote encrypted repository is required}"
case "$RESTIC_REPOSITORY" in
  s3:https://*|rest:https://*) ;;
  *) echo 'Offsite backups require an HTTPS S3 or REST repository in a separate failure domain' >&2; exit 1 ;;
esac
export RESTIC_PASSWORD_FILE=/run/secrets/restic_password
export RESTIC_CACHE_DIR=/tmp/restic-cache
interval="${OFFSITE_INTERVAL_SECONDS:-300}"
max_age="${OFFSITE_MAX_AGE_SECONDS:-900}"
case "$interval:$max_age" in *[!0-9:]*|:*|*:) exit 1 ;; esac
[ "$interval" -ge 60 ] && [ "$max_age" -gt "$interval" ]
backup() {
  [ -f /backups/latest-base.tar.gz ] && [ -f /backups/latest.dump ] || return 1
  # Only completed immutable files are included. Never snapshot live PGDATA.
  restic backup --host polycheck --tag database-recovery --exclude '*.partial*' --exclude '*.new.*' /backups /wal-archive || return 1
  date -u +%s > /state/last-success.new
  mv /state/last-success.new /state/last-success
}
case "${1:-schedule}" in
  init) exec restic init ;;
  once) backup ;;
  check) exec restic check --read-data ;;
  healthcheck)
    [ -f /state/last-success ]
    last="$(cat /state/last-success)"
    case "$last" in ''|*[!0-9]*) exit 1 ;; esac
    age=$(( $(date -u +%s) - last ))
    [ "$age" -ge 0 ] && [ "$age" -le "$max_age" ]
    ;;
  restore)
    [ "${RUN_OFFSITE_RESTORE:-0}" = 1 ] || { echo 'Set RUN_OFFSITE_RESTORE=1 for an isolated restore' >&2; exit 1; }
    case "${RESTIC_SNAPSHOT_ID:-}" in ''|*[!a-f0-9]*) echo 'Supply a full snapshot ID' >&2; exit 1 ;; esac
    [ "${#RESTIC_SNAPSHOT_ID}" = 64 ]
    [ -d /restore ] && [ -z "$(ls -A /restore)" ] || { echo '/restore must be an empty isolated mount' >&2; exit 1; }
    exec restic restore "$RESTIC_SNAPSHOT_ID" --verify --target /restore
    ;;
  schedule)
    while :; do
      if ! backup; then echo 'Offsite backup failed; previous freshness marker retained' >&2; fi
      sleep "$interval"
    done
    ;;
  *) echo 'Use init, once, schedule, healthcheck, check, or restore' >&2; exit 1 ;;
esac
