#!/usr/bin/env bash
# Startar Trygghetsnod-stacken: Kiwix (Docker) + portal (native node).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KOMMUN="${KOMMUN:-arvika}"
LOG_DIR="${ROOT}/storage/logs"
PID_FILE="${LOG_DIR}/portal.pid"
LOG_FILE="${LOG_DIR}/portal.log"

mkdir -p "$LOG_DIR"

cd "$ROOT"

echo "→ Startar Kiwix (docker compose up -d)…"
docker compose up -d

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "→ Portal kör redan (pid $(cat "$PID_FILE"))."
else
  echo "→ Startar portal (kommun=$KOMMUN, port 8400)…"
  cd "$ROOT/trygghetsnod-portal"
  KOMMUN="$KOMMUN" nohup node src/server.js >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1
fi

echo
"$ROOT/scripts/status.sh"
