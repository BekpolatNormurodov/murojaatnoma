# Shared by deploy.sh and release-apk.sh. The server address is NOT in this
# (public) repository: put it in ~/.config/murojaatnoma/deploy.env
#   MJ_HOST=user@host
#   MJ_PORT=22
#   MJ_KEY=~/.ssh/key
#   MJ_URL=https://murojaatnoma.uz
#   MJ_FLUTTER=~/sdk/flutter-x.y.z/bin/flutter   # if not the one on PATH
CONFIG="${MJ_DEPLOY_ENV:-$HOME/.config/murojaatnoma/deploy.env}"
[ -f "$CONFIG" ] || { echo "Missing $CONFIG (see infra/vm/lib.sh)" >&2; exit 1; }
# shellcheck disable=SC1090
. "$CONFIG"
: "${MJ_HOST:?}" "${MJ_PORT:?}" "${MJ_KEY:?}"
MJ_URL="${MJ_URL:-https://murojaatnoma.uz}"
REMOTE_DIR=murojaatnoma
SSH_OPTS=(-i "${MJ_KEY/#\~/$HOME}" -o IdentitiesOnly=yes -o BatchMode=yes -o ServerAliveInterval=30)
remote() { ssh "${SSH_OPTS[@]}" -p "$MJ_PORT" "$MJ_HOST" "$@"; }
upload() { scp -q "${SSH_OPTS[@]}" -P "$MJ_PORT" "$1" "$MJ_HOST:$2"; }
ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
