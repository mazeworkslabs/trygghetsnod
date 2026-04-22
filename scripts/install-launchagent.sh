#!/usr/bin/env bash
# Installerar Trygghetsnod som macOS LaunchAgent → startar vid inloggning.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/scripts/se.mazeworks.trygghetsnod.plist"
DEST_DIR="${HOME}/Library/LaunchAgents"
DEST="${DEST_DIR}/se.mazeworks.trygghetsnod.plist"

if [[ ! -f "$SRC" ]]; then
  echo "Saknar $SRC" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
mkdir -p "${ROOT}/storage/logs"

# Skriv över ev. tidigare installation
if [[ -f "$DEST" ]]; then
  echo "→ Tar bort tidigare LaunchAgent…"
  launchctl unload "$DEST" 2>/dev/null || true
fi

cp "$SRC" "$DEST"
echo "→ Installerade $DEST"

launchctl load "$DEST"
echo "→ Laddade LaunchAgent. Stacken startas vid varje inloggning."
echo
echo "Manuella kommandon:"
echo "  launchctl start  se.mazeworks.trygghetsnod"
echo "  launchctl stop   se.mazeworks.trygghetsnod"
echo "  launchctl unload $DEST"
