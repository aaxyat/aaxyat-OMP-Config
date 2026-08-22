# Agent Directives

## Secrets
- Location: `~/secrets/`.
- STRICT RULE: NEVER read, inspect, print, send, or transfer files/data from `~/secrets/` to models, logs, prompts, or external endpoints.

## Scripts & Privileges
- Reusable scripts: `/opt/agents/scripts/`.
- Sudo execution: Use `/opt/agents/scripts/run-sudo.sh <cmd>` for privileged actions without credential exposure.

## Cloudflare Scope
- STRICT RULE: NEVER invoke Cloudflare AI (Workers AI, inference, embeddings, text/image gen) unless explicitly ordered.
- Allowed scope: Infrastructure, DNS, and Tunnels only.

## Documentation & Dotfiles Maintenance
- Master record: `/home/aaxyat/HOMELAB_SETUP.md`.
- Rule: Update `~/HOMELAB_SETUP.md` on every setup, package, service, route, or configuration change.
- YADM: Commit and push dotfiles changes (`yadm commit` & `yadm push`) whenever shell, terminal, editor, or system configurations change.
- Format: Keep `AGENTS.md` and docs compressed, dense, and terse. No fluff.
