#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBSITE_DIR="$PROJECT_ROOT/website"
BUILD_DIR="$WEBSITE_DIR/dist/client"

SSH_HOST="zentao.wanghuanlab.com"
SSH_USER="root"
SSH_PORT="22"
SSH_IDENTITY=""
REMOTE_DIR="/opt/1panel/www/sites/zen/index"
DRY_RUN=false

usage() {
  cat <<'EOF'
部署 Zentao Log Agent 官网。

用法：
  ./scripts/deploy-website.sh [选项]

选项：
  --host HOST       SSH 主机，默认 zentao.wanghuanlab.com
  --user USER       SSH 用户，默认 root
  --port PORT       SSH 端口，默认 22
  --identity FILE   SSH 私钥文件
  --remote-dir DIR  远端目录，默认 /opt/1panel/www/sites/zen/index
  --dry-run         仅构建并显示部署信息，不连接服务器
  -h, --help        显示帮助

示例：
  ./scripts/deploy-website.sh
  ./scripts/deploy-website.sh --user ubuntu --identity ~/.ssh/id_ed25519
  ./scripts/deploy-website.sh --port 2222
EOF
}

while (($# > 0)); do
  case "$1" in
    --host) SSH_HOST="${2:?--host 需要参数}"; shift 2 ;;
    --user) SSH_USER="${2:?--user 需要参数}"; shift 2 ;;
    --port) SSH_PORT="${2:?--port 需要参数}"; shift 2 ;;
    --identity) SSH_IDENTITY="${2:?--identity 需要参数}"; shift 2 ;;
    --remote-dir) REMOTE_DIR="${2:?--remote-dir 需要参数}"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数：$1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ "$SSH_HOST" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "SSH 主机格式不安全。" >&2; exit 2; }
[[ "$SSH_USER" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "SSH 用户格式不安全。" >&2; exit 2; }
[[ "$SSH_PORT" =~ ^[0-9]+$ ]] || { echo "SSH 端口必须是数字。" >&2; exit 2; }
[[ "$REMOTE_DIR" =~ ^/opt/1panel/www/sites/[A-Za-z0-9._/-]+$ ]] || {
  echo "远端目录必须位于 /opt/1panel/www/sites/ 下。" >&2
  exit 2
}

for command in npm ssh tar; do
  command -v "$command" >/dev/null 2>&1 || { echo "缺少命令：$command" >&2; exit 1; }
done

echo "[1/4] 构建官网"
npm --prefix "$WEBSITE_DIR" run build
[[ -f "$BUILD_DIR/index.html" ]] || { echo "构建失败：未找到 $BUILD_DIR/index.html" >&2; exit 1; }

TARGET="$SSH_USER@$SSH_HOST"
DEPLOY_ID="$(date +%Y%m%d%H%M%S)-$$"
REMOTE_STAGE="${REMOTE_DIR}.upload-${DEPLOY_ID}"

echo "[2/4] 部署目标：$TARGET:$REMOTE_DIR"
if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run 完成：构建内容位于 $BUILD_DIR"
  exit 0
fi

CONTROL_SOCKET="/tmp/dsoa-deploy-${UID:-0}-$$.sock"
SSH_ARGS=(
  -p "$SSH_PORT"
  -o "ConnectTimeout=15"
  -o "ServerAliveInterval=15"
  -o "ControlMaster=auto"
  -o "ControlPersist=60"
  -o "ControlPath=$CONTROL_SOCKET"
)
if [[ -n "$SSH_IDENTITY" ]]; then
  [[ -f "$SSH_IDENTITY" ]] || { echo "SSH 私钥不存在：$SSH_IDENTITY" >&2; exit 2; }
  SSH_ARGS+=(-i "$SSH_IDENTITY")
fi

cleanup() {
  ssh "${SSH_ARGS[@]}" -o BatchMode=yes "$TARGET" "rm -rf -- '$REMOTE_STAGE'" >/dev/null 2>&1 || true
  ssh "${SSH_ARGS[@]}" -o BatchMode=yes -O exit "$TARGET" >/dev/null 2>&1 || true
  rm -f "$CONTROL_SOCKET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[3/4] 上传静态文件"
ssh "${SSH_ARGS[@]}" "$TARGET" "rm -rf -- '$REMOTE_STAGE' && mkdir -p -- '$REMOTE_STAGE'"
tar -C "$BUILD_DIR" -czf - . | ssh "${SSH_ARGS[@]}" "$TARGET" "tar -xzf - -C '$REMOTE_STAGE'"

echo "[4/4] 检查并切换站点目录"
ssh "${SSH_ARGS[@]}" "$TARGET" sh -s -- "$REMOTE_STAGE" "$REMOTE_DIR" <<'REMOTE_SCRIPT'
set -eu
stage="$1"
target="$2"
backup="${target}.backup-$$"

test -f "$stage/index.html"
mkdir -p "$(dirname "$target")"

if [ -e "$target" ]; then
  mv "$target" "$backup"
fi

if mv "$stage" "$target"; then
  find "$target" -type d -exec chmod 755 {} +
  find "$target" -type f -exec chmod 644 {} +
  rm -rf "$backup"
else
  if [ -e "$backup" ]; then mv "$backup" "$target"; fi
  exit 1
fi
REMOTE_SCRIPT

trap - EXIT
ssh "${SSH_ARGS[@]}" -O exit "$TARGET" >/dev/null 2>&1 || true
rm -f "$CONTROL_SOCKET" >/dev/null 2>&1 || true
echo "部署完成：https://zentao.wanghuanlab.com"
