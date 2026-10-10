# aaxyat-OMP-Config

Personal configuration, custom theme, and Jev security/System 1 judge extensions for **Oh My Pi (OMP)**.

## Features & Components

### 1. Visual Theme (`extensions/omz-theme.ts`)
- **Powerlevel10k Rainbow Band**: Segmented color-coded top band inspired by Powerlevel10k.
  -  **Execution Timer**: Real-time prompt run timer.
  -  **Directory**: Shortened path display.
  - 🐳 **DeepSeek Window**: Automatic peak / off-peak countdown indicator.
  -  **Model & Thinking**: Live active model and thinking mode status.
  -  **Token Rate**: Stream speed badge (tok/s).
- **Zsh-Style Arrow Prompt**: Minimalist emerald `❯` prompt gutter.
- **Monokai Palette**: Styled with `dark-monokai` syntax and Nerd Font symbols.

### 2. Jev Security & System 1 Judge (`extensions/jev-security.ts`)
- **Pre-execution Guardrails**: Intercepts risky tools (`bash`, `write`, `edit`, `eval`) and scores risk using TypeSafe Jev (`oc/jev-1.13-free`).
- **Secret Redaction**: Automatic client-side masking of JWTs, API keys, private keys, and credential assignments.
- **Post-execution Failure Guidance**: Diagnoses command and tool errors into failure classes (permission, syntax, transient, code bugs).
- **System 1 Judge Tool**: Exposes `system_one_judge` tool for sub-250ms closed probability (`noul`), choice, and rubric evaluations.
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
