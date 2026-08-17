#!/usr/bin/env bash
set -euo pipefail

# Postgres backup for the Murojaatnoma stack. Dumps the DB (custom format) from
# the running postgres container, keeps 14 days locally, and (optionally) can be
# copied off-server for real durability.
#
# Usage:      bash infra/scripts/backup-db.sh
# Cron (2am): 0 2 * * *  /home/book/murojaatnoma/infra/scripts/backup-db.sh >> /var/log/murojaatnoma-backup.log 2>&1
# Restore:    docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean < file.dump

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/murojaatnoma}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

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
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$OUT"

echo "==> pruning dumps older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name "${POSTGRES_DB}_*.dump" -mtime +"$RETENTION_DAYS" -delete

echo "==> done. current backups:"
ls -lh "$BACKUP_DIR" | tail -n +1
