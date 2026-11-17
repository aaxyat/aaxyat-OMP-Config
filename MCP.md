# MCP Servers

Inventory of MCP servers installed on the source machine.

## OMP (`~/.omp/agent/mcp.json`)

Managed by this repository through the sanitized `mcp.json` template.

| Server | Transport | Command / URL | Credentials |
| --- | --- | --- | --- |
| `context7` | stdio | `npx -y @upstash/context7-mcp` | `CONTEXT7_API_KEY` |
| `cloudflare` | stdio | `npx -y @cloudflare/mcp-server-cloudflare run <ACCOUNT_ID>` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| `playwright` | stdio | `npx -y @playwright/mcp@latest` | — |
| `stitch` | http | `https://stitch.googleapis.com/mcp` | `X-Goog-Api-Key` read from `~/secrets/stitch_api_key` |
| `rea` | stdio | `<HERMES_NODE> <REA_SCRIPT> mcp` | `GHIDRA_INSTALL_DIR`, `JAVA_HOME` |

The live `mcp.json` substitutes the placeholders with machine-local paths and account IDs. It is not committed.

## Other harnesses (reference only)

| Harness | Config | Servers |
| --- | --- | --- |
| Gemini / Antigravity | `~/.gemini/config/mcp_config.json` | `playwright`, `rea` |
| Claude Code | `~/.claude.json` | `wmux` |
| OpenCode | `~/.config/opencode/opencode.json` | `parallel-mcp`, `playwright`, `context7`, `cloudflare`, `canva`, `colab`, `stitch` |

Only the OMP `mcp.json` is managed here. The other harness configs are machine-local and may contain credentials; they are not committed.

## Adding a server

1. Add it to `mcp.json` with placeholders for any machine-local value.
2. Document it in the table above.
3. Run `./install.sh --all` or copy the file to `~/.omp/agent/mcp.json`.
