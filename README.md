# aaxyat-OMP-Config

Personal configuration and custom theme extension for **Oh My Pi (OMP)**.

## Visual Highlights

- **Powerlevel10k Rainbow Band**: Segmented color-coded top band inspired by Powerlevel10k.
  -  **Execution Timer**: Real-time prompt run timer.
  -  **Directory**: Shortened path display.
  - 🐳 **DeepSeek Window**: Automatic peak / off-peak countdown indicator.
  -  **Model & Thinking**: Live active model and thinking mode status.
  -  **Token Rate**: Stream speed badge (tok/s).
- **Zsh-Style Arrow Prompt**: Minimalist emerald `❯` prompt gutter.
- **Monokai Palette**: Styled with `dark-monokai` syntax and Nerd Font symbols.

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
   cp config.yml ~/.omp/agent/config.yml
   ```

3. **Restart or reload OMP** to apply changes.

---

## Repository Structure

```
├── README.md
├── install.sh
├── config.yml
└── extensions/
    └── omz-theme.ts
```
