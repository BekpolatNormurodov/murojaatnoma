#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-command verified redeploy for Murojaatnoma (infra/deploy owner tool).
# lock -> rotate log -> pull -> validate nginx -> build -> up -> wait healthy
# -> seed -> reload -> smoke -> verify admin gating.
# A failed nginx validation or a failed build aborts BEFORE touching the live
# site (docker keeps the old containers running = no outage).
#
# Concurrency: guarded by an flock lock, so two deploys (manual + sync-tick,
# or two overlapping sync-ticks) never run at once. Idempotent — safe to
# re-run after a partial failure.
#
# Run on the server from anywhere:  bash infra/scripts/redeploy.sh
# ---------------------------------------------------------------------------
set -uo pipefail

# --- single-flight lock -----------------------------------------------------
# Replaces the old pgrep-based "is a deploy already running" self-match guard
# (fragile: it could match its own just-started process, or miss a deploy
# whose invocation didn't look like the expected command line). flock on a
# dedicated fd is atomic and kernel-enforced: a second concurrent invocation
# fails the non-blocking (-n) acquire immediately instead of racing the first
# one or silently piling up. The lock is released automatically on any exit
# (success, error, or signal) once fd 9 closes.
LOCK_FILE="/tmp/murojaatnoma-deploy.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "another deploy is already running (lock held: $LOCK_FILE) — exiting"
  exit 1
fi

# --- log rotation + capture -------------------------------------------------
# Only the lock holder ever gets here, so rotation can't race a concurrent
# run. Keep exactly one prior run's log around for postmortems, then mirror
# this run's full output (stdout+stderr) to the fresh log as well as the
# caller's terminal/ssh session.
LOG="/tmp/redeploy.log"
[ -f "$LOG" ] && mv -f "$LOG" "${LOG}.1"
exec > >(tee -a "$LOG") 2>&1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA="$REPO/infra"
OPS_DIR="${OPS_DIR:-$HOME/ops}"

cd "$REPO"
echo "== pull =="; git pull origin main; HEAD=$(git rev-parse --short HEAD); echo "  head=$HEAD"
cd "$INFRA"

echo "== validate nginx (throwaway container on the compose network) =="
NET=$(sudo docker network ls --format '{{.Name}}' | grep -E 'gov-system.*internal' | head -1)
if [ -z "$NET" ]; then
  echo "  could not find the gov-system internal network — aborting (site untouched)"; exit 1
fi
if ! sudo docker run --rm --network "$NET" \
   -v "$INFRA/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
   -v "$INFRA/nginx/conf.d:/etc/nginx/conf.d:ro" \
   -v /etc/letsencrypt:/etc/letsencrypt:ro nginx:alpine nginx -t 2>&1 | tail -2; then
  echo "  NGINX CONFIG INVALID — aborting (site untouched)"; exit 1
fi

echo "== build backend+web-admin =="
if ! sudo docker compose build backend web-admin; then
  echo "  BUILD FAILED — aborting (site untouched, old containers still running)"; exit 1
fi

echo "== up -d =="; sudo docker compose up -d

echo "== wait backend healthy =="
h=none
for _ in $(seq 1 48); do
  h=$(sudo docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' gov-system-backend-1 2>/dev/null || echo none)
  [ "$h" = healthy ] && break; sleep 5
done
echo "  backend=$h"
[ "$h" = healthy ] || { echo "  UNHEALTHY — logs:"; sudo docker compose logs --tail=40 backend; exit 1; }

# NOTE: package.json prisma.seed uses a `VAR=val cmd` prefix that prisma spawns
# WITHOUT a shell (ENOENT). Until that's a tsconfig ts-node override, seed via sh -c.
echo "== seed content =="
sudo docker compose exec -T backend sh -c \
  'TS_NODE_COMPILER_OPTIONS="{\"module\":\"commonjs\",\"moduleResolution\":\"node\"}" npx ts-node --transpile-only prisma/seed.ts' \
  2>&1 | tail -3 || echo "  CONTENT_SEED_FAILED"

echo "== seed attendance (if present) =="
if sudo docker compose exec -T backend sh -c 'test -f prisma/seedAttendance.ts'; then
  sudo docker compose exec -T -e TS_NODE_TRANSPILE_ONLY=1 -e 'TS_NODE_COMPILER_OPTIONS={"module":"commonjs"}' \
    backend node -r ts-node/register prisma/seedAttendance.ts 2>&1 | tail -2 || echo "  ATT_SEED_FAILED"
else echo "  (no seedAttendance.ts)"; fi

echo "== reload gateway =="; sudo docker compose exec -T gateway nginx -s reload 2>/dev/null && echo "  reloaded" || true

echo "== smoke test =="
SMOKE="$OPS_DIR/smoke-test.sh"
[ -f "$SMOKE" ] || SMOKE="$SCRIPT_DIR/smoke-test.sh"
bash "$SMOKE" 2>&1 | tail -10

echo "== verify admin gating =="
GATING="$OPS_DIR/verify-gating.sh"
if [ -f "$GATING" ]; then
  gating_out=$(bash "$GATING" 2>&1)
  if ! printf '%s\n' "$gating_out" | grep -i -A1 'RESULT'; then
    echo "  (no RESULT line found in verify-gating.sh output — last lines:)"
    printf '%s\n' "$gating_out" | tail -5
  fi
else
  echo "  (no $GATING — skipping)"
fi

echo "== DONE head=$HEAD =="
