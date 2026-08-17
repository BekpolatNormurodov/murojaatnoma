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

if [[ ! -f certs/fullchain.pem || ! -f certs/privkey.pem ]]; then
  echo "==> No TLS certificate found, generating a self-signed one"
  bash scripts/gen-selfsigned.sh
fi

echo "==> docker compose build"
docker compose build

echo "==> docker compose up -d"
docker compose up -d

echo "==> docker compose ps"
docker compose ps
