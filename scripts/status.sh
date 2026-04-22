#!/usr/bin/env bash
# Visar status för Trygghetsnod-stacken.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Docker (kiwix) ==="
docker compose -f "$ROOT/compose.yaml" ps 2>/dev/null || echo "(ingen compose-stack uppe)"
echo

echo "=== Portal ==="
PID_FILE="${ROOT}/storage/logs/portal.pid"
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "node portal: pid $(cat "$PID_FILE") — uppe"
else
  echo "node portal: inte igång"
fi
echo

echo "=== Endpoints ==="
curl -s -o /dev/null -w "  http://localhost:8090 (kiwix)   → %{http_code}\n" http://localhost:8090/ || echo "  kiwix: ingen kontakt"
curl -s -o /dev/null -w "  http://localhost:8400/healthz  → %{http_code}\n" http://localhost:8400/healthz || echo "  portal: ingen kontakt"
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
