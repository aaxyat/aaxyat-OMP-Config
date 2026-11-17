# Skills

Vendored snapshot of the skills installed on the source machine and the upstream sets requested for the OMP base configuration.

## Sets

| Directory | Contents | Count |
| --- | --- | --- |
| `installed/` | Every skill symlinked in `~/Skills` on the source machine | 122 |
| `mattpocock/` | All `mattpocock/skills` skills | 40 |
| `pstack/` | Generic pstack skills; Cursor and Claude Code harness copies excluded | 58 |
| `anthropic/` | Anthropic skills excluding Claude-specific ones | 16 |

## Sources

| Source | URL | License |
| --- | --- | --- |
| Anthropic skills | https://github.com/anthropics/skills | No root license file in the vendored checkout |
| Matt Pocock skills | https://github.com/mattpocock/skills | `licenses/mattpocock-LICENSE` |
| pstack (cursor/plugins) | https://github.com/cursor/plugins | `licenses/cursor-pstack-LICENSE` |
| Cursor team kit | https://github.com/cursor/plugins | `licenses/cursor-cursor-team-kit-LICENSE` |
| Cursor CLI for agents | https://github.com/cursor/plugins | `licenses/cursor-cli-for-agent-LICENSE` |
| Superpowers | https://github.com/obra/superpowers | `licenses/superpowers-LICENSE` |
| Caveman | https://github.com/JuliusBrussee/caveman | `licenses/caveman-LICENSE`, `licenses/caveman-LICENSE.BSL` |
| Ponytail | https://github.com/dietrichgebert/ponytail | `licenses/ponytail-LICENSE` |
| Custom | Local `~/Documents/Projects/Skills/custom` | User-authored |

## Exclusions

- `installed/claude-api` — Claude-specific; contains credential-shaped examples.
- `anthropic/academy-guide`, `anthropic/claude-api`, `anthropic/web-artifacts-builder` — Claude-specific.
- `pstack` `harness/cursor` and `harness/claude-code` — generated harness copies; the generic `pstack/skills` set is included.

## Usage

Each skill is a directory containing `SKILL.md`. Copy or symlink the desired directories into the OMP skills directory (`~/.omp/skills`, `~/.omp/agent/skills`, or `~/Skills`, depending on the harness). The `installed/` set mirrors the source machine's `~/Skills` hub; the other sets are complete upstream collections.
