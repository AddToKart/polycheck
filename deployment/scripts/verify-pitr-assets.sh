#!/usr/bin/env sh
set -eu

: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${WAL_ARCHIVE_DIR:?WAL_ARCHIVE_DIR is required}"
PITR_MAX_WAL_AGE_SECONDS="${PITR_MAX_WAL_AGE_SECONDS:-900}"
PITR_MAX_CHAIN_SEGMENTS="${PITR_MAX_CHAIN_SEGMENTS:-1000000}"
WAL_CHAIN_VERIFIER="${WAL_CHAIN_VERIFIER:-/usr/local/bin/verify-wal-chain.mjs}"

fail() {
  printf 'verify-pitr-assets: %s\n' "$*" >&2
  exit 1
}

case "$PITR_MAX_WAL_AGE_SECONDS" in
  ''|*[!0-9]*) fail "PITR_MAX_WAL_AGE_SECONDS must be an unsigned integer" ;;
esac

base_link="${BACKUP_DIR%/}/latest-base.tar.gz"
[ -f "$base_link" ] || fail "latest physical base backup is missing"
base_file="$(readlink -f "$base_link")"
case "$base_file" in
  "${BACKUP_DIR%/}"/*) ;;
  *) fail "base backup resolves outside BACKUP_DIR" ;;
esac
checksum_link="${base_link}.sha256"
if [ -f "$checksum_link" ]; then
  checksum_file="$(readlink -f "$checksum_link")"
else
  checksum_file="${base_file}.sha256"
fi
case "$checksum_file" in
  "${BACKUP_DIR%/}"/*) ;;
  *) fail "base-backup checksum resolves outside BACKUP_DIR" ;;
esac
[ -f "$checksum_file" ] || fail "base-backup checksum is missing"
(
  cd "$BACKUP_DIR" || exit 1
  sha256sum -c "$(basename "$checksum_file")" >/dev/null
)
contents="$(tar -tzf "$base_file")"
printf '%s\n' "$contents" | grep -Eq '(^|/)backup_label$' || fail "base backup has no backup_label"
printf '%s\n' "$contents" | grep -Eq '(^|/)backup_manifest$' || fail "base backup has no backup_manifest"

label_file="/tmp/backup-label.$$"
cleanup() {
  rm -f "$label_file"
}
trap cleanup EXIT HUP INT TERM
if ! tar -xOzf "$base_file" ./backup_label > "$label_file" 2>/dev/null; then
  tar -xOzf "$base_file" backup_label > "$label_file" 2>/dev/null || fail "cannot extract backup_label"
fi
PITR_MAX_CHAIN_SEGMENTS="$PITR_MAX_CHAIN_SEGMENTS" \
  node "$WAL_CHAIN_VERIFIER" "$label_file" "$WAL_ARCHIVE_DIR"

newest_wal=''
for candidate in "$WAL_ARCHIVE_DIR"/*; do
  [ -f "$candidate" ] || continue
  name="$(basename "$candidate")"
  case "$name" in
    *.partial*|*.sha256|*.backup|*.history) continue ;;
  esac
  printf '%s' "$name" | grep -Eq '^[0-9A-F]{16}000000[0-9A-F]{2}$' || continue
  if [ -z "$newest_wal" ] || [ "$candidate" -nt "$newest_wal" ]; then
    newest_wal="$candidate"
  fi
done
[ -n "$newest_wal" ] || fail "no completed WAL segment exists in the archive"

now_epoch="$(date -u +%s)"
wal_epoch="$(stat -c %Y "$newest_wal")"
wal_age=$((now_epoch - wal_epoch))
[ "$wal_age" -ge 0 ] || fail "newest WAL segment timestamp is in the future"
[ "$wal_age" -le "$PITR_MAX_WAL_AGE_SECONDS" ] || \
  fail "newest WAL segment is ${wal_age}s old (maximum ${PITR_MAX_WAL_AGE_SECONDS}s)"

printf 'PITR assets verified: base=%s newest_wal=%s age=%ss\n' "$base_file" "$newest_wal" "$wal_age"
