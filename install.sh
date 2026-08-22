#!/usr/bin/env bash
set -euo pipefail

# Target directory
TARGET_DIR="${HOME}/.omp/agent"
EXTENSIONS_DIR="${TARGET_DIR}/extensions"

echo "==> Setting up Oh My Pi configuration in ${TARGET_DIR}..."

mkdir -p "${TARGET_DIR}"
mkdir -p "${EXTENSIONS_DIR}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Link / Copy configuration files
link_file() {
    local src="$1"
    local dst="$2"
    if [ -e "${dst}" ] || [ -L "${dst}" ]; then
        echo "  - Backing up existing ${dst} -> ${dst}.bak"
        cp -L "${dst}" "${dst}.bak" 2>/dev/null || true
    fi
    echo "  -> Linking ${src} -> ${dst}"
    ln -sf "${src}" "${dst}"
}

link_file "${SCRIPT_DIR}/config.yml" "${TARGET_DIR}/config.yml"
link_file "${SCRIPT_DIR}/mcp.json" "${TARGET_DIR}/mcp.json"
link_file "${SCRIPT_DIR}/AGENTS.md" "${TARGET_DIR}/AGENTS.md"
link_file "${SCRIPT_DIR}/extensions/tps.ts" "${EXTENSIONS_DIR}/tps.ts"
link_file "${SCRIPT_DIR}/extensions/deepseek-hours.ts" "${EXTENSIONS_DIR}/deepseek-hours.ts"

echo "==> Done! Oh My Pi configuration linked successfully."
