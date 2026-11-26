#!/usr/bin/env bash
# One-command release of the committed HEAD: build changed images on the
# server, back up the database, restart, check, then publish changed APKs.
#   bash infra/vm/deploy.sh              # web + backend + APKs
#   SKIP_APK=1 bash infra/vm/deploy.sh   # server only
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT"

git diff --quiet HEAD -- apps/backend apps/web-admin infra/vm ||
  { echo "Commit apps/backend, apps/web-admin and infra/vm first." >&2; exit 1; }
tag="$(git rev-parse --short=7 HEAD)"
prev="$(remote "grep '^TAG=' $REMOTE_DIR/.env | cut -d= -f2")"
echo "== server runs $prev, releasing $tag"

changed() { ! git cat-file -e "$prev^{commit}" 2>/dev/null || ! git diff --quiet "$prev" "$tag" -- "$1"; }

if [ "$prev" != "$tag" ]; then
  remote "mkdir -p $REMOTE_DIR/src-$tag"
  git archive "$tag" apps/backend apps/web-admin | remote "tar -x -C $REMOTE_DIR/src-$tag --strip-components=1"
  build=""
  for pair in backend:apps/backend web:apps/web-admin; do
    image="murojaatnoma-${pair%%:*}"
    dir="${pair#*:}"
    if changed "$dir"; then
      build="$build && nice -n 19 ionice -c3 docker build -q -t $image:$tag ${dir#apps/}"
    else
      build="$build && docker tag $image:$prev $image:$tag"
    fi
  done
  # The server's Docker has no BuildKit: drop the cache mount and the heredoc.
  remote "cd $REMOTE_DIR/src-$tag/web-admin && python3 - <<'PY'
import re
s=open('Dockerfile').read()
s=s.replace('--mount=type=cache,target=/root/.npm ','')
s=re.sub(r'^# syntax=.*\n','',s)
m=re.search(r\"RUN <<'EOF' cat > (\S+)\n(.*?)\nEOF\n\",s,re.S)
if m:
    open('spa-nginx.conf','w').write(m.group(2)+'\n')
    s=s[:m.start()]+'COPY spa-nginx.conf '+m.group(1)+'\n'+s[m.end():]
open('Dockerfile','w').write(s)
PY"
  echo "== building (this takes a few minutes)"
  remote "cd $REMOTE_DIR/src-$tag && nohup sh -c 'true $build && echo BUILD-OK || echo BUILD-FAIL' > ../build-$tag.log 2>&1 < /dev/null &"
  while :; do
    sleep 15
    result="$(remote "grep -o 'BUILD-[A-Z]*' $REMOTE_DIR/build-$tag.log || true")"
    [ -n "$result" ] && break
  done
  [ "$result" = BUILD-OK ] || { remote "tail -40 $REMOTE_DIR/build-$tag.log"; exit 1; }

  echo "== database backup"
  remote "cd $REMOTE_DIR && umask 077 && mkdir -p backups &&
    docker exec murojaatnoma-postgres-1 sh -c 'pg_dump -Fc -U \$POSTGRES_USER \$POSTGRES_DB' > backups/pre-$tag.dump &&
    test -s backups/pre-$tag.dump"
fi

# Stack files: the gateway reads its config only when recreated.
gateway_changed=0
for f in docker-compose.yml gateway.conf up.sh; do
  if ! git show "$tag:infra/vm/$f" | remote "cmp -s - $REMOTE_DIR/$f"; then
    git show "$tag:infra/vm/$f" | remote "cp -p $REMOTE_DIR/$f $REMOTE_DIR/backups/$f.before-$tag 2>/dev/null; cat > $REMOTE_DIR/$f"
    [ "$f" = up.sh ] || gateway_changed=1
  fi
done

remote "bash $REMOTE_DIR/up.sh $tag"
if [ "$gateway_changed" = 1 ]; then
  remote "cd $REMOTE_DIR && docker compose --env-file .env up -d --force-recreate gateway"
fi

echo "== public checks"
for path in / /yuklab-olish /api/health; do
  curl -fsS -m 20 --retry 5 --retry-delay 3 --retry-all-errors -o /dev/null -w "%{http_code} $path\n" "$MJ_URL$path"
done

[ "${SKIP_APK:-0}" = 1 ] || bash "$ROOT/infra/vm/release-apk.sh"
echo "== done: $tag"
