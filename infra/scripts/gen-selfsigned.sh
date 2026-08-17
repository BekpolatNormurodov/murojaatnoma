#!/usr/bin/env bash
set -euo pipefail

# Generates a self-signed TLS certificate/key pair for testing over a bare
# IP (no domain yet). Idempotent — skips generation if both files already
# exist. Replace with Let's Encrypt/certbot once a domain is added.
#
# Usage:
#   infra/scripts/gen-selfsigned.sh
#   SERVER_IP=1.2.3.4 infra/scripts/gen-selfsigned.sh   # override the IP

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/certs"
SERVER_IP="${SERVER_IP:-192.168.210.12}"
DAYS="${DAYS:-825}"

mkdir -p "$CERTS_DIR"

CERT_FILE="$CERTS_DIR/fullchain.pem"
KEY_FILE="$CERTS_DIR/privkey.pem"

if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
  echo "Certificate already exists at $CERT_FILE — skipping generation."
  echo "Delete $CERTS_DIR/fullchain.pem and $CERTS_DIR/privkey.pem to force regeneration."
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "ERROR: openssl is required but not found on PATH." >&2
  exit 1
fi

echo "Generating self-signed certificate for IP ${SERVER_IP} (valid ${DAYS} days) ..."

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -days "$DAYS" \
  -subj "/C=UZ/O=Gov System/CN=${SERVER_IP}" \
  -addext "subjectAltName=IP:${SERVER_IP},IP:127.0.0.1,DNS:localhost"

chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "Done."
echo "  Cert: $CERT_FILE"
echo "  Key:  $KEY_FILE"
