#!/usr/bin/env sh
set -eu

mode="${1:-once}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${POSTGRES_PASSWORD_FILE:?POSTGRES_PASSWORD_FILE is required}"

fail() {
  printf 'backup-postgres: %s\n' "$*" >&2
  exit 1
}

require_uint() {
  name="$1"
  value="$2"
  case "$value" in
    ''|*[!0-9]*) fail "$name must be an unsigned integer" ;;
  esac
}

check_destination() {
  [ "${BACKUP_DIR#/}" != "$BACKUP_DIR" ] || fail "BACKUP_DIR must be absolute"
  [ -d "$BACKUP_DIR" ] || fail "BACKUP_DIR must already exist"
  [ ! -L "$BACKUP_DIR" ] || fail "BACKUP_DIR must not be a symbolic link"
  [ "$(stat -c %a "$BACKUP_DIR")" = "700" ] || fail "BACKUP_DIR must have mode 0700"
  [ -w "$BACKUP_DIR" ] || fail "BACKUP_DIR is not writable by the backup user"
}

load_password() {
  [ -r "$POSTGRES_PASSWORD_FILE" ] || fail "PostgreSQL password secret is not readable"
  IFS= read -r PGPASSWORD < "$POSTGRES_PASSWORD_FILE" || true
  [ -n "${PGPASSWORD:-}" ] || fail "PostgreSQL password secret is empty"
  export PGPASSWORD
}

atomic_symlink() {
  link_name="$1"
  target_name="$2"
  temporary="${link_name}.new.$$"
  rm -f "$temporary"
  ln -s "$target_name" "$temporary"
  mv -f "$temporary" "$link_name"
}

write_status() {
  status_name="$1"
  status_value="$2"
  temporary="${BACKUP_DIR%/}/.${status_name}.new.$$"
  printf '%s\n' "$status_value" > "$temporary"
  chmod 600 "$temporary"
  mv -f "$temporary" "${BACKUP_DIR%/}/.${status_name}"
}

make_logical_backup() {
  timestamp="$1"
  target="${BACKUP_DIR%/}/polycheck-${timestamp}.dump"
  partial="${target}.partial.$$"
  checksum="${target}.sha256"

  trap 'rm -f "$partial"' EXIT HUP INT TERM
  pg_dump --format=custom --no-owner --no-acl --file="$partial"
  pg_restore --list "$partial" >/dev/null
  chmod 600 "$partial"
  mv "$partial" "$target"
  (
    cd "$BACKUP_DIR" || exit 1
    sha256sum "$(basename "$target")" > "$(basename "$checksum")"
    sha256sum -c "$(basename "$checksum")" >/dev/null
  )
  chmod 600 "$checksum"
  atomic_symlink "${BACKUP_DIR%/}/latest.dump" "$(basename "$target")"
  atomic_symlink "${BACKUP_DIR%/}/latest.dump.sha256" "$(basename "$checksum")"
  trap - EXIT HUP INT TERM
  printf 'Verified logical backup: %s\n' "$target"
}

base_backup_due() {
  marker="${BACKUP_DIR%/}/.last-base-success"
  [ -f "$marker" ] || return 0
  last_epoch="$(cat "$marker")"
  require_uint LAST_BASE_SUCCESS "$last_epoch"
  now_epoch="$(date -u +%s)"
  [ $((now_epoch - last_epoch)) -ge $((BASE_BACKUP_INTERVAL_DAYS * 86400)) ]
}

make_physical_base_backup() {
  timestamp="$1"
  work_dir="${BACKUP_DIR%/}/.base-${timestamp}.partial.$$"
  target="${BACKUP_DIR%/}/base-${timestamp}.tar.gz"
  partial="${target}.partial.$$"
  checksum="${target}.sha256"

  trap 'rm -rf "$work_dir"; rm -f "$partial"' EXIT HUP INT TERM
  mkdir "$work_dir"
  chmod 700 "$work_dir"
  pg_basebackup \
    --pgdata="$work_dir" \
    --format=plain \
    --wal-method=stream \
    --checkpoint=fast \
    --manifest-checksums=SHA256 \
    --no-password
  pg_verifybackup "$work_dir"
  tar -czf "$partial" -C "$work_dir" .
  tar -tzf "$partial" >/dev/null
  chmod 600 "$partial"
  mv "$partial" "$target"
  (
    cd "$BACKUP_DIR" || exit 1
    sha256sum "$(basename "$target")" > "$(basename "$checksum")"
    sha256sum -c "$(basename "$checksum")" >/dev/null
  )
  chmod 600 "$checksum"
  rm -rf "$work_dir"
  atomic_symlink "${BACKUP_DIR%/}/latest-base.tar.gz" "$(basename "$target")"
  atomic_symlink "${BACKUP_DIR%/}/latest-base.tar.gz.sha256" "$(basename "$checksum")"
  write_status last-base-success "$(date -u +%s)"
  trap - EXIT HUP INT TERM
  printf 'Verified physical base backup: %s\n' "$target"
}

apply_retention() {
  # Never prune the base backup that latest-base.tar.gz still points at: a
  # failing-base streak must not silently orphan the last recoverable PITR base.
  protected_base=''
  if [ -f "${BACKUP_DIR%/}/latest-base.tar.gz" ]; then
    resolved="$(readlink -f "${BACKUP_DIR%/}/latest-base.tar.gz" 2>/dev/null || true)"
    if [ -n "$resolved" ]; then
      case "$resolved" in
        "${BACKUP_DIR%/}"/*) protected_base="$(basename "$resolved")" ;;
      esac
    fi
  fi
  if [ -n "$protected_base" ]; then
    find "$BACKUP_DIR" -maxdepth 1 -type f \
      \( -name 'base-*.tar.gz' -o -name 'base-*.tar.gz.sha256' \) \
      -mtime "+${BASE_BACKUP_RETENTION_DAYS}" ! -name "$protected_base" \
      ! -name "${protected_base}.sha256" -delete
  else
    find "$BACKUP_DIR" -maxdepth 1 -type f \
      \( -name 'base-*.tar.gz' -o -name 'base-*.tar.gz.sha256' \) \
      -mtime "+${BASE_BACKUP_RETENTION_DAYS}" -delete
  fi
  find "$BACKUP_DIR" -maxdepth 1 -type f \
    \( -name 'polycheck-*.dump' -o -name 'polycheck-*.dump.sha256' \) \
    -mtime "+${BACKUP_RETENTION_DAYS}" -delete
}

first_required_wal_segment() {
  # Returns the first archived WAL segment required by the oldest retained base
  # backup (from its backup_label), or empty when it cannot be determined.
  oldest_base=''
  for candidate in "$BACKUP_DIR"/base-*.tar.gz; do
    [ -f "$candidate" ] || continue
    if [ -z "$oldest_base" ] || [ "$candidate" -ot "$oldest_base" ]; then
      oldest_base="$candidate"
    fi
  done
  [ -n "$oldest_base" ] || return 1

  work_dir="${BACKUP_DIR%/}/.wal-label.$$"
  mkdir "$work_dir"
  chmod 700 "$work_dir"
  trap 'rm -rf "$work_dir"' EXIT HUP INT TERM
  tar -xzf "$oldest_base" -C "$work_dir" backup_label 2>/dev/null || { rm -rf "$work_dir"; trap - EXIT HUP INT TERM; return 1; }
  segment="$(sed -n 's/.*(file \([A-Fa-f0-9]\{24\}\))/\1/p' "$work_dir/backup_label" | tail -n 1)"
  rm -rf "$work_dir"
  trap - EXIT HUP INT TERM
  [ -n "$segment" ] || return 1
  printf '%s\n' "$segment"
}

prune_wal_archive() {
  # Delete archived WAL segments that are older than the oldest retained base
  # backup's start point. Every retained base keeps an unbroken WAL chain, so
  # this can never break PITR for a retained recovery target. Timeline history
  # files (.history) and partial/checksum files are never touched.
  [ -n "${WAL_ARCHIVE_DIR:-}" ] || { printf 'backup-postgres: WAL_ARCHIVE_DIR not set; skipping WAL pruning\n' >&2; return 0; }
  [ -d "$WAL_ARCHIVE_DIR" ] || { printf 'backup-postgres: WAL_ARCHIVE_DIR missing; skipping WAL pruning\n' >&2; return 0; }

  first_required=''
  if ! first_required="$(first_required_wal_segment)"; then
    printf 'backup-postgres: cannot determine oldest required WAL segment; skipping WAL pruning\n' >&2
    return 0
  fi

  pruned=0
  for candidate in "$WAL_ARCHIVE_DIR"/*; do
    [ -f "$candidate" ] || continue
    name="$(basename "$candidate")"
    case "$name" in
      *.partial*|*.sha256|*.backup|*.history) continue ;;
    esac
    printf '%s' "$name" | grep -Eq '^[A-Fa-f0-9]{24}$' || continue
    # PostgreSQL emits fixed-width uppercase hex names, so bytewise lexical
    # comparison follows timeline/log/segment ordering on one retained chain.
    if [ "$name" \< "$first_required" ]; then
      rm -f "$candidate"
      pruned=$((pruned + 1))
    fi
  done
  printf 'Pruned %s archived WAL segments older than %s\n' "$pruned" "$first_required"
}

run_backup() {
  check_destination
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  make_logical_backup "$timestamp"
  if base_backup_due; then
    make_physical_base_backup "$timestamp"
  fi
  apply_retention
  prune_wal_archive
  write_status last-success "$(date -u +%s)"
  write_status last-success-utc "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}

run_backup_exclusively() {
  # The lock session authenticates too, so load the file-backed secret before
  # starting any psql process rather than waiting until the backup begins.
  load_password

  # Hold a PostgreSQL session-level advisory lock for the entire run. It works
  # across independently started Compose containers and is released by the
  # server if either this container or its psql process dies (no stale lock).
  # A one-week sleep is only a guardrail; the session is explicitly terminated
  # after the run, and a backup exceeding it fails rather than running unlocked.
  lock_name="polycheck-backup-$(date -u +%s)-$$"
  lock_sql='SELECT pg_advisory_lock(1347374160, 1111575637); SELECT pg_sleep(604800);'
  PGAPPNAME="$lock_name" psql --no-password --quiet --command "$lock_sql" >/dev/null 2>&1 &
  backup_lock_pid="$!"
  release_backup_lock() {
    [ -n "${backup_lock_pid:-}" ] || return 0
    kill "$backup_lock_pid" >/dev/null 2>&1 || true
    wait "$backup_lock_pid" >/dev/null 2>&1 || true
    backup_lock_pid=''
  }
  cleanup_backup_lock() {
    status="$?"
    trap - EXIT HUP INT TERM
    release_backup_lock
    exit "$status"
  }
  trap cleanup_backup_lock EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  lock_state=''
  attempts=0
  while [ "$attempts" -lt 50 ]; do
    lock_session_count="$(psql --no-password --tuples-only --no-align --command \
      "SELECT count(*) FROM pg_stat_activity WHERE application_name = '$lock_name';")"
    lock_state="$(psql --no-password --tuples-only --no-align --command \
      "SELECT COALESCE(bool_or(l.granted), false) FROM pg_stat_activity a JOIN pg_locks l ON l.pid = a.pid AND l.locktype = 'advisory' WHERE a.application_name = '$lock_name';")"
    case "$lock_state" in
      t) break ;;
      f) if [ "$lock_session_count" = "0" ]; then :; else
        # The session is visible but waiting behind another backup.
        fail "another backup or retention run already holds the database backup lock"
        fi ;;
    esac
    kill -0 "$backup_lock_pid" >/dev/null 2>&1 || fail "backup lock session exited unexpectedly"
    attempts=$((attempts + 1))
    sleep 0.1
  done
  [ "$lock_state" = "t" ] || fail "timed out acquiring the database backup lock"

  # Backup helpers use temporary-file traps of their own. Isolate those in a
  # subshell so they cannot replace the parent's advisory-lock cleanup trap.
  (run_backup)
  kill -0 "$backup_lock_pid" >/dev/null 2>&1 || fail "database backup lock was lost during the run"
  release_backup_lock
  trap - EXIT HUP INT TERM
}

healthcheck() {
  check_destination
  marker="${BACKUP_DIR%/}/.last-success"
  [ -r "$marker" ] || fail "no successful backup marker exists"
  last_epoch="$(cat "$marker")"
  require_uint LAST_SUCCESS "$last_epoch"
  now_epoch="$(date -u +%s)"
  age=$((now_epoch - last_epoch))
  [ "$age" -ge 0 ] || fail "last-success marker is in the future"
  [ "$age" -le "$BACKUP_MAX_AGE_SECONDS" ] || fail "last successful backup is ${age}s old"
}

BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BASE_BACKUP_INTERVAL_DAYS="${BASE_BACKUP_INTERVAL_DAYS:-7}"
BASE_BACKUP_RETENTION_DAYS="${BASE_BACKUP_RETENTION_DAYS:-35}"
BACKUP_MAX_AGE_SECONDS="${BACKUP_MAX_AGE_SECONDS:-93600}"

for pair in \
  "BACKUP_INTERVAL_SECONDS:$BACKUP_INTERVAL_SECONDS" \
  "BACKUP_RETENTION_DAYS:$BACKUP_RETENTION_DAYS" \
  "BASE_BACKUP_INTERVAL_DAYS:$BASE_BACKUP_INTERVAL_DAYS" \
  "BASE_BACKUP_RETENTION_DAYS:$BASE_BACKUP_RETENTION_DAYS" \
  "BACKUP_MAX_AGE_SECONDS:$BACKUP_MAX_AGE_SECONDS"; do
  require_uint "${pair%%:*}" "${pair#*:}"
done
[ "$BACKUP_INTERVAL_SECONDS" -ge 3600 ] || fail "BACKUP_INTERVAL_SECONDS must be at least 3600"
[ "$BACKUP_RETENTION_DAYS" -ge 1 ] || fail "BACKUP_RETENTION_DAYS must be at least 1"
[ "$BASE_BACKUP_INTERVAL_DAYS" -ge 1 ] || fail "BASE_BACKUP_INTERVAL_DAYS must be at least 1"
[ "$BASE_BACKUP_RETENTION_DAYS" -ge $((BASE_BACKUP_INTERVAL_DAYS * 2)) ] || \
  fail "BASE_BACKUP_RETENTION_DAYS must cover at least two base-backup intervals"
[ "$BACKUP_MAX_AGE_SECONDS" -gt "$BACKUP_INTERVAL_SECONDS" ] || \
  fail "BACKUP_MAX_AGE_SECONDS must exceed BACKUP_INTERVAL_SECONDS"

case "$mode" in
  once)
    run_backup_exclusively
    ;;
  schedule)
    while :; do
      run_backup_exclusively
      sleep "$BACKUP_INTERVAL_SECONDS" &
      wait "$!"
    done
    ;;
  healthcheck)
    healthcheck
    ;;
  *)
    fail "unknown mode '$mode' (expected once, schedule, or healthcheck)"
    ;;
esac
