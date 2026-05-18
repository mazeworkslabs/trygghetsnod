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

# Säkerställ att Colima (docker-runtime) är uppe — vid kallstart hinner inte
# LaunchAgent köra start.sh efter att Colima startat.
ensure_colima() {
  if ! command -v colima >/dev/null 2>&1; then
    echo "→ colima saknas — antar att docker-daemon redan körs"
    return 0
  fi
  if colima status >/dev/null 2>&1; then
    return 0
  fi
  echo "→ Startar Colima…"
  colima start --cpu 4 --memory 4 >/dev/null
  # Vänta tills docker-socket svarar
  for _ in $(seq 1 30); do
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Colima/docker svarar inte efter 30s" >&2
  return 1
}
ensure_colima

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
