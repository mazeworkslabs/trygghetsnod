#!/usr/bin/env bash
# Installerar Trygghetsnod som macOS LaunchAgent → startar vid inloggning.
# Substituerar __ROOT__ och __KOMMUN__ i plist-template till faktiska värden.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/scripts/se.mazeworks.trygghetsnod.plist"
DEST_DIR="${HOME}/Library/LaunchAgents"
DEST="${DEST_DIR}/se.mazeworks.trygghetsnod.plist"
KOMMUN="${KOMMUN:-arvika}"

if [[ ! -f "$SRC" ]]; then
  echo "Saknar $SRC" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
mkdir -p "${ROOT}/storage/logs"

if [[ -f "$DEST" ]]; then
  echo "→ Tar bort tidigare LaunchAgent…"
  launchctl unload "$DEST" 2>/dev/null || true
fi

# Substituera placeholders → installerad plist
sed -e "s|__ROOT__|${ROOT}|g" -e "s|__KOMMUN__|${KOMMUN}|g" "$SRC" > "$DEST"
echo "→ Installerade $DEST (KOMMUN=$KOMMUN, ROOT=$ROOT)"

launchctl load "$DEST"
echo "→ Laddade LaunchAgent. Stacken startas vid varje inloggning."
echo
echo "Manuella kommandon:"
echo "  launchctl start  se.mazeworks.trygghetsnod"
echo "  launchctl stop   se.mazeworks.trygghetsnod"
echo "  launchctl unload $DEST"
