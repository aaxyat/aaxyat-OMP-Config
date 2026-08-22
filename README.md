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
    ├── deepseek-hours.ts  # DeepSeek peak & off-peak tracker with live countdown
    └── model-cost.ts      # Dynamic multi-model token & cost tracking card
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

* **Live Status Widget:** Displays real-time estimated generation throughput and TTFT latency in the TUI status bar (`󱐋 128.4 tok/s │ ⏱️ 180ms`).
* **Telemetry Metrics:**
  * **TTFT:** Time to First Token latency calculation in milliseconds.
  * **TPS:** Live and turn-average Tokens Per Second generation speed.
  * **Token Counts:** Tracked prompt input tokens and generated output tokens.
  * **Session Aggregates:** Peak speed, average speed, total tokens, and total active generation time.
* **Slash Commands:**
  * `/tps` — Formats and prints a detailed performance telemetry breakdown for the latest response and cumulative session totals.
  * `/tps-reset` — Clears turn and session statistics.


---

### `extensions/deepseek-hours.ts` (DeepSeek Peak / Off-Peak Tracker)
Custom TypeScript runtime extension tracking DeepSeek API peak pricing windows and countdown timers:

* **Schedule Windows (UTC):**
  * ☀️ **Peak Hours (2x Surge Rate):** `01:00 – 04:00 UTC` & `06:00 – 10:00 UTC` (`09:00–12:00` & `14:00–18:00` Beijing CST).
  * 🌙 **Off-Peak Hours (50% Standard Rate):** `00:00 – 01:00`, `04:00 – 06:00`, and `10:00 – 24:00 UTC`.
* **Modernized ANSI Top Card Widget (`aboveEditor`):**
  * Displays a vibrant colored pill badge directly above the editor with status, countdown, and timestamps:
  ```text
  ╭─ 󰚩 DeepSeek Window ──────────────────────────────────────────────╮
  │  Status:  🌙 OFF-PEAK (50% OFF)   │ Next: ☀️ Peak in 1h 24m (01:00 UTC) │
  ╰────────────────────────────────────────────────────────────────────────╯
  ```
* **Clean Bottom Status Line:** Bottom status line remains clean with zero clutter.
* **Transition Alerts:** Injects interactive TUI notification whenever DeepSeek transitions between Peak and Off-Peak pricing.
* **Slash Commands:**
  * `/deepseek-card` — Toggle the top card widget on/off above the editor.
  * `/deepseek-hours` (alias: `/deepseek`) — Displays comprehensive markdown report with exact time-to-transition, Local/UTC/Beijing timestamps, daily window schedule, and model pricing tables (V4-Flash, V4-Pro).
* **Model Tool:**
  * `deepseek_pricing_status` — Programmatic tool callable by models/subagents to check rate state before scheduling large batch or RAG workloads.

---

### `extensions/model-cost.ts` (Model & Token Cost Tracker)
Custom TypeScript runtime extension dynamically tracking active models, tokens consumed, and incurred costs across all invoked models (e.g. Gemini, DeepSeek, Codex, Claude, OpenCode):

* **Multi-Model Token & Cost Accounting:**
  * Tracks prompt input, completion output, and cache hit tokens per model across primary turns and subagent delegations.
  * Built-in rate cards and provider cost parser for real-time expenditure calculations.
* **Itemized Multi-Model List Card (`aboveEditor`):**
  * Displays an itemized multi-line list card showing each model invoked in the session (e.g. Gemini, DeepSeek, OpenCode, Codex), its token consumption, input/output breakdown, and individual incurred cost:
  ```text
  ╭─  Active Models & Incurred Cost ───────────────────────────────────╮
  │  ● Gemini-3.7-Flash   14.2k tok (10.1k in / 4.1k out)   $0.0034 │
  │  ● DeepSeek-V4-Flash  8.5k tok  (6.0k in / 2.5k out)    $0.0019 │
  │  ● OpenCode-Kimi      2.1k tok  (1.8k in / 0.3k out)    $0.0008 │
  ├────────────────────────────────────────────────────────────────────────┤
  │   Total Session: 24.8k tokens                       💵 $0.0061  │
  ╰────────────────────────────────────────────────────────────────────────╯
  ```
* **Slash Commands:**
  * `/cost` (alias: `/models-cost`) — Prints detailed markdown table showing calls, input tokens, output tokens, cache hits, and incurred cost per model.
  * `/cost-card` — Toggle the model & cost card widget on/off above the editor.
  * `/cost-reset` — Reset session cost metrics.
* **Model Tool:**
  * `session_cost_breakdown` — Programmatic tool for models/subagents to check token expenditure and cost breakdown.
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
ln -sf ~/projects/OMP-Config/extensions/model-cost.ts ~/.omp/agent/extensions/model-cost.ts
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
