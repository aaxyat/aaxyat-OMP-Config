#!/usr/bin/env bash
# Installs the OMP configuration, theme, Jev security layer, and optional legacy extensions.
#
# Usage:
#   ./install.sh          # config.yml + core extensions
#   ./install.sh --all    # also legacy extensions, mcp.json, AGENTS.md
#
# A managed symlink (created by sync.sh) is left untouched; run the clone's
# sync.sh instead of this installer in that case.

set -euo pipefail

TARGET_DIR="${HOME}/.omp/agent"
EXT_DIR="${TARGET_DIR}/extensions"
REPO_RAW="https://raw.githubusercontent.com/aaxyat/aaxyat-OMP-Config/main"
INSTALL_ALL=0

for arg in "$@"; do
  case "$arg" in
    --all) INSTALL_ALL=1 ;;
    -h | --help)
      sed -n '2,9p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ -L "${TARGET_DIR}/config.yml" ]]; then
  echo "==> ${TARGET_DIR}/config.yml is a managed symlink; run the clone's sync.sh instead of this installer."
  exit 0
fi

echo "==> Installing OMP configuration into ${TARGET_DIR}..."
mkdir -p "${EXT_DIR}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"

backup_file() {
  local dst="$1"
  if [[ -f "$dst" ]]; then
    local backup="${dst}.backup.$(date +%Y%m%d%H%M%S)"
    echo "  - Backing up ${dst} -> ${backup}"
    cp "$dst" "$backup"
  fi
}

install_local() {
  local src="$1" dst="$2"
  backup_file "$dst"
  cp "${SCRIPT_DIR}/${src}" "$dst"
  echo "  -> ${src} -> ${dst}"
}

install_remote() {
  local src="$1" dst="$2"
  backup_file "$dst"
  curl -fsSL "${REPO_RAW}/${src}" -o "$dst"
  echo "  -> ${src} -> ${dst}"
}

CORE_EXTENSIONS=(omz-theme.ts jev-security.ts)
LEGACY_EXTENSIONS=(tps.ts deepseek-hours.ts model-cost.ts)

if [[ -n "${SCRIPT_DIR}" && -f "${SCRIPT_DIR}/extensions/omz-theme.ts" ]]; then
  echo "==> Installing from local repository..."
  install_local config.yml "${TARGET_DIR}/config.yml"
  for name in "${CORE_EXTENSIONS[@]}"; do
    install_local "extensions/${name}" "${EXT_DIR}/${name}"
  done
  if [[ "$INSTALL_ALL" -eq 1 ]]; then
    for name in "${LEGACY_EXTENSIONS[@]}"; do
      install_local "extensions/${name}" "${EXT_DIR}/${name}"
    done
    install_local mcp.json "${TARGET_DIR}/mcp.json"
    install_local AGENTS.md "${TARGET_DIR}/AGENTS.md"
  fi
else
  echo "==> Downloading from GitHub..."
  install_remote config.yml "${TARGET_DIR}/config.yml"
  for name in "${CORE_EXTENSIONS[@]}"; do
    install_remote "extensions/${name}" "${EXT_DIR}/${name}"
  done
  if [[ "$INSTALL_ALL" -eq 1 ]]; then
    for name in "${LEGACY_EXTENSIONS[@]}"; do
      install_remote "extensions/${name}" "${EXT_DIR}/${name}"
    done
    install_remote mcp.json "${TARGET_DIR}/mcp.json"
    install_remote AGENTS.md "${TARGET_DIR}/AGENTS.md"
  fi
fi

echo "==> Installation complete."
echo "    Core: config.yml, omz-theme.ts, jev-security.ts"
if [[ "$INSTALL_ALL" -eq 1 ]]; then
  echo "    All:  tps.ts, deepseek-hours.ts, model-cost.ts, mcp.json, AGENTS.md"
fi
