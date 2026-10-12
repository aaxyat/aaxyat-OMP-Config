# aaxyat-OMP-Config

Personal configuration, custom theme, and Jev security/System 1 judge extensions for **Oh My Pi (OMP)**.

## Features & Components

### 1. Visual Theme (`extensions/omz-theme.ts`)
- **Powerlevel10k top ribbon**: one continuous band of chips — rounded left cap, hard separators, hard tail.
  - **⏳ Elapsed time**: current turn run timer.
  - **📁 Directory**: shortened `$HOME`-relative path.
  - **🐳 DeepSeek window**: muted green off-peak / muted red peak chip with the countdown to the next pricing flip.
  - **Model & Thinking**: live model label and reasoning level, read from the session API rather than the host's status string, so `/model` switches and thinking-level changes appear immediately.
- **Powerlevel10k metrics ribbon** (below the input): one icon chip per counter, plus a right-anchored rate badge.
  - **📥 in**: fresh prompt tokens. **💾 cached**: tokens served from the prompt cache. **🎯 hit**: session cache hit rate, its own chip so the cached total and the rate never read as one number. **📤 out**: generated tokens. **⚡ badge**: live throughput in tok/s.
  - Counters accumulate from provider usage per assistant message, keyed by message identity, so replayed messages and resumed branches never double count.
  - While a turn streams, `out` and the rate move from streamed content (text, thinking, tool arguments) and repaint ~4×/second; the real usage replaces the estimate when the message lands.
  - `/reset-tokens` rebases the panel to zero without clearing the ledger, keeping the history reconciliation correct.
- **Breathing room**: one blank row above and below the typing area.
- **Zsh-Style Arrow Prompt**: Minimalist emerald `❯` prompt gutter.
- **Dark-theme palette**: seven mid-dark chip colors, each ≥5.5:1 contrast against the segment text (`BAR_*` constants at the top of the extension); emoji icons are counted as two cells so the ribbons stay aligned on wide terminals; transcript styling still comes from the `dark-monokai` theme and Nerd Font symbols.

### 2. Jev Security & System 1 Judge (`extensions/jev-security.ts`)
- **Pre-execution Guardrails**: Intercepts risky tools (`bash`, `write`, `edit`, `eval`) and scores risk using TypeSafe Jev (`oc/jev-1.13-free`).
- **Secret Redaction**: Automatic client-side masking of JWTs, API keys, private keys, and credential assignments.
- **Post-execution Failure Guidance**: Diagnoses command and tool errors into failure classes (permission, syntax, transient, code bugs).
- **System 1 Judge Tool**: Exposes `system_one_judge` tool for sub-250ms closed probability (`noul`), choice, and rubric evaluations.
---
## Instructions for AI Coding Agents

If you are an AI assistant / coding agent (OMP, Claude, Cursor, Copilot, etc.) asked to set up or replicate this environment on a new system:

### 1. Automated Installation Command
Run this non-interactive command directly in your bash tool:

```bash
curl -fsSL https://raw.githubusercontent.com/aaxyat/aaxyat-OMP-Config/main/install.sh | bash
```

### 2. What this command does:
- Creates the target directory `~/.omp/agent/extensions` if missing.
- Backs up any existing `~/.omp/agent/config.yml` with a timestamped extension (`.backup.YYYYMMDDHHMMSS`).
- Installs the `omz-theme.ts` Powerlevel10k theme extension.
- Installs the `jev-security.ts` guardrail and System 1 evaluation extension.
- Installs `config.yml` configuring the `omz` composer and `dark-monokai` palette.

### 3. Verification Steps for Agent:
Verify the installation succeeded by checking file existence:
```bash
test -f "$HOME/.omp/agent/extensions/omz-theme.ts" && \
test -f "$HOME/.omp/agent/extensions/jev-security.ts" && \
test -f "$HOME/.omp/agent/config.yml" && echo "OMP Config verified successfully."
```

### 4. Fallback: Manual Installation (If Auto-Install Fails)
If the automated curl command fails (e.g. network restrictions, proxy issues, or curl errors), execute the manual installation sequence:

```bash
# 1. Create target extensions directory
mkdir -p "$HOME/.omp/agent/extensions"

# 2. Clone repository or download individual files
git clone https://github.com/aaxyat/aaxyat-OMP-Config.git /tmp/omp-config-temp

# 3. Copy files to destination
cp /tmp/omp-config-temp/extensions/omz-theme.ts "$HOME/.omp/agent/extensions/omz-theme.ts"
cp /tmp/omp-config-temp/extensions/jev-security.ts "$HOME/.omp/agent/extensions/jev-security.ts"

# 4. Back up and install config.yml
if [ -f "$HOME/.omp/agent/config.yml" ]; then
  cp "$HOME/.omp/agent/config.yml" "$HOME/.omp/agent/config.yml.backup.$(date +%Y%m%d%H%M%S)"
fi
cp /tmp/omp-config-temp/config.yml "$HOME/.omp/agent/config.yml"

# 5. Clean up temporary clone
rm -rf /tmp/omp-config-temp
```

---

## Quick Install (One-Liner)

To import this configuration directly on any machine:

```bash
curl -fsSL https://raw.githubusercontent.com/aaxyat/aaxyat-OMP-Config/main/install.sh | bash
```

---

## Manual Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/aaxyat/aaxyat-OMP-Config.git
   cd aaxyat-OMP-Config
   ```

2. **Copy extension and config files:**
   ```bash
   mkdir -p ~/.omp/agent/extensions
   cp extensions/omz-theme.ts ~/.omp/agent/extensions/omz-theme.ts
   cp extensions/jev-security.ts ~/.omp/agent/extensions/jev-security.ts
   cp config.yml ~/.omp/agent/config.yml

3. **Restart or reload OMP** to apply changes.

---

## Repository Structure

```
├── README.md
├── install.sh
├── config.yml
└── extensions/
    ├── omz-theme.ts
    └── jev-security.ts
