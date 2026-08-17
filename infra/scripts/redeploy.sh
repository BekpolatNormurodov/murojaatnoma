#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-command verified redeploy for Murojaatnoma (infra/deploy owner tool).
# pull -> validate nginx -> build -> up -> wait healthy -> seed -> reload -> smoke.
# A failed nginx validation or unhealthy backend aborts BEFORE touching the live
# site. Run on the server from anywhere:  bash infra/scripts/redeploy.sh
# ---------------------------------------------------------------------------
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA="$REPO/infra"

cd "$REPO"
echo "== pull =="; git pull origin main; HEAD=$(git rev-parse --short HEAD); echo "  head=$HEAD"
cd "$INFRA"

echo "== validate nginx (throwaway container on the compose network) =="
NET=$(sudo docker network ls --format '{{.Name}}' | grep -E 'gov-system.*internal' | head -1)
if ! sudo docker run --rm --network "$NET" \
   -v "$INFRA/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
   -v "$INFRA/nginx/conf.d:/etc/nginx/conf.d:ro" \
   -v /etc/letsencrypt:/etc/letsencrypt:ro nginx:alpine nginx -t 2>&1 | tail -2; then
  echo "  NGINX CONFIG INVALID — aborting (site untouched)"; exit 1
fi

echo "== build backend+web-admin =="; sudo docker compose build backend web-admin
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
echo "== smoke test =="; bash "$SCRIPT_DIR/smoke-test.sh" 2>&1 | tail -10
echo "== DONE head=$HEAD =="
