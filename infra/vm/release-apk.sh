#!/usr/bin/env bash
# Publish the Android apps to <site>/downloads/ — only the ones that changed
# since what is published. Phones see the new build number in manifest.json
# and offer the update.
#   bash infra/vm/release-apk.sh            # both apps
#   bash infra/vm/release-apk.sh worker     # one app
# Build number = max(pubspec, published + 1), so no manual bump is needed.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$ROOT"
mkdir -p dist-apk

FLUTTER="${MJ_FLUTTER:-flutter}"
FLUTTER="${FLUTTER/#\~/$HOME}"

SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
APKSIGNER="$(ls "$SDK"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1)"
[ -x "$APKSIGNER" ] || { echo "apksigner not found under $SDK" >&2; exit 1; }
# apksigner needs Java; without a system one use the JDK Flutter builds with.
if ! "$APKSIGNER" --version >/dev/null 2>&1; then
  jdk="$("$FLUTTER" config --list 2>/dev/null | awk -F': ' '/jdk-dir/{print $2; exit}')"
  export JAVA_HOME="${jdk:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
  "$APKSIGNER" --version >/dev/null || { echo "apksigner cannot find Java" >&2; exit 1; }
fi

# Hash of everything that goes into the APK (committed or not).
source_hash() {
  git ls-files -co --exclude-standard -- "apps/$1-app" packages |
    grep -Ev '(^|/)(test|integration_test)/|\.md$' | sort |
    while IFS= read -r f; do [ -f "$f" ] && printf '%s %s\n' "$(git hash-object "$f")" "$f"; done |
    shasum -a 256 | cut -d' ' -f1
}

published() { # app field
  printf '%s' "$MANIFEST" | python3 -I -c 'import json,sys
print(json.load(sys.stdin).get("apps",{}).get(sys.argv[1],{}).get(sys.argv[2],""))' "$1" "$2"
}

remote "mkdir -p $REMOTE_DIR/downloads"
MANIFEST="$(remote "cat $REMOTE_DIR/downloads/manifest.json 2>/dev/null || echo '{}'")"

for app in ${@:-worker user}; do
  case "$app" in
    worker) name=murojaatnoma-xodim ;;
    user) name=murojaatnoma-fuqaro ;;
    *) echo "unknown app: $app" >&2; exit 1 ;;
  esac
  hash="$(source_hash "$app")"
  if [ "$hash" = "$(published "$app" source)" ]; then
    echo "== $app: no changes since build $(published "$app" build) — skipped"
    continue
  fi
  line="$(grep -E '^version:' "apps/$app-app/pubspec.yaml" | awk '{print $2}')"
  version="${line%+*}"
  build="${line#*+}"
  last="$(published "$app" build)"
  if [ -n "$last" ] && [ "$build" -le "$last" ]; then build=$((last + 1)); fi

  echo "== $app: building $version+$build"
  (cd "apps/$app-app" && "$FLUTTER" build apk --release --target lib/main_prod.dart \
    --target-platform android-arm,android-arm64 --build-number "$build")
  file="$name-$version+$build.apk"
  cp "apps/$app-app/build/app/outputs/flutter-apk/app-release.apk" "dist-apk/$file"

  # A different signing key cannot update an installed app.
  signer="$("$APKSIGNER" verify --print-certs "dist-apk/$file" | awk '/certificate SHA-256 digest/{print $NF; exit}')"
  [ -n "$signer" ] || { echo "!! $app: could not read the signing certificate" >&2; exit 1; }
  old_signer="$(published "$app" signer)"
  if [ -n "$old_signer" ] && [ "$signer" != "$old_signer" ]; then
    echo "!! $app: signed with a different key than the published APK — not uploaded" >&2
    exit 1
  fi

  size="$(wc -c < "dist-apk/$file" | tr -d ' ')"
  sha="$(shasum -a 256 "dist-apk/$file" | cut -d' ' -f1)"
  echo "== $app: uploading $file ($((size / 1048576)) MB)"
  upload "dist-apk/$file" "$REMOTE_DIR/downloads/$file.part"
  # release-notes.txt: one "what is new" line each, shown in the update dialog.
  # min-build (optional): older installs may not postpone the update.
  entry="$(python3 -I -c 'import json,os,sys,datetime
v,b,f,s,h,src,sig,app=sys.argv[1:]
def lines(p):
    return [l.strip() for l in open(p,encoding="utf-8") if l.strip()] if os.path.exists(p) else []
e={"version":v,"build":int(b),"file":f,"size":int(s),"sha256":h,"source":src,"signer":sig,
 "notes":lines(app+"/release-notes.txt"),
 "publishedAt":datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
m=lines(app+"/min-build")
if m: e["minBuild"]=int(m[0])
print(json.dumps(e))' \
    "$version" "$build" "$file" "$size" "$sha" "$hash" "$signer" "apps/$app-app")"
  # Check the upload, publish the file, then the manifest (both atomically);
  # keep the three newest APKs of this app.
  printf '%s' "$entry" | remote "set -e; cd $REMOTE_DIR/downloads
    echo '$sha  $file.part' | sha256sum -c --quiet
    mv '$file.part' '$file'; chmod 644 '$file'
    python3 -c 'import json,os,sys
app=sys.argv[1]
try: m=json.load(open(\"manifest.json\"))
except FileNotFoundError: m={}
m.setdefault(\"apps\",{})[app]=json.load(sys.stdin)
json.dump(m,open(\"manifest.json.new\",\"w\"),indent=1)
os.chmod(\"manifest.json.new\",0o644); os.replace(\"manifest.json.new\",\"manifest.json\")' '$app'
    ls -t $name-*.apk | tail -n +4 | xargs -r rm --"
  MANIFEST="$(remote "cat $REMOTE_DIR/downloads/manifest.json")"
  curl -fsSI -m 20 "$MJ_URL/downloads/$(printf '%s' "$file" | sed 's/+/%2B/g')" |
    grep -iE '^(HTTP|content-length|content-type)'
  echo "== $app: published $version+$build"
done
