#!/usr/bin/env bash
# Stoppar portal + Kiwix.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="${ROOT}/storage/logs/portal.pid"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "→ Stoppar portal (pid $PID)…"
    kill "$PID" || true
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

# Säkerhetsnät: döda eventuell kvarlevande nodprocess
pkill -f "node src/server.js" 2>/dev/null || true

echo "→ Stoppar Kiwix (docker compose down)…"
cd "$ROOT"
docker compose down

echo "Klart."
