# Oh My Pi (OMP) Configuration & Extensions

Comprehensive repository containing user configurations, Model Context Protocol (MCP) integrations, agent directives, and custom runtime extensions for **Oh My Pi (OMP)**.

---

## 📂 Repository Structure

```
~/projects/OMP-Config/
├── AGENTS.md            # Agent directives, security rules, and homelab constraints
├── config.yml           # Core agent config: model roles, theme, composer shape
├── mcp.json             # MCP server configurations (Context7, Cloudflare)
├── install.sh           # Installation script (symlinks into ~/.omp/agent/)
├── .gitignore           # Git ignore rules
└── extensions/
    └── tps.ts          # Real-time token speed (TPS) and latency tracker extension
```

---

## ⚙️ Configuration Overview

### 1. `config.yml` (Agent Configuration)
Configures model routing roles, UI styling, and active extensions:
* **Model Roles:**
  * `default`: `google-antigravity/gemini-3.7-flash:high`
  * `plan`: `openai-codex/gpt-5.6-sol:xhigh`
  * `task`: `google-antigravity/gemini-3.7-flash:medium`
  * `smol`: `google-antigravity/gemini-3.1-flash-lite:low`
  * `commit`: `google-antigravity/gemini-2.5-flash-lite:minimal`
  * `vision`: `google-antigravity/gemini-3.7-flash:medium`
  * `designer`: `google-antigravity/gemini-3.7-flash:medium`
  * `slow`: `openai-codex/gpt-5.6-luna:xhigh`
* **Theme & UI:**
  * `theme.dark`: `titanium`
  * `symbolPreset`: `nerd`
  * `composer.shape`: `box`

### 2. `mcp.json` (Model Context Protocol)
Defines connected MCP servers:
* **`context7`**: Direct library/framework documentation queries via `/usr/local/bin/context7-mcp`.
* **`cloudflare`**: Cloudflare infrastructure & DNS management bridge via `/opt/agents/scripts/run-cloudflare-mcp.sh`.

### 3. `AGENTS.md` (Directives & Security)
* **Secrets:** Strict prohibition on reading/exposing `~/secrets/`.
* **Privileges:** Use `/opt/agents/scripts/run-sudo.sh` for non-interactive sudo execution.
* **Cloudflare Scope:** Strictly restricted to Infrastructure, DNS, and Tunnels (Workers AI forbidden).
* **Maintenance:** Mandatory updates to `~/HOMELAB_SETUP.md` and YADM dotfiles synchronization.

---

## 🧩 Extensions

### `extensions/tps.ts` (Token Speed Tracker)
Custom TypeScript runtime extension tracking streaming speed and latency:
* **Live Status Widget:** Displays real-time estimated generation speed in the TUI status bar (`󱐋 <speed> tok/s`).
* **Session Metrics:** Tracks prompt input tokens, output tokens, total generation time, peak TPS, and Time to First Token (TTFT).
* **Slash Commands:**
  * `/tps` — Prints detailed performance breakdown of the last turn and full session totals.
  * `/tps-reset` — Clears turn and session statistics.

---

## 🚀 Quick Setup & Installation

To link this repository's configuration and extensions into your active Oh My Pi agent directory (`~/.omp/agent/`):

```bash
cd ~/projects/OMP-Config
./install.sh
```

Or manually symlink:
```bash
ln -sf ~/projects/OMP-Config/config.yml ~/.omp/agent/config.yml
ln -sf ~/projects/OMP-Config/mcp.json ~/.omp/agent/mcp.json
ln -sf ~/projects/OMP-Config/AGENTS.md ~/.omp/agent/AGENTS.md
mkdir -p ~/.omp/agent/extensions
ln -sf ~/projects/OMP-Config/extensions/tps.ts ~/.omp/agent/extensions/tps.ts
```

---

## 🧠 Skills Integration

OMP skills are managed centrally via the master repository at `~/Skills` (submodules including `superpowers`, `anthropics/skills`, `caveman`, `ponytail`) and symlinked to:
```bash
~/.omp/skills -> /home/aaxyat/Skills
```
