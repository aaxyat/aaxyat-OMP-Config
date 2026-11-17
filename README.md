# aaxyat-OMP-Config

Personal base configuration for **Oh My Pi (OMP)**: theme, Jev security layer, status-line extensions, MCP template, agent directives, and cross-platform installers.

This is the head repository. It merges:

- `aaxyat/aaxyat-OMP-Config` — Powerlevel10k theme, Jev security/System 1 judge, auto-sync.
- `aaxyat/OMP-Config` — TPS, DeepSeek pricing, and model-cost extensions, MCP config, Windows installer.

The legacy `aaxyat/OMP-Config` repository is archived; this repo supersedes it.

## Contents

| Path | Purpose |
| --- | --- |
| `config.yml` | Live OMP config: model roles, `dark-monokai` theme, `omz` composer, status-line segments. |
| `extensions/omz-theme.ts` | Powerlevel10k ribbons, token metrics, DeepSeek window, model/thinking chips, prompt. |
| `extensions/jev-security.ts` | Pre-execution guardrails, secret redaction, failure guidance, `system_one_judge`. |
| `extensions/tps.ts` | Optional: real-time TPS/TTFT telemetry and `/tps` commands. |
| `extensions/deepseek-hours.ts` | Optional: DeepSeek peak/off-peak card, countdown, pricing tool. |
| `extensions/model-cost.ts` | Optional: per-model token and cost accounting card. |
| `mcp.json` | Portable MCP template (Context7, Cloudflare, Playwright, Stitch, REA). |
| `MCP.md` | Installed MCP server inventory across OMP and other harnesses. |
| `AGENTS.md` | Agent directives template. |
| `skills/` | Vendored skill sets: installed, Matt Pocock, pstack, Anthropic (non-Claude). |
| `install.sh` | Unix installer. |
| `install.ps1`, `install.cmd` | Windows installer. |
| `sync.sh` | Symlink, commit, and push the live config from a clone. |

## Install

### Unix (Linux / macOS)

```bash
# Core: config.yml + omz-theme + jev-security
curl -fsSL https://raw.githubusercontent.com/aaxyat/aaxyat-OMP-Config/main/install.sh | bash

# Everything: also tps, deepseek-hours, model-cost, mcp.json, AGENTS.md
curl -fsSL https://raw.githubusercontent.com/aaxyat/aaxyat-OMP-Config/main/install.sh | bash -s -- --all
```

From a clone:

```bash
git clone https://github.com/aaxyat/aaxyat-OMP-Config.git
cd aaxyat-OMP-Config
./install.sh          # core
./install.sh --all    # everything
```

The installer backs up an existing `config.yml` as `config.yml.backup.YYYYMMDDHHMMSS`. A `config.yml` that is a managed symlink is left alone; run the clone's `sync.sh` instead.

### Windows

```powershell
git clone https://github.com/aaxyat/aaxyat-OMP-Config.git
cd aaxyat-OMP-Config
.\install.ps1          # core
.\install.ps1 -All     # everything
```

Or from Command Prompt:

```cmd
install.cmd
install.cmd -All
```

The installer prefers symlinks, falls back to hardlinks, then copies. Existing files are backed up with a timestamp.

### Manual

```bash
mkdir -p ~/.omp/agent/extensions
cp config.yml ~/.omp/agent/config.yml
cp extensions/omz-theme.ts extensions/jev-security.ts ~/.omp/agent/extensions/
# optional
cp extensions/tps.ts extensions/deepseek-hours.ts extensions/model-cost.ts ~/.omp/agent/extensions/
cp mcp.json AGENTS.md ~/.omp/agent/
```

Restart OMP to load the extensions.

## Configuration

### `config.yml`

The committed file is the current live configuration (`setupVersion: 3`):

- **Model roles:** `default`, `smol`, `image`, `vision`, `judge`, `advisor`.
- **Theme:** `dark-monokai`, Nerd Font symbols.
- **Status line:** powerline separator; left `time_spent`, `path`, `model`; right `token_in`, `cache_read`, `cache_hit`, `token_out`, `cost`, `token_rate`.
- **Composer:** `omz` shape.
- **Updates:** automatic.

Model roles are machine-specific. Edit `modelRoles` for the providers authenticated on each machine.

### `mcp.json`

A portable template matching the live server set:

- **Context7** — library/framework docs via `npx @upstash/context7-mcp`.
- **Cloudflare** — infrastructure/DNS/tunnels via `npx @cloudflare/mcp-server-cloudflare`.
- **Playwright** — browser automation via `npx @playwright/mcp`.
- **Stitch** — Google Stitch HTTP MCP; key read from `~/secrets/stitch_api_key`.
- **REA** — reverse-engineering agent over stdio; replace `<HERMES_NODE>`, `<REA_SCRIPT>`, `<GHIDRA_INSTALL_DIR>`, and `<JAVA_HOME>`.

Replace `<CLOUDFLARE_ACCOUNT_ID>` and export `CONTEXT7_API_KEY`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID` before launching OMP. The live machine's `mcp.json` holds concrete values; this file is a template and is not installed by default. See `MCP.md` for the installed inventory, including the other harnesses on the source machine.

### `AGENTS.md`

Standing agent directives: evidence-first posture, minimal diffs, trace-before-edit, clean cutovers, verification before completion, and Context7 usage. Copy it to `~/.omp/agent/AGENTS.md` or merge it into an existing file.

## Extensions

### Core

**`omz-theme.ts`** — Powerlevel10k-style UI:

- Top ribbon: elapsed time, shortened `$HOME` path, DeepSeek peak/off-peak chip with countdown, separate model and thinking-effort chips.
- Metrics ribbon: fresh input, cached tokens, cache-hit rate, output tokens, live tok/s badge.
- Counters accumulate per assistant message and survive replayed/resumed branches; streaming estimates repaint ~4×/second.
- `/reset-tokens` rebases the panel without clearing the ledger.
- Dark palette with ≥5.5:1 contrast; emoji counted as two cells for alignment.

**`jev-security.ts`** — guardrails:

- Intercepts `bash`, `write`, `edit`, `eval`; scores risk with TypeSafe Jev (`oc/jev-1.13-free`).
- Redacts JWTs, API keys, private keys, and credential assignments.
- Classifies post-execution failures (permission, syntax, transient, code bug).
- Exposes `system_one_judge` for sub-250ms probability, choice, and rubric calls.
- `/jev` toggles the layer; flagged actions offer block, allow-once, or allow-all-this-session.

### Optional / legacy

These predate `omz-theme.ts` and overlap with its metrics. Install with `--all` / `-All` only if you want their standalone commands and cards.

**`tps.ts`** — live TPS/TTFT widget; `/tps`, `/tps-reset`.

**`deepseek-hours.ts`** — DeepSeek peak/off-peak card above the editor; `/deepseek-card`, `/deepseek-hours`; `deepseek_pricing_status` tool.

**`model-cost.ts`** — per-model token/cost list card; `/cost`, `/cost-card`, `/cost-reset`; `session_cost_breakdown` tool.

## Skills

`skills/` vendors four sets:

- `skills/installed/` — every skill installed in `~/Skills` on the source machine (122).
- `skills/mattpocock/` — all Matt Pocock skills (40).
- `skills/pstack/` — generic pstack skills (58); Cursor and Claude Code harness copies excluded.
- `skills/anthropic/` — Anthropic skills excluding Claude-specific ones (16).

See `skills/README.md` for sources, licenses, and exclusions. Each skill is a directory containing `SKILL.md`; copy or symlink the ones you want into your OMP skills directory.

## Auto-sync (macOS)

On a machine where this clone is the source of truth, `sync.sh` keeps the live files symlinked into the repository and pushes changes.

| Live path | Repository path |
| --- | --- |
| `~/.omp/agent/config.yml` | `config.yml` |
| `~/.omp/agent/extensions/omz-theme.ts` | `extensions/omz-theme.ts` |
| `~/.omp/agent/extensions/jev-security.ts` | `extensions/jev-security.ts` |
| `~/.omp/agent/extensions/tps.ts` | `extensions/tps.ts` |
| `~/.omp/agent/extensions/deepseek-hours.ts` | `extensions/deepseek-hours.ts` |
| `~/.omp/agent/extensions/model-cost.ts` | `extensions/model-cost.ts` |

The launchd agent `com.aaxyat.omp-config-sync` runs `sync.sh` every 15 seconds. It:

- repairs symlinks if an editor or installer replaced one with a regular file;
- commits and pushes changes on `main`;
- rebases on `origin/main` before pushing;
- refuses to commit a diff that looks like a credential.

Run it manually after changing a file outside OMP:

```bash
~/aaxyat-OMP-Config/sync.sh
```

Logs live at `~/Library/Logs/omp-config-sync.log`. Remote changes are fetched at most every five minutes unless there is a local change to push.

On Windows, run `sync.sh` from Git Bash/WSL or wire it to Task Scheduler; there is no launchd.

## Repository structure

```
aaxyat-OMP-Config/
├── AGENTS.md
├── README.md
├── config.yml
├── mcp.json
├── MCP.md
├── install.sh
├── install.ps1
├── install.cmd
├── sync.sh
├── .gitignore
├── .gitattributes
├── skills/
│   ├── installed/
│   ├── mattpocock/
│   ├── pstack/
│   ├── anthropic/
│   └── licenses/
└── extensions/
    ├── omz-theme.ts
    ├── jev-security.ts
    ├── tps.ts
    ├── deepseek-hours.ts
    └── model-cost.ts
```

## Security

This repository is public. Keep API keys, tokens, and passwords out of `config.yml`, `mcp.json`, and `AGENTS.md`. `sync.sh` blocks obvious credential assignments, but it is not a substitute for care.
