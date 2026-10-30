#!/usr/bin/env sh
set -eu
# Run only in a disposable, network-disabled container with no data mounts.
[ "${OFFSITE_TEST_CONTAINER:-}" = 1 ] || { echo 'Use the CI disposable container command' >&2; exit 1; }
for directory in /backups /wal-archive /state /restore; do
  [ ! -e "$directory" ] || { echo 'Test data directories must not already exist' >&2; exit 1; }
done
mkdir /backups /wal-archive /state /restore
temporary="$(mktemp -d)"
mkdir "$temporary/bin"
cat > "$temporary/bin/restic" <<'STUB'
#!/usr/bin/env sh
if [ "${RESTIC_TEST_FAIL:-0}" = 1 ]; then exit 3; fi
printf '%s\n' "$*" >> /state/restic-commands
STUB
chmod +x "$temporary/bin/restic"
export PATH="$temporary/bin:$PATH"
export RESTIC_REPOSITORY=s3:https://offsite.example.test/repository
script="$(dirname "$0")/offsite-backup.sh"
sh "$script" init
if RESTIC_REPOSITORY=/local-only sh "$script" init; then exit 1; fi
if sh "$script" once; then echo 'Missing base backup accepted' >&2; exit 1; fi
touch /backups/latest-base.tar.gz /backups/latest.dump
sh "$script" once
sh "$script" healthcheck
printf '1\n' > /state/last-success
if RESTIC_TEST_FAIL=1 sh "$script" once; then echo 'Failed transfer accepted' >&2; exit 1; fi
[ "$(cat /state/last-success)" = 1 ]
if sh "$script" healthcheck; then echo 'Stale transfer accepted' >&2; exit 1; fi
if sh "$script" restore; then echo 'Unguarded restore accepted' >&2; exit 1; fi
export RUN_OFFSITE_RESTORE=1
export RESTIC_SNAPSHOT_ID=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
sh "$script" restore
grep -q 'restore .* --verify --target /restore' /state/restic-commands
touch /restore/existing-data
if sh "$script" restore; then echo 'Nonempty restore target accepted' >&2; exit 1; fi
echo 'Offsite transfer/restore control tests passed.'
