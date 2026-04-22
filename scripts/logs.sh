#!/usr/bin/env bash
# Tail på portal- och Kiwix-loggar samtidigt.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="${ROOT}/storage/logs/portal.log"

if [[ ! -f "$LOG_FILE" ]]; then
  echo "(ingen portal-logg ännu på $LOG_FILE — starta med scripts/start.sh)"
fi

# Streama portal + docker logs i samma terminal. Ctrl-C avbryter.
( tail -F "$LOG_FILE" 2>/dev/null | sed -u 's/^/[portal] /' ) &
TAIL_PID=$!
trap "kill $TAIL_PID 2>/dev/null || true" EXIT INT TERM

docker compose -f "$ROOT/compose.yaml" logs -f --tail=20 kiwix 2>&1 | sed -u 's/^/[kiwix]  /'
