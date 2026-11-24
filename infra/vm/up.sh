#!/usr/bin/env bash
# Load images and (re)start the stack — runs as the app user (docker group).
#   bash ~/murojaatnoma/up.sh <tag> [images.tar.gz]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
TAG="${1:?tag required}"
ARCHIVE="${2:-}"

if [ ! -f .env ]; then
  umask 077
  pg_pw="$(openssl rand -hex 24)"
  admin_pw="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  cat > .env <<ENV
POSTGRES_USER=murojaat
POSTGRES_PASSWORD=${pg_pw}
POSTGRES_DB=murojaatnoma
NODE_ENV=production
DATABASE_URL=postgresql://murojaat:${pg_pw}@postgres:5432/murojaatnoma?schema=public
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${admin_pw}
SEED_DEMO_DATA=false
OTP_DEV_ECHO=false
OTP_DEMO_CODE=111111
PUBLIC_BASE_URL=https://murojaatnoma.uz
GEOFENCE_RADIUS_M=2000
OFFICE_LATITUDE=41.3111
OFFICE_LONGITUDE=69.3402
STALE_LOCATION_MINUTES=30
MEDIA_MONITOR_ENABLED=true
ENV
  printf 'Web-admin: https://murojaatnoma.uz\nlogin: admin\nparol: %s\n' "$admin_pw" > ADMIN_LOGIN.txt
  chmod 600 ADMIN_LOGIN.txt
  echo "Created .env and ADMIN_LOGIN.txt (both mode 600) — read the login with: cat ~/murojaatnoma/ADMIN_LOGIN.txt"
fi
grep -q '^TAG=' .env && sed -i "s/^TAG=.*/TAG=${TAG}/" .env || echo "TAG=${TAG}" >> .env

if [ -n "$ARCHIVE" ]; then
  echo "== docker load $ARCHIVE"; gunzip -c "$ARCHIVE" | docker load
fi
echo "== up (tag $TAG)"
docker compose --env-file .env up -d --remove-orphans
echo "== waiting for backend health"
for _ in $(seq 1 40); do
  s=$(docker inspect -f '{{.State.Health.Status}}' murojaatnoma-backend-1 2>/dev/null || echo none)
  [ "$s" = healthy ] && break; sleep 5
done
echo "backend=$s"
docker compose ps
curl -fsS -m 5 http://127.0.0.1:8310/api/health && echo || { docker compose logs --tail=60 backend; exit 1; }
