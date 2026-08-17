#!/usr/bin/env bash
set -euo pipefail

# Deploys the latest code on the server: git pull, build images, (re)start
# the stack, and print status. Run from anywhere inside the repo.
#
# Usage: bash infra/scripts/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"

echo "==> git pull"
cd "$REPO_ROOT"
git pull

cd "$INFRA_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: infra/.env not found." >&2
  echo "Copy infra/.env.example to infra/.env and fill in real values first." >&2
  exit 1
fi

# Real TLS certs come from the host's /etc/letsencrypt (mounted into the gateway;
# see docker-compose.yml + conf.d/default.conf). The ./certs self-signed set is only
# a fallback for non-domain/local testing — generate it only when explicitly asked.
if [[ "${GEN_SELF_SIGNED:-0}" == "1" && ( ! -f certs/fullchain.pem || ! -f certs/privkey.pem ) ]]; then
  echo "==> GEN_SELF_SIGNED=1: generating a self-signed cert into ./certs"
  bash scripts/gen-selfsigned.sh
fi

echo "==> docker compose build"
docker compose build

echo "==> docker compose up -d"
docker compose up -d

# nginx.conf and conf.d are bind-mounted read-only, so `up -d` does NOT reload
# them (the gateway container definition is unchanged). Validate + reload explicitly.
echo "==> validate + reload gateway nginx"
if docker compose exec -T gateway nginx -t; then
  docker compose exec -T gateway nginx -s reload && echo "nginx reloaded"
else
  echo "WARN: nginx config test failed — NOT reloading (old config still serving)" >&2
fi

echo "==> docker compose ps"
docker compose ps
