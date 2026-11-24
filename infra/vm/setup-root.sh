#!/usr/bin/env bash
# One-time ROOT setup for murojaatnoma on the shared nginx VM.
#   sudo bash ~/murojaatnoma/setup-root.sh install   # Docker + docker group
#   sudo bash ~/murojaatnoma/setup-root.sh cert      # Let's Encrypt via DNS-01 (manual TXT)
#   sudo bash ~/murojaatnoma/setup-root.sh site      # enable the nginx site (after cert)
# Each step is idempotent and touches nothing that belongs to other sites.
set -euo pipefail
APP_USER="${SUDO_USER:-nginx-srm}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAINS=(-d murojaatnoma.uz -d www.murojaatnoma.uz -d api.murojaatnoma.uz)

case "${1:-}" in
  install)
    if ! command -v docker >/dev/null 2>&1; then
      apt-get update -q
      DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker.io docker-compose-v2
    fi
    systemctl enable --now docker
    usermod -aG docker "$APP_USER"
    docker --version; docker compose version
    echo "OK: docker ready; $APP_USER added to group docker (takes effect on next login)"
    ;;
  cert)
    # Manual DNS-01: certbot prints one TXT value per name and waits for Enter.
    # Add each as  _acme-challenge[.www|.api]  TXT  in the domain's DNS panel.
    certbot certonly --manual --preferred-challenges dns \
      --cert-name murojaatnoma.uz "${DOMAINS[@]}" \
      --agree-tos --register-unsafely-without-email --keep-until-expiring
    ls -l /etc/letsencrypt/live/murojaatnoma.uz/
    ;;
  site)
    test -f /etc/letsencrypt/live/murojaatnoma.uz/fullchain.pem || { echo "no cert yet — run: cert"; exit 1; }
    install -m 644 "$HERE/host-nginx-murojaatnoma.conf" /etc/nginx/sites-available/murojaatnoma
    ln -sfn /etc/nginx/sites-available/murojaatnoma /etc/nginx/sites-enabled/murojaatnoma
    if nginx -t; then
      systemctl reload nginx
      echo "OK: nginx reloaded with murojaatnoma.uz"
    else
      rm -f /etc/nginx/sites-enabled/murojaatnoma
      echo "nginx -t FAILED — site disabled again, nothing reloaded"; exit 1
    fi
    ;;
  *)
    echo "usage: sudo bash $0 install|cert|site"; exit 2 ;;
esac
