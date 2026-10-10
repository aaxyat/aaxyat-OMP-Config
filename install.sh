#!/usr/bin/env bash
set -euo pipefail

# Installs Oh My Pi (OMP) custom theme extension, Jev security layer, and configuration.

TARGET_DIR="${HOME}/.omp/agent"
EXT_DIR="${TARGET_DIR}/extensions"
REPO_RAW="https://raw.githubusercontent.com/aaxyat/aaxyat-OMP-Config/main"

echo "==> Installing OMP Theme & Configuration..."

mkdir -p "${EXT_DIR}"

# Check if running from cloned repository or piped from curl
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"

if [[ -n "${SCRIPT_DIR}" && -f "${SCRIPT_DIR}/extensions/omz-theme.ts" ]]; then
  echo "==> Installing from local repository..."
  cp "${SCRIPT_DIR}/extensions/omz-theme.ts" "${EXT_DIR}/omz-theme.ts"
  if [[ -f "${SCRIPT_DIR}/extensions/jev-security.ts" ]]; then
    cp "${SCRIPT_DIR}/extensions/jev-security.ts" "${EXT_DIR}/jev-security.ts"
  fi
  
  if [[ -f "${TARGET_DIR}/config.yml" ]]; then
    BACKUP_FILE="${TARGET_DIR}/config.yml.backup.$(date +%Y%m%d%H%M%S)"
    echo "==> Backing up existing config.yml to ${BACKUP_FILE}"
    cp "${TARGET_DIR}/config.yml" "${BACKUP_FILE}"
  fi
  cp "${SCRIPT_DIR}/config.yml" "${TARGET_DIR}/config.yml"
else
  echo "==> Downloading from GitHub repository..."
  curl -fsSL "${REPO_RAW}/extensions/omz-theme.ts" -o "${EXT_DIR}/omz-theme.ts"
  curl -fsSL "${REPO_RAW}/extensions/jev-security.ts" -o "${EXT_DIR}/jev-security.ts"
  if [[ -f "${TARGET_DIR}/config.yml" ]]; then
    BACKUP_FILE="${TARGET_DIR}/config.yml.backup.$(date +%Y%m%d%H%M%S)"
    echo "==> Backing up existing config.yml to ${BACKUP_FILE}"
    cp "${TARGET_DIR}/config.yml" "${BACKUP_FILE}"
  fi
  curl -fsSL "${REPO_RAW}/config.yml" -o "${TARGET_DIR}/config.yml"
fi

echo "==> Installation complete!"
echo "==> Theme 'omz', Jev security extension, and config successfully installed to ${TARGET_DIR}."
