#!/usr/bin/env bash
# Sync the live OMP agent configuration into this repository.
# Designed for launchd (macOS) but portable to cron/systemd timers.

set -uo pipefail

REPO="${OMP_CONFIG_REPO:-$HOME/aaxyat-OMP-Config}"
AGENT_DIR="${OMP_AGENT_DIR:-${PI_CODING_AGENT_DIR:-$HOME/.omp/agent}}"
BRANCH="${OMP_CONFIG_BRANCH:-main}"
FETCH_INTERVAL="${OMP_CONFIG_FETCH_INTERVAL:-300}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/omp-config-sync"
LOCK_DIR="$STATE_DIR/lock"

export GIT_TERMINAL_PROMPT=0
export GIT_ASKPASS=/usr/bin/false

mkdir -p "$STATE_DIR" || exit 1

log() { printf '%s omp-config-sync %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"; }

# Non-blocking lock. A run older than ten minutes is assumed to have crashed.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
	if [ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin +10 2>/dev/null)" ]; then
		rmdir "$LOCK_DIR" 2>/dev/null && mkdir "$LOCK_DIR" 2>/dev/null || exit 0
	else
		exit 0
	fi
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

[ -d "$REPO/.git" ] || { log "missing git repository: $REPO"; exit 1; }
cd "$REPO" || exit 1

# Keep the live files pointing at the repository. If an editor or installer
# replaced a symlink with a regular file, fold that file's contents back into
# the repository first, then relink.
link_file() {
	local target="$1" link="$2"
	[ -f "$target" ] || return 0
	if [ -L "$link" ] && [ "$(readlink "$link")" = "$target" ]; then
		return 0
	fi
	if [ -L "$link" ] || [ -e "$link" ]; then
		if [ -f "$link" ] && ! cmp -s "$link" "$target"; then
			cp -p "$link" "$target" || return 1
			log "folded loose $(basename "$link") into the repository"
		fi
		rm -f "$link" || return 1
	fi
	mkdir -p "$(dirname "$link")" || return 1
	ln -s "$target" "$link" || return 1
	log "relinked $(basename "$link")"
}

link_file "$REPO/config.yml" "$AGENT_DIR/config.yml" || exit 1
for name in omz-theme.ts jev-security.ts; do
	link_file "$REPO/extensions/$name" "$AGENT_DIR/extensions/$name" || exit 1
done

changed=0
if [ -n "$(git status --porcelain)" ]; then
	git add -A || exit 1
	# This repository is public; never publish something that looks like a
	# credential. A blocked run leaves the staged files in place for review.
	if git diff --cached --no-color -U0 | sed -n 's/^+//p' |
		grep -Eqi '(api[_-]?key|secret|password|passwd|private[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)[[:space:]]*[:=][[:space:]]*[^[:space:]]'; then
		git reset -q
		log "refusing to commit: staged diff looks like it contains a credential"
		exit 1
	fi
	if ! git commit -q -m "chore: sync OMP config ($(hostname -s 2>/dev/null || hostname))"; then
		log "commit failed"
		exit 1
	fi
	changed=1
	log "committed $(git rev-parse --short HEAD)"
fi

last_fetch_file="$STATE_DIR/last-fetch"
now=$(date +%s)
last_fetch=0
[ -f "$last_fetch_file" ] && last_fetch=$(cat "$last_fetch_file" 2>/dev/null || echo 0)
case "$last_fetch" in '' | *[!0-9]*) last_fetch=0 ;; esac

if [ "$changed" -eq 0 ] && [ $((now - last_fetch)) -lt "$FETCH_INTERVAL" ]; then
	exit 0
fi

if ! git fetch -q origin "$BRANCH"; then
	log "fetch failed"
	exit 1
fi
printf '%s\n' "$now" >"$last_fetch_file"

# Rebase local commits on top of remote changes. A conflict aborts the rebase
# and leaves the local commit intact for inspection.
if ! git rebase -q "origin/$BRANCH"; then
	git rebase --abort >/dev/null 2>&1 || true
	log "rebase conflict against origin/$BRANCH; resolve manually in $REPO"
	exit 1
fi

if [ -n "$(git log --oneline "origin/$BRANCH..HEAD")" ]; then
	if git push -q origin "HEAD:$BRANCH"; then
		log "pushed $(git rev-parse --short HEAD)"
	else
		log "push failed"
		exit 1
	fi
fi

exit 0
