#!/usr/bin/env sh
set -eu

script_dir="$(CDPATH='' cd "$(dirname "$0")" && pwd)"
node_script_dir="$script_dir"
if command -v cygpath >/dev/null 2>&1; then
  node_script_dir="$(cygpath -w "$script_dir")"
fi
verify_wal_chain() {
  if command -v cygpath >/dev/null 2>&1; then
    node "$node_script_dir/verify-wal-chain.mjs" "$(cygpath -w "$1")" "$(cygpath -w "$2")"
  else
    node "$node_script_dir/verify-wal-chain.mjs" "$1" "$2"
  fi
}
temporary="$(mktemp -d)"
cleanup() {
  rm -rf "$temporary"
}
trap cleanup EXIT HUP INT TERM

digest='sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
BACKEND_IMAGE="ghcr.io/example/polycheck/backend@${digest}" \
FRONTEND_IMAGE="ghcr.io/example/polycheck/frontend@${digest}" \
  sh "$script_dir/validate-production-images.sh" >/dev/null

for bad_ref in \
  'polycheck-backend:local' \
  'ghcr.io/example/polycheck/backend:latest' \
  'ghcr.io/example/polycheck/backend:v1.2.3' \
  'ghcr.io/example/polycheck/backend:sha-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' \
  'ghcr.io/example/polycheck/backend:sha-short'; do
  if BACKEND_IMAGE="$bad_ref" FRONTEND_IMAGE="ghcr.io/example/frontend@${digest}" \
    sh "$script_dir/validate-production-images.sh" >/dev/null 2>&1; then
    printf 'mutable image reference unexpectedly passed: %s\n' "$bad_ref" >&2
    exit 1
  fi
done

POSTGRES_BACKUP_PATH=/srv/polycheck/backups \
POSTGRES_WAL_ARCHIVE_PATH=/srv/polycheck/wal \
PITR_RPO_MINUTES=5 PITR_RTO_MINUTES=240 POSTGRES_ARCHIVE_TIMEOUT_SECONDS=300 WAL_MIN_FREE_KB=524288 \
  sh "$script_dir/validate-production-recovery.sh" >/dev/null
if POSTGRES_BACKUP_PATH=/srv/polycheck/data \
  POSTGRES_WAL_ARCHIVE_PATH=/srv/polycheck/data \
  PITR_RPO_MINUTES=5 PITR_RTO_MINUTES=240 \
  sh "$script_dir/validate-production-recovery.sh" >/dev/null 2>&1; then
  printf 'shared backup/WAL path unexpectedly passed validation\n' >&2
  exit 1
fi

mkdir "$temporary/wal"
chmod 700 "$temporary/wal"
archive_test_dir="$temporary/wal"
printf 'wal-test-payload\n' > "$temporary/source-wal"
mv "$temporary/source-wal" "$temporary/000000010000000000000001"
source_wal="$temporary/000000010000000000000001"
if [ "$(stat -c %a "$archive_test_dir")" = "700" ]; then
  WAL_ARCHIVE_DIR="$archive_test_dir" \
    sh "$script_dir/archive-wal.sh" "$source_wal" 000000010000000000000001
  cmp "$source_wal" "$archive_test_dir/000000010000000000000001"
  for accepted in \
    000000010000000000000001.00000028.backup \
    00000002.history; do
    cp "$source_wal" "$temporary/$accepted"
    WAL_ARCHIVE_DIR="$archive_test_dir" sh "$script_dir/archive-wal.sh" "$temporary/$accepted" "$accepted"
  done
  for rejected in \
    ../000000010000000000000002 \
    000000010000000000000100 \
    000000010000000000000001.partial \
    00000001.HISTORY \
    000000010000000000000001.01000000.backup; do
    if WAL_ARCHIVE_DIR="$archive_test_dir" sh "$script_dir/archive-wal.sh" "$source_wal" "$rejected" >/dev/null 2>&1; then
      printf 'unsafe WAL filename unexpectedly passed: %s\n' "$rejected" >&2
      exit 1
    fi
  done
  rm -f "$archive_test_dir/00000002.history" \
    "$archive_test_dir/000000010000000000000001.00000028.backup"
else
  # Windows Git Bash cannot represent POSIX mode 0700. Linux CI runs all
  # archive tests; create only the fixtures needed by platform-neutral tests.
  cp "$source_wal" "$archive_test_dir/000000010000000000000001"
fi

mkdir "$temporary/base-content" "$temporary/backups"
chmod 700 "$temporary/backups"
printf 'START WAL LOCATION: 0/1000028 (file 000000010000000000000001)\n' > "$temporary/base-content/backup_label"
printf '{}\n' > "$temporary/base-content/backup_manifest"
tar -czf "$temporary/backups/base-test.tar.gz" -C "$temporary/base-content" .
(
  cd "$temporary/backups" || exit 1
  sha256sum base-test.tar.gz > base-test.tar.gz.sha256
  ln -s base-test.tar.gz latest-base.tar.gz
  ln -s base-test.tar.gz.sha256 latest-base.tar.gz.sha256
)
cp "$source_wal" "$archive_test_dir/000000010000000000000002"
if ! command -v cygpath >/dev/null 2>&1; then
  BACKUP_DIR="$temporary/backups" WAL_ARCHIVE_DIR="$archive_test_dir" PITR_MAX_WAL_AGE_SECONDS=60 \
  WAL_CHAIN_VERIFIER="$node_script_dir/verify-wal-chain.mjs" \
    sh "$script_dir/verify-pitr-assets.sh" >/dev/null
fi

printf '%s\n' "$(date -u +%s)" > "$temporary/backups/.last-success"
printf 'test-only-password\n' > "$temporary/postgres-password"
BACKUP_DIR="$temporary/backups" POSTGRES_PASSWORD_FILE="$temporary/postgres-password" \
BACKUP_INTERVAL_SECONDS=3600 BACKUP_MAX_AGE_SECONDS=7200 \
  sh "$script_dir/backup-postgres.sh" healthcheck >/dev/null 2>&1 || {
    command -v cygpath >/dev/null 2>&1 || exit 1
  }

# Exercise the scheduled backup control flow with command-level fakes. The
# holder refuses to start unless the file-backed password was loaded first,
# and two zero-delay schedule iterations prove normal lock release returns to
# the scheduler instead of exiting the process.
if ! command -v cygpath >/dev/null 2>&1; then
  mkdir "$temporary/backup-lock-bin" "$temporary/backup-lock-output"
  chmod 700 "$temporary/backup-lock-output"
  printf '%s\n' "$(date -u +%s)" > "$temporary/backup-lock-output/.last-base-success"
  cat > "$temporary/backup-lock-bin/psql" <<'EOF'
#!/usr/bin/env sh
set -eu
[ "${PGPASSWORD:-}" = 'test-only-password' ] || exit 91
case "$*" in
  *pg_advisory_lock*)
    printf 'authenticated\n' >> "$MOCK_STATE/lock-auth"
    exec /bin/sleep 604800
    ;;
  *"count(*) FROM pg_stat_activity"*) printf '1\n' ;;
  *"COALESCE(bool_or"*) printf 't\n' ;;
esac
EOF
  cat > "$temporary/backup-lock-bin/pg_dump" <<'EOF'
#!/usr/bin/env sh
set -eu
[ "${PGPASSWORD:-}" = 'test-only-password' ] || exit 92
target=''
for argument in "$@"; do
  case "$argument" in --file=*) target="${argument#--file=}" ;; esac
done
[ -n "$target" ]
printf 'mock dump\n' > "$target"
count=0
[ ! -f "$MOCK_STATE/dump-count" ] || count="$(cat "$MOCK_STATE/dump-count")"
printf '%s\n' $((count + 1)) > "$MOCK_STATE/dump-count"
EOF
  cat > "$temporary/backup-lock-bin/pg_restore" <<'EOF'
#!/usr/bin/env sh
set -eu
[ "$1" = '--list' ]
[ -s "$2" ]
EOF
  cat > "$temporary/backup-lock-bin/sleep" <<'EOF'
#!/usr/bin/env sh
set -eu
if [ "${1:-}" = '3600' ]; then
  count=0
  [ ! -f "$MOCK_STATE/sleep-count" ] || count="$(cat "$MOCK_STATE/sleep-count")"
  count=$((count + 1))
  printf '%s\n' "$count" > "$MOCK_STATE/sleep-count"
  [ "$count" -lt 2 ] || exit 42
  exit 0
fi
exec /bin/sleep "$@"
EOF
  chmod 700 "$temporary/backup-lock-bin/psql" \
    "$temporary/backup-lock-bin/pg_dump" \
    "$temporary/backup-lock-bin/pg_restore" \
    "$temporary/backup-lock-bin/sleep"

  set +e
  PATH="$temporary/backup-lock-bin:$PATH" \
    MOCK_STATE="$temporary/backup-lock-output" \
    BACKUP_DIR="$temporary/backup-lock-output" \
    POSTGRES_PASSWORD_FILE="$temporary/postgres-password" \
    BACKUP_INTERVAL_SECONDS=3600 BACKUP_MAX_AGE_SECONDS=7200 \
    sh "$script_dir/backup-postgres.sh" schedule >/dev/null 2>&1
  schedule_status="$?"
  set -e
  if [ "$schedule_status" -ne 42 ]; then
    printf 'scheduled backup returned %s instead of sleep status 42\n' "$schedule_status" >&2
    exit 1
  fi
  [ "$(cat "$temporary/backup-lock-output/dump-count")" = '2' ]
  [ "$(cat "$temporary/backup-lock-output/sleep-count")" = '2' ]
  [ "$(wc -l < "$temporary/backup-lock-output/lock-auth" | tr -d ' ')" = '2' ]
fi

# restore-drill must refuse to run without explicit operator confirmation.
if POSTGRES_PASSWORD_FILE="$temporary/postgres-password" \
  sh "$script_dir/restore-drill.sh" /backups/latest.dump >/dev/null 2>&1; then
  printf 'restore-drill without RUN_RESTORE_DRILL unexpectedly passed\n' >&2
  exit 1
fi

# verify-wal-chain: contiguous chains pass, gaps fail (only when node exists).
if command -v node >/dev/null 2>&1; then
  mkdir -p "$temporary/wal-chain"
  : > "$temporary/wal-chain/000000010000000000000001"
  : > "$temporary/wal-chain/000000010000000000000002"
  : > "$temporary/wal-chain/000000010000000000000003"
  printf 'START WAL LOCATION: 0/2000028 (file 000000010000000000000001)\n' > "$temporary/backup_label"
  verify_wal_chain "$temporary/backup_label" "$temporary/wal-chain" >/dev/null
  rm "$temporary/wal-chain/000000010000000000000002"
  if verify_wal_chain "$temporary/backup_label" "$temporary/wal-chain" >/dev/null 2>&1; then
    printf 'verify-wal-chain did not detect a missing segment\n' >&2
    exit 1
  fi

  # Real 16 MiB arithmetic wraps segment FF into the next XLogId; 00000100 is
  # not a valid default-size segment filename.
  rm -rf "$temporary/wal-chain"
  mkdir "$temporary/wal-chain"
  : > "$temporary/wal-chain/0000000100000000000000FF"
  : > "$temporary/wal-chain/000000010000000100000000"
  printf 'START WAL LOCATION: 0/FF000028 (file 0000000100000000000000FF)\n' > "$temporary/backup_label"
  verify_wal_chain "$temporary/backup_label" "$temporary/wal-chain" >/dev/null

  # A timeline switch at 1/0 requires the parent FF segment and starts timeline
  # 2 at 0000000100000000. Backup/history metadata is recognized but
  # is not mistaken for a completed segment.
  rm -rf "$temporary/wal-chain"
  mkdir "$temporary/wal-chain"
  : > "$temporary/wal-chain/0000000100000000000000FF"
  : > "$temporary/wal-chain/000000020000000100000000"
  printf '1 1/0 promotion\n' > "$temporary/wal-chain/00000002.history"
  : > "$temporary/wal-chain/0000000100000000000000FF.00000028.backup"
  verify_wal_chain "$temporary/backup_label" "$temporary/wal-chain" >/dev/null
  rm "$temporary/wal-chain/0000000100000000000000FF"
  if verify_wal_chain "$temporary/backup_label" "$temporary/wal-chain" >/dev/null 2>&1; then
    printf 'verify-wal-chain missed a pre-transition WAL gap\n' >&2
    exit 1
  fi
fi

printf 'Deployment script tests passed.\n'
