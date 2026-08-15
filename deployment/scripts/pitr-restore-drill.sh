#!/usr/bin/env sh
set -eu

: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${WAL_ARCHIVE_DIR:?WAL_ARCHIVE_DIR is required}"
: "${RESTORE_DATA_DIR:?RESTORE_DATA_DIR is required}"

fail() {
  printf 'pitr-restore-drill: %s\n' "$*" >&2
  exit 1
}

[ "${RUN_PITR_RESTORE_DRILL:-}" = "1" ] || fail "set RUN_PITR_RESTORE_DRILL=1"
[ -n "${PITR_RECOVERY_TARGET_NAME:-}" ] || fail "PITR_RECOVERY_TARGET_NAME is required"
[ -n "${PITR_VERIFY_SQL:-}" ] || fail "PITR_VERIFY_SQL is required"
printf '%s' "$PITR_RECOVERY_TARGET_NAME" | grep -Eq '^[A-Za-z0-9_-]{1,63}$' || \
  fail "PITR_RECOVERY_TARGET_NAME contains unsafe characters"

base_link="${BACKUP_DIR%/}/latest-base.tar.gz"
[ -f "$base_link" ] || fail "latest physical base backup is missing"
base_file="$(readlink -f "$base_link")"
case "$base_file" in "${BACKUP_DIR%/}"/*) ;; *) fail "base backup resolves outside BACKUP_DIR" ;; esac
checksum_link="${base_link}.sha256"
if [ -f "$checksum_link" ]; then
  checksum_file="$(readlink -f "$checksum_link")"
else
  checksum_file="${base_file}.sha256"
fi
case "$checksum_file" in "${BACKUP_DIR%/}"/*) ;; *) fail "checksum resolves outside BACKUP_DIR" ;; esac
[ -f "$checksum_file" ] || fail "base-backup checksum is missing"
(
  cd "$BACKUP_DIR" || exit 1
  sha256sum -c "$(basename "$checksum_file")" >/dev/null
)

case "$RESTORE_DATA_DIR" in /*) ;; *) fail "RESTORE_DATA_DIR must be absolute" ;; esac
[ "$RESTORE_DATA_DIR" != "/" ] || fail "RESTORE_DATA_DIR must not be root"
mkdir -p "$RESTORE_DATA_DIR"
if [ "$(id -u)" -eq 0 ]; then
  [ "${PITR_RESTORE_AS_POSTGRES:-0}" != "1" ] || fail "failed to drop root privileges"
  chown 70:70 "$RESTORE_DATA_DIR"
  PITR_RESTORE_AS_POSTGRES=1 exec gosu postgres "$0" "$@"
fi
find "$RESTORE_DATA_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
tar -xzf "$base_file" -C "$RESTORE_DATA_DIR"
chmod 700 "$RESTORE_DATA_DIR"
pg_verifybackup "$RESTORE_DATA_DIR"

postgresql_conf="$RESTORE_DATA_DIR/postgresql.conf"
[ -f "$postgresql_conf" ] || fail "restored base has no postgresql.conf"
touch "$RESTORE_DATA_DIR/postgresql.auto.conf"
cat >> "$RESTORE_DATA_DIR/postgresql.auto.conf" <<EOF
restore_command = 'test -f ${WAL_ARCHIVE_DIR%/}/%f && cp ${WAL_ARCHIVE_DIR%/}/%f %p'
recovery_target_name = '$PITR_RECOVERY_TARGET_NAME'
recovery_target_inclusive = on
recovery_target_action = 'promote'
EOF
touch "$RESTORE_DATA_DIR/recovery.signal"
printf 'local all all trust\n' > "$RESTORE_DATA_DIR/pg_hba.restore.conf"

started=0
cleanup() {
  original_status="$?"
  trap - EXIT HUP INT TERM
  if [ "$started" -eq 1 ] && ! pg_ctl -D "$RESTORE_DATA_DIR" -m fast -w stop; then
    printf 'pitr-restore-drill: cleanup FAILED while stopping restored PostgreSQL\n' >&2
    [ "$original_status" -ne 0 ] || original_status=1
  fi
  exit "$original_status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

pg_ctl -D "$RESTORE_DATA_DIR" -w start -o \
  "-c listen_addresses='' -c unix_socket_directories='/tmp' -c port=55432 -c hba_file='$RESTORE_DATA_DIR/pg_hba.restore.conf' -c archive_mode=always -c archive_command='/bin/true'"
started=1
in_recovery="$(psql -h /tmp -p 55432 -U polycheck -d polycheck -v ON_ERROR_STOP=1 -Atqc 'SELECT pg_is_in_recovery()')"
[ "$in_recovery" = "f" ] || fail "restored cluster did not promote at the requested recovery target"
psql -h /tmp -p 55432 -U polycheck -d polycheck -v ON_ERROR_STOP=1 -Atqc "$PITR_VERIFY_SQL" | grep -qx 1 || \
  fail "restored cluster did not contain the expected post-base-backup marker"

printf 'Physical PITR restore reached marker %s and passed verification.\n' "$PITR_RECOVERY_TARGET_NAME"
