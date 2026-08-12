#!/usr/bin/env sh
set -eu

source_file="${1:?archive-wal requires PostgreSQL's source path}"
wal_name="${2:?archive-wal requires PostgreSQL's WAL filename}"
archive_dir="${WAL_ARCHIVE_DIR:-/wal-archive}"
# Minimum free space (KB) required in the archive destination before a copy is
# accepted. Prevents silent WAL loss from a full disk.
WAL_MIN_FREE_KB="${WAL_MIN_FREE_KB:-524288}"

fail() {
  printf 'archive-wal: %s\n' "$*" >&2
  exit 1
}

case "$WAL_MIN_FREE_KB" in
  ''|*[!0-9]*) fail "WAL_MIN_FREE_KB must be an unsigned integer" ;;
esac

is_segment_name() {
  # This deployment uses PostgreSQL's default 16 MiB WAL segment size. The
  # final field is therefore 00..FF (256 segments per 4 GiB XLogId), not an
  # arbitrary 32-bit value.
  printf '%s' "$1" | grep -Eq '^[0-9A-F]{16}000000[0-9A-F]{2}$' &&
    case "$1" in 00000000*) false ;; *) true ;; esac
}

is_backup_history_name() {
  # PostgreSQL backup history files are SEGMENT.OFFSET.backup. OFFSET is
  # bounded to the selected 16 MiB segment.
  printf '%s' "$1" | grep -Eq '^[0-9A-F]{16}000000[0-9A-F]{2}\.00[0-9A-F]{6}\.backup$' &&
    case "$1" in 00000000*) false ;; *) true ;; esac
}

is_timeline_history_name() {
  printf '%s' "$1" | grep -Eq '^[0-9A-F]{8}\.history$' &&
    [ "${1%.history}" != "00000000" ]
}

if ! is_segment_name "$wal_name" &&
  ! is_backup_history_name "$wal_name" &&
  ! is_timeline_history_name "$wal_name"; then
  fail "invalid PostgreSQL WAL, backup-history, or timeline-history filename"
fi
[ -f "$source_file" ] || fail "source WAL file is missing"
[ ! -L "$source_file" ] || fail "source WAL file must not be a symbolic link"
[ "${source_file##*/}" = "$wal_name" ] || fail "source basename does not match archive filename"
[ -d "$archive_dir" ] || fail "archive destination does not exist"
[ ! -L "$archive_dir" ] || fail "archive destination must not be a symbolic link"
archive_mode="$(stat -c %a "$archive_dir")"
[ "$archive_mode" = "700" ] || fail "archive destination must have mode 0700"
[ -w "$archive_dir" ] || fail "archive destination is not writable"

available_kb="$(df -P "$archive_dir" 2>/dev/null | awk 'NR == 2 { print $4 }')"
case "$available_kb" in
  ''|*[!0-9]*) fail "cannot determine free space in archive destination" ;;
esac
[ "$available_kb" -ge "$WAL_MIN_FREE_KB" ] || \
  fail "archive destination has only ${available_kb} KB free (minimum ${WAL_MIN_FREE_KB} KB); refusing to archive"

target="${archive_dir%/}/${wal_name}"
[ ! -L "$target" ] || fail "archive target must not be a symbolic link: $wal_name"
if [ -f "$target" ]; then
  cmp -s "$source_file" "$target" || fail "existing archive file differs: $wal_name"
  exit 0
fi

partial="${target}.partial.$$"
trap 'rm -f "$partial"' EXIT HUP INT TERM
cp "$source_file" "$partial"
chmod 600 "$partial"
cmp -s "$source_file" "$partial" || fail "copied WAL verification failed: $wal_name"
sync
mv "$partial" "$target"
sync
trap - EXIT HUP INT TERM
