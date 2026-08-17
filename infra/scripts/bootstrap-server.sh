#!/usr/bin/env bash
set -euo pipefail

# Idempotent Ubuntu server bootstrap: installs Docker Engine + the compose
# plugin, enables/starts the docker service, and adds the invoking user to
# the docker group. Safe to re-run.
#
# Usage: bash infra/scripts/bootstrap-server.sh

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

if command -v docker >/dev/null 2>&1; then
  echo "Docker already installed: $(docker --version)"
else
  echo "Installing Docker Engine via get.docker.com ..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  $SUDO sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
fi

echo "Enabling and starting the docker service ..."
$SUDO systemctl enable docker
$SUDO systemctl start docker

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin missing — installing via apt ..."
  $SUDO apt-get update -y
  $SUDO apt-get install -y docker-compose-plugin
fi

TARGET_USER="${SUDO_USER:-$USER}"
if id -nG "$TARGET_USER" 2>/dev/null | grep -qw docker; then
  echo "User '$TARGET_USER' is already in the docker group."
else
  echo "Adding user '$TARGET_USER' to the docker group ..."
  $SUDO usermod -aG docker "$TARGET_USER"
  echo "NOTE: log out/in (or run 'newgrp docker') for group membership to take effect."
fi

echo
echo "==== Versions ===="
docker --version
docker compose version
