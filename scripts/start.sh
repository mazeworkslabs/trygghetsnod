#!/usr/bin/env bash
# Startar Trygghetsnod-stacken native: Postgres (brew service) + Kiwix + portal.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KOMMUN="${KOMMUN:-arvika}"
LOG_DIR="${ROOT}/storage/logs"
mkdir -p "$LOG_DIR"

PORTAL_PID="${LOG_DIR}/portal.pid"
PORTAL_LOG="${LOG_DIR}/portal.log"
KIWIX_PID="${LOG_DIR}/kiwix.pid"
KIWIX_LOG="${LOG_DIR}/kiwix.log"

cd "$ROOT"

ensure_postgres() {
  if ! command -v brew >/dev/null 2>&1; then
    echo "brew saknas — kan inte hantera postgres" >&2
    return 1
  fi
  if ! brew services list 2>/dev/null | grep -qE "^postgresql@16[[:space:]]+started"; then
    echo "→ Startar Postgres (brew service)…"
    brew services start postgresql@16 >/dev/null
  fi
  for _ in $(seq 1 30); do
    if pg_isready -h localhost -p 5432 -U "$USER" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Postgres svarar inte efter 30s" >&2
  return 1
}

ensure_database() {
  if psql -h localhost -p 5432 -U "$USER" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw trygghetsnod; then
    return 0
  fi
  echo "→ Skapar databas 'trygghetsnod'…"
  createdb -h localhost -p 5432 -U "$USER" trygghetsnod
}

start_kiwix() {
  if [[ -f "$KIWIX_PID" ]] && kill -0 "$(cat "$KIWIX_PID")" 2>/dev/null; then
    echo "→ Kiwix kör redan (pid $(cat "$KIWIX_PID"))."
    return 0
  fi
  if ! command -v kiwix-serve >/dev/null 2>&1; then
    echo "kiwix-serve saknas — kör 'brew install kiwix-tools'" >&2
    return 1
  fi
  echo "→ Startar Kiwix (port 8090)…"
  nohup kiwix-serve \
    --port=8090 \
    --monitorLibrary \
    --library "$ROOT/storage/zim/kiwix-library.xml" \
    >> "$KIWIX_LOG" 2>&1 &
  echo $! > "$KIWIX_PID"
  sleep 1
}

start_portal() {
  if [[ -f "$PORTAL_PID" ]] && kill -0 "$(cat "$PORTAL_PID")" 2>/dev/null; then
    echo "→ Portal kör redan (pid $(cat "$PORTAL_PID"))."
    return 0
  fi
  echo "→ Startar portal (kommun=$KOMMUN, port 8400)…"
  cd "$ROOT/trygghetsnod-portal"
  KOMMUN="$KOMMUN" PGUSER="$USER" nohup node src/server.js >> "$PORTAL_LOG" 2>&1 &
  echo $! > "$PORTAL_PID"
  sleep 1
  cd "$ROOT"
}

ensure_postgres
ensure_database
start_kiwix
start_portal

echo
"$ROOT/scripts/status.sh"
