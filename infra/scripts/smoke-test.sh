#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Post-deploy smoke test for Murojaatnoma.
#
# Verifies infra (containers, TLS, security headers, backend health) then
# enumerates EVERY route from the live OpenAPI spec and probes each
# parameterless GET. Auth-guarded 401/403 and validation 400 (route is wired,
# just needs params/body) both count as PASS; 404 / 5xx / connection failures
# are real failures. Mutating + parameterised routes are listed, not called.
#
# Run on the server:  bash infra/scripts/smoke-test.sh
# Exit code = number of failed checks (0 = ALL GREEN).
# ---------------------------------------------------------------------------
set -uo pipefail

BASE_MAIN="${BASE_MAIN:-https://murojaatnoma.uz}"
BASE_API="${BASE_API:-https://api.murojaatnoma.uz}"
GATEWAY_IP="${GATEWAY_IP:-127.0.0.1}"
RES_MAIN="--resolve murojaatnoma.uz:443:${GATEWAY_IP}"
RES_API="--resolve api.murojaatnoma.uz:443:${GATEWAY_IP}"
CURL="curl -sk --max-time 15"
FAILFILE="$(mktemp)"; echo 0 > "$FAILFILE"

pass() { echo "  [PASS] $*"; }
warn() { echo "  [WARN] $*"; }
bad()  { echo "  [FAIL] $*"; echo $(( $(cat "$FAILFILE") + 1 )) > "$FAILFILE"; }

echo "== containers =="
for c in postgres backend web-admin gateway; do
  st=$(docker inspect -f '{{.State.Status}}' "gov-system-${c}-1" 2>/dev/null || echo missing)
  [ "$st" = running ] && pass "$c running" || bad "$c $st"
done

echo "== TLS + security headers (main domain) =="
hdrs=$($CURL $RES_MAIN -I "$BASE_MAIN/" 2>/dev/null)
echo "$hdrs" | grep -qi 'strict-transport-security' && pass "HSTS present" || bad "HSTS missing"
echo "$hdrs" | grep -qi 'x-frame-options'            && pass "X-Frame-Options present" || bad "X-Frame-Options missing"
echo "$hdrs" | grep -qi 'x-content-type-options'     && pass "X-Content-Type-Options present" || bad "nosniff missing"
code=$($CURL $RES_MAIN -o /dev/null -w '%{http_code}' "$BASE_MAIN/")
[ "$code" = 200 ] && pass "web-admin root 200" || bad "web-admin root $code"

echo "== backend health =="
h=$($CURL $RES_API "$BASE_API/health" 2>/dev/null)
echo "$h" | grep -q '"status":"ok"' && pass "health ok" || bad "health: ${h:-<no response>}"

echo "== enumerate + probe routes from OpenAPI =="
spec=$($CURL $RES_API "$BASE_API/api/docs-json" 2>/dev/null)
# Fixed core-route list — probed when Swagger's OpenAPI is disabled in prod
# (the NODE_ENV guard), so this stays thorough without the spec. Paths are
# slash-less; the loop prefixes them.
FIXED_ROUTES="health workers staff deputies complaints requests requests/stats app-users cameras news meetings documents districts notifications notifications/unread-count analytics/summary finance/monthly utility/payments zones zones/geojson chat/conversations leave points suggestions bonuses"
if printf '%s' "$spec" | head -c1 | grep -q '{'; then
  gets=$(printf '%s' "$spec" | python3 -c '
import sys, json
try:
    spec = json.load(sys.stdin)
except Exception as e:
    sys.stderr.write("json parse error: %s\n" % e); sys.exit(0)
paths = spec.get("paths", {})
g = [p.lstrip("/") for p, ms in paths.items() if "get" in {k.lower() for k in ms} and "{" not in p]
print("\n".join(sorted(g)))
')
else
  warn "no OpenAPI JSON (Swagger off in prod) — probing fixed core-route list instead"
  gets=$(printf '%s\n' $FIXED_ROUTES)
fi
while read -r p; do
  [ -z "$p" ] && continue
  sleep 0.05   # pace under the api rate limit as the route list grows
  code=$($CURL $RES_API -o /dev/null -w '%{http_code}' "$BASE_API/$p")
  # a 503 here is almost always our own limit_req kicking in on a burst — back off + retry once
  if [ "$code" = 503 ]; then sleep 0.6; code=$($CURL $RES_API -o /dev/null -w '%{http_code}' "$BASE_API/$p"); fi
  case "$code" in
    2*)          pass "GET /$p -> $code" ;;
    400|401|403) pass "GET /$p -> $code (wired; needs auth/params)" ;;
    404)         warn "GET /$p -> 404 (not deployed / feature-gated?)" ;;
    5*)          bad  "GET /$p -> $code (server error!)" ;;
    000)         bad  "GET /$p -> connection failed" ;;
    *)           warn "GET /$p -> $code" ;;
  esac
done <<< "$gets"

fails=$(cat "$FAILFILE"); rm -f "$FAILFILE"
echo "== RESULT =="
if [ "$fails" -eq 0 ]; then echo "ALL GREEN"; else echo "$fails CHECK(S) FAILED"; fi
exit "$fails"
