# Oh My Pi (OMP) Configuration & Extensions

Comprehensive repository containing user configurations, Model Context Protocol (MCP) integrations, agent directives, and custom runtime extensions for **Oh My Pi (OMP)**.

---

## 📂 Repository Structure

```
OMP-Config/
├── AGENTS.md            # Agent directives, security rules, and homelab constraints
├── config.yml           # Core agent config: model roles, theme, composer shape
├── mcp.json             # MCP server configurations (Context7, Cloudflare)
├── install.sh           # Linux / macOS installation script (symlinks into ~/.omp/agent/)
├── install.ps1          # Windows PowerShell installer (symlink/hardlink/copy to %USERPROFILE%\.omp\agent\)
├── install.cmd          # Windows Command Prompt launcher wrapper
├── .gitignore           # Git ignore rules
└── extensions/
    ├── tps.ts             # Real-time token speed (TPS) and latency tracker extension
    └── deepseek-hours.ts  # DeepSeek peak & off-peak tracker with live countdown
```

---

## ⚙️ Configuration Overview

### 1. `config.yml` (Agent Configuration)
Defines primary model roles, TUI styling, symbols, and composer behavior:

| Role | Configured Model | Purpose / Use Case |
| :--- | :--- | :--- |
| **`default`** | `google-antigravity/gemini-3.7-flash:high` | Interactive coding turns, tool execution, general agent loop |
| **`plan`** | `openai-codex/gpt-5.6-sol:xhigh` | High-reasoning architectural decomposition & plan generation |
| **`task`** | `google-antigravity/gemini-3.7-flash:medium` | Subagent task delegation execution |
| **`smol`** | `google-antigravity/gemini-3.1-flash-lite:low` | Fast summarization, light lookups, and minimal overhead operations |
| **`commit`** | `google-antigravity/gemini-2.5-flash-lite:minimal` | Fast, low-latency Git commit message generation (`omp commit`) |
| **`vision`** | `google-antigravity/gemini-3.7-flash:medium` | Multimodal image and screenshot inspection |
| **`designer`** | `google-antigravity/gemini-3.7-flash:medium` | UI/UX design, visual review, and frontend styling tasks |
| **`slow`** | `openai-codex/gpt-5.6-luna:xhigh` | Heavy reasoning fallback and deep analytical tasks |

* **Theme:** `titanium` (Dark Mode)
* **Symbol Preset:** `nerd` (Nerd Font iconography)
* **Composer Shape:** `box` (Boxed multi-line editor)

---

### 2. `mcp.json` (Model Context Protocol)
Mounts external tool servers into the agent's runtime:
* **`context7`**: Direct library and framework documentation queries via `/usr/local/bin/context7-mcp`.
* **`cloudflare`**: Cloudflare infrastructure, DNS, and tunnel management bridge via `/opt/agents/scripts/run-cloudflare-mcp.sh`.

---

### 3. `AGENTS.md` (Directives & Security)
Standing operational rules loaded into project context for every session:
* **Secrets:** Strict prohibition on reading, printing, or transferring files from `~/secrets/`.
* **Privileges:** Use `/opt/agents/scripts/run-sudo.sh <cmd>` for non-interactive sudo execution without secret exposure.
* **Cloudflare Scope:** Strictly restricted to Infrastructure, DNS, and Tunnels (Workers AI forbidden unless explicitly ordered).
* **Maintenance:** Mandatory compressed updates to `~/HOMELAB_SETUP.md` and YADM dotfiles synchronization on configuration changes.

---

## 🧩 Extensions

### `extensions/tps.ts` (Token Speed Tracker)
Custom TypeScript extension (`@oh-my-pi/pi-coding-agent` runtime) providing real-time performance telemetry:

* **Live Status Widget:** Displays real-time estimated generation speed in the TUI status bar (`󱐋 <speed> tok/s`).
* **Telemetry Metrics:**
  * **TTFT:** Time to First Token latency calculation in milliseconds.
  * **TPS:** Live and turn-average Tokens Per Second generation speed.
  * **Token Counts:** Tracked prompt input tokens and generated output tokens.
  * **Session Aggregates:** Peak speed, average speed, total tokens, and total active generation time.
* **Slash Commands:**
  * `/tps` — Formats and prints a detailed Markdown performance breakdown for the latest response and full session totals.
  * `/tps-reset` — Clears turn and session statistics.


---

### `extensions/deepseek-hours.ts` (DeepSeek Peak / Off-Peak Tracker)
Custom TypeScript runtime extension tracking DeepSeek API peak pricing windows and countdown timers:

* **Schedule Windows (UTC):**
  * ☀️ **Peak Hours (2x Surge Rate):** `01:00 – 04:00 UTC` & `06:00 – 10:00 UTC` (`09:00–12:00` & `14:00–18:00` Beijing CST).
  * 🌙 **Off-Peak Hours (50% Standard Rate):** `00:00 – 01:00`, `04:00 – 06:00`, and `10:00 – 24:00 UTC`.
* **Non-Blocking Top Card Widget (`aboveEditor`):**
  * Displays a clean, non-intrusive card directly above the input editor showing status, rate multiplier, next window countdown (in `Xh Ym` / minutes without distracting seconds jitter), and exact switch times:
  ```
  ╭─ 🐳 DeepSeek Schedule ───────────────────────────────────────────────╮
  │  Status: 🌙 Off-Peak (50% Off)   │  Next: ☀️ Peak in 1h 24m          │
  │  Switch: 01:00 UTC (09:00 CST / 06:45 Local)                         │
  ╰──────────────────────────────────────────────────────────────────────╯
  ```
* **Status Bar Widget:**
  * `🌙 DS: Off-Peak ➔ ☀️ Peak in 1h 24m`
* **Transition Alerts:** Injects interactive TUI notification whenever DeepSeek transitions between Peak and Off-Peak pricing.
* **Slash Commands:**
  * `/deepseek-card` — Toggle the top card widget on/off above the editor.
  * `/deepseek-hours` (alias: `/deepseek`) — Displays comprehensive markdown report with exact time-to-transition, Local/UTC/Beijing timestamps, daily window schedule, and model pricing tables (V4-Flash, V4-Pro).
* **Model Tool:**
  * `deepseek_pricing_status` — Programmatic tool callable by models/subagents to check rate state before scheduling large batch or RAG workloads.
---

## 🚀 Installation & Setup

### Linux / macOS
To automatically symlink configuration files and extensions to `~/.omp/agent/`:

```bash
cd ~/projects/OMP-Config
./install.sh
```

*Manual symlink equivalent:*
```bash
mkdir -p ~/.omp/agent/extensions
ln -sf ~/projects/OMP-Config/config.yml ~/.omp/agent/config.yml
ln -sf ~/projects/OMP-Config/mcp.json ~/.omp/agent/mcp.json
ln -sf ~/projects/OMP-Config/AGENTS.md ~/.omp/agent/AGENTS.md
ln -sf ~/projects/OMP-Config/extensions/tps.ts ~/.omp/agent/extensions/tps.ts
ln -sf ~/projects/OMP-Config/extensions/deepseek-hours.ts ~/.omp/agent/extensions/deepseek-hours.ts
```

---

### Windows
Run the PowerShell installer (auto-detects `%USERPROFILE%\.omp\agent` and creates symlinks/hardlinks/copies):

**PowerShell:**
```powershell
cd $HOME\projects\OMP-Config
.\install.ps1
```

**Command Prompt / Batch:**
```cmd
cd %USERPROFILE%\projects\OMP-Config
install.cmd
```

---

## 🧠 Skills Integration

OMP skills are managed centrally via the master repository at `~/Skills` (submodules including `superpowers`, `anthropics/skills`, `caveman`, `ponytail`) and symlinked to:
```bash
~/.omp/skills -> /home/aaxyat/Skills
```
