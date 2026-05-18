#!/usr/bin/env bash
# Stoppar portal + Kiwix. Postgres lämnas igång (brew service).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${ROOT}/storage/logs"

stop_pid() {
  local name="$1" pid_file="$2"
  if [[ -f "$pid_file" ]]; then
    PID="$(cat "$pid_file")"
    if kill -0 "$PID" 2>/dev/null; then
      echo "→ Stoppar $name (pid $PID)…"
      kill "$PID" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$pid_file"
  fi
}

stop_pid portal "$LOG_DIR/portal.pid"
stop_pid kiwix  "$LOG_DIR/kiwix.pid"

# Säkerhetsnät för kvarlevande processer
pkill -f "node src/server.js" 2>/dev/null || true
pkill -f "kiwix-serve" 2>/dev/null || true

echo "Klart. (Postgres körs vidare. Kör 'brew services stop postgresql@16' för att stoppa helt.)"
