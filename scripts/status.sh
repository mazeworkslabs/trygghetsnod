#!/usr/bin/env bash
# Visar status för Trygghetsnod-stacken.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${ROOT}/storage/logs"

check_pid() {
  local name="$1" pid_file="$2"
  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "  $name: pid $(cat "$pid_file") — uppe"
  else
    echo "  $name: inte igång"
  fi
}

echo "=== Processer ==="
check_pid "node portal " "$LOG_DIR/portal.pid"
check_pid "kiwix-serve" "$LOG_DIR/kiwix.pid"
if brew services list 2>/dev/null | grep -qE "^postgresql@16[[:space:]]+started"; then
  echo "  postgres (brew service): started"
else
  echo "  postgres (brew service): NOT started"
fi
echo

echo "=== Endpoints ==="
curl -s -o /dev/null -w "  http://localhost:8090 (kiwix)     → %{http_code}\n" http://localhost:8090/ || echo "  kiwix: ingen kontakt"
curl -s -o /dev/null -w "  http://localhost:8400/healthz    → %{http_code}\n" http://localhost:8400/healthz || echo "  portal: ingen kontakt"
if pg_isready -h localhost -p 5432 -U "$USER" >/dev/null 2>&1; then
  echo "  postgres (forum-DB på :5432)     → OK"
else
  echo "  postgres: ingen kontakt"
fi
echo

if curl -sf http://localhost:8400/api/admin/status >/dev/null 2>&1; then
  echo "=== Sammanfattning (/api/admin/status) ==="
  curl -s http://localhost:8400/api/admin/status | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f\"  Kommun:   {d['kommun']}\")
print(f\"  Portal:   uppe {d['portal']['uptime_seconds']:.0f} s\")
print(f\"  Kiwix:    {d['kiwix']['books']} böcker, {d['kiwix']['latency_ms']} ms\")
gb = lambda b: f'{b/1024**3:.1f} GB'
print(f\"  Lagring:  {gb(d['storage']['free_bytes'])} ledigt av {gb(d['storage']['total_bytes'])}\")
print(f\"  ZIM:      {gb(d['storage']['zim_bytes'])}\")
print(f\"  Maps:     {gb(d['storage']['maps_bytes'])}\")
u = d.get('update')
if u:
  print(f\"  Lägesupp: '{u['title']}' ({u['severity']})\")
"
fi
