#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Health probe for the Murojaatnoma stack. Meant to run unattended from cron
# every ~5 minutes. On ANY failure it appends a timestamped line to
# /var/log/murojaatnoma-monitor.log and exits non-zero, so cron's MAILTO (or
# a later alerting hook that tails the log) can pick it up. On a clean run it
# prints a one-line OK summary to stdout and exits 0 — nothing is written to
# the log unless something is wrong.
#
# INSTALL-ONLY: this script is not installed by redeploy.sh / bootstrap. An
# operator adds the crontab line below once, on the server:
#
#   */5 * * * * /home/book/murojaatnoma/infra/scripts/monitor.sh >/dev/null 2>&1
#
# (crontab -e as the deploy user; adjust the path to match the actual clone.
# MAILTO=you@example.com at the top of the crontab will email you whenever
# this prints to stderr / exits non-zero, if the box has mail configured.)
#
# Run manually:  bash infra/scripts/monitor.sh
# ---------------------------------------------------------------------------
set -uo pipefail

BASE_MAIN="${BASE_MAIN:-https://murojaatnoma.uz}"
GATEWAY_IP="${GATEWAY_IP:-127.0.0.1}"
RES_MAIN="--resolve murojaatnoma.uz:443:${GATEWAY_IP}"
CURL="curl -sk --max-time 15"

LOG_FILE="${MONITOR_LOG_FILE:-/var/log/murojaatnoma-monitor.log}"
DISK_THRESHOLD_PCT="${DISK_THRESHOLD_PCT:-90}"
CERT_MIN_DAYS="${CERT_MIN_DAYS:-10}"
CERT_PATH="${CERT_PATH:-/etc/letsencrypt/live/murojaatnoma.uz/fullchain.pem}"
CONTAINERS="${CONTAINERS:-gov-system-postgres-1 gov-system-backend-1 gov-system-web-admin-1 gov-system-gateway-1}"

FAILS=0

fail() {
  # timestamped append to the log, one line per failure, plus stderr echo.
  local msg="$1"
  local line
  line="$(date '+%Y-%m-%d %H:%M:%S') [FAIL] $msg"
  echo "$line" >> "$LOG_FILE" 2>/dev/null || echo "$line" >&2
  echo "$line" >&2
  FAILS=$((FAILS + 1))
}

# ---------------------------------------------------------------------
# 1) main site reachable
# ---------------------------------------------------------------------
code=$($CURL $RES_MAIN -o /dev/null -w '%{http_code}' "$BASE_MAIN/" 2>/dev/null || echo 000)
[ "$code" = "200" ] || fail "web-admin root GET / -> $code (want 200)"

# ---------------------------------------------------------------------
# 2) API health
# ---------------------------------------------------------------------
code=$($CURL $RES_MAIN -o /dev/null -w '%{http_code}' "$BASE_MAIN/api/health" 2>/dev/null || echo 000)
[ "$code" = "200" ] || fail "backend GET /api/health -> $code (want 200)"

# ---------------------------------------------------------------------
# 3) admin gating spot-check — /workers with NO token must stay gated
#    (i.e. must NOT return a 2xx; 401/403 is the expected, healthy result).
# ---------------------------------------------------------------------
code=$($CURL $RES_MAIN -o /dev/null -w '%{http_code}' "$BASE_MAIN/api/workers" 2>/dev/null || echo 000)
case "$code" in
  2*) fail "admin gating BROKEN: GET /api/workers with no token -> $code (expected 401/403)" ;;
  000) fail "admin gating check: GET /api/workers -> connection failed" ;;
  *) : ;; # 401/403 (expected) or any other non-2xx — gate is holding
esac

# ---------------------------------------------------------------------
# 4) all 4 containers running
# ---------------------------------------------------------------------
for c in $CONTAINERS; do
  st=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo missing)
  [ "$st" = "running" ] || fail "container $c is $st (want running)"
done

# ---------------------------------------------------------------------
# 5) disk usage under threshold (root filesystem)
# ---------------------------------------------------------------------
use=$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ -n "${use:-}" ]; then
  if [ "$use" -ge "$DISK_THRESHOLD_PCT" ]; then
    fail "disk usage ${use}% >= ${DISK_THRESHOLD_PCT}% threshold on /"
  fi
else
  fail "disk usage check: could not read df output"
fi

# ---------------------------------------------------------------------
# 6) TLS cert not expiring within CERT_MIN_DAYS
# ---------------------------------------------------------------------
if [ -r "$CERT_PATH" ]; then
  checkend_secs=$((CERT_MIN_DAYS * 86400))
  if ! openssl x509 -in "$CERT_PATH" -checkend "$checkend_secs" -noout >/dev/null 2>&1; then
    fail "TLS cert $CERT_PATH expires within ${CERT_MIN_DAYS} days"
  fi
else
  fail "TLS cert check: $CERT_PATH not readable"
fi

# ---------------------------------------------------------------------
if [ "$FAILS" -eq 0 ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') OK: all checks passed"
  exit 0
fi

exit "$FAILS"
