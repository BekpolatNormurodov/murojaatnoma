#!/usr/bin/env bash
set -uo pipefail

# Postgres backup for the Murojaatnoma stack. Dumps the DB (custom format) from
# the running postgres container, keeps 14 days locally, and (optionally) can be
# copied off-server for real durability.
#
# Usage:      bash infra/scripts/backup-db.sh
# Cron (2am): 0 2 * * *  /home/book/murojaatnoma/infra/scripts/backup-db.sh >> /var/log/murojaatnoma-backup.log 2>&1
# Restore:    docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean < file.dump
#
# Optional, both no-ops unless their env var is set (default behavior unchanged):
#   BACKUP_SCP_DEST=user@host:/path/   scp the fresh dump off-server after the
#                                      local dump succeeds. Uses whatever ssh/scp
#                                      auth is already set up for that user (keys
#                                      on the host) — this script never handles
#                                      passwords.
#   VERIFY_RESTORE=1                  restore the fresh dump into a scratch DB
#                                      named "restore_test" inside the same
#                                      postgres container, assert it has at
#                                      least one table, then drop the scratch DB.
#                                      Proves the dump is actually restorable,
#                                      not just non-empty.
#
# Examples:
#   BACKUP_SCP_DEST=backup@offsite.example.com:/backups/murojaatnoma/ VERIFY_RESTORE=1 \
#     bash infra/scripts/backup-db.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/murojaatnoma}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_SCP_DEST="${BACKUP_SCP_DEST:-}"
VERIFY_RESTORE="${VERIFY_RESTORE:-0}"
RESTORE_TEST_DB="${RESTORE_TEST_DB:-restore_test}"

# Load DB creds from infra/.env
set -a
# shellcheck disable=SC1091
source "$INFRA_DIR/.env"
set +a

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F_%H%M%S)"
OUT="$BACKUP_DIR/${POSTGRES_DB}_${STAMP}.dump"

echo "==> dumping $POSTGRES_DB -> $OUT"
cd "$INFRA_DIR"
if ! docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$OUT"; then
  echo "==> pg_dump FAILED" >&2
  rm -f "$OUT"
  exit 1
fi
if [ ! -s "$OUT" ]; then
  echo "==> dump file is empty, treating as failure" >&2
  rm -f "$OUT"
  exit 1
fi

# -------------------------------------------------------------------------
# Optional: copy the fresh dump off-server. No-op unless BACKUP_SCP_DEST is
# set. Failure here does not delete the local dump — it's still a valid,
# retained local backup even if the off-server copy didn't make it.
# -------------------------------------------------------------------------
if [ -n "$BACKUP_SCP_DEST" ]; then
  echo "==> copying dump off-server -> $BACKUP_SCP_DEST"
  if scp -p "$OUT" "$BACKUP_SCP_DEST"; then
    echo "==> off-server copy OK"
  else
    echo "==> off-server copy FAILED (local dump is kept; see $OUT)" >&2
  fi
fi

# -------------------------------------------------------------------------
# Optional: prove the dump actually restores. No-op unless VERIFY_RESTORE=1.
# Restores into a throwaway "$RESTORE_TEST_DB" database inside the same
# postgres container, checks it ended up with at least one table, then drops
# it. Runs after pruning so a failure here doesn't affect retention.
# -------------------------------------------------------------------------
verify_restore() {
  echo "==> restore-verify: creating scratch DB $RESTORE_TEST_DB"
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$RESTORE_TEST_DB\";" >/dev/null 2>&1
  if ! docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
      -c "CREATE DATABASE \"$RESTORE_TEST_DB\";" >/dev/null 2>&1; then
    echo "==> restore-verify FAILED: could not create scratch DB" >&2
    return 1
  fi

  echo "==> restore-verify: restoring dump into $RESTORE_TEST_DB"
  if ! docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$RESTORE_TEST_DB" < "$OUT" >/dev/null 2>&1; then
    echo "==> restore-verify FAILED: pg_restore reported an error" >&2
    docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
      -c "DROP DATABASE IF EXISTS \"$RESTORE_TEST_DB\";" >/dev/null 2>&1
    return 1
  fi

  table_count=$(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$RESTORE_TEST_DB" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d '[:space:]')

  echo "==> restore-verify: dropping scratch DB $RESTORE_TEST_DB"
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$RESTORE_TEST_DB\";" >/dev/null 2>&1

  if [ -z "$table_count" ] || [ "$table_count" -eq 0 ] 2>/dev/null; then
    echo "==> restore-verify FAILED: restored DB has 0 tables (table_count='$table_count')" >&2
    return 1
  fi

  echo "==> restore-verify OK: $table_count table(s) restored"
  return 0
}

if [ "$VERIFY_RESTORE" = "1" ]; then
  if ! verify_restore; then
    echo "==> WARNING: restore-verify failed; the dump at $OUT is kept for inspection" >&2
    RESTORE_VERIFY_STATUS=1
  else
    RESTORE_VERIFY_STATUS=0
  fi
fi

echo "==> pruning dumps older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name "${POSTGRES_DB}_*.dump" -mtime +"$RETENTION_DAYS" -delete

echo "==> done. current backups:"
ls -lh "$BACKUP_DIR" | tail -n +1

# Non-zero exit if restore-verify was requested and failed, so cron/alerting
# notices even though the (still valid) local dump was kept.
if [ "${RESTORE_VERIFY_STATUS:-0}" -ne 0 ]; then
  exit 1
fi
