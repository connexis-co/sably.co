#!/bin/sh
# Brings the stack back when Docker's own restart gives up. In October 2026 the host's OOM
# killer took the container twice and the automatic restart failed both times ("failed to find
# host side interface", "task already exists"), leaving the site down for 17-18 hours.
# Runs every minute from cron as root. `touch <stack>/.maintenance` pauses it.
set -u
STACK=${1:-/opt/stacks/sably-emdash}
LOG=${SABLY_WATCHDOG_LOG:-/var/log/sably-emdash-watchdog.log}
log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG"; }

exec 9> /run/lock/sably-emdash-watchdog.lock || exit 0
flock -n 9 || exit 0
touch /run/sably-emdash-watchdog.last
[ -e "$STACK/.maintenance" ] && exit 0
cd "$STACK" || exit 0

container() { docker compose ps -aq emdash 2>/dev/null | head -n 1; }
status() { docker inspect --format '{{.State.Status}}' "$1" 2>/dev/null; }

id=$(container)
# `docker compose down` removes the container on purpose; never undo that.
[ -n "$id" ] || exit 0
case "$(status "$id")" in exited|dead|created) ;; *) exit 0 ;; esac

log "container is $(status "$id") (exit $(docker inspect --format '{{.State.ExitCode}}' "$id" 2>/dev/null)); starting it"
docker compose up -d >> "$LOG" 2>&1
sleep 10
if [ "$(status "$(container)")" = running ]; then log "started"; exit 0; fi
log "start failed; recreating the container (the data lives in the volume)"
if docker compose up -d --force-recreate >> "$LOG" 2>&1; then log "recreated"; else log "recreate failed"; fi
