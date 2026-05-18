#!/usr/bin/env bash
# Skapar en klickbar "Trygghetsnod Admin.app" som öppnar Safari på admin-URL:en,
# och registrerar den som Login Item så den startar automatiskt vid inloggning.
#
# Appen väntar upp till 60s på att portalen ska svara innan Safari öppnas —
# så den fungerar både direkt vid uppstart (då stacken precis startat) och senare.
set -euo pipefail

APP_NAME="Trygghetsnod Admin"
APP_DIR="${HOME}/Applications"
APP_PATH="${APP_DIR}/${APP_NAME}.app"
ADMIN_URL="${ADMIN_URL:-http://localhost:8400/admin}"
HEALTH_URL="${HEALTH_URL:-http://localhost:8400/healthz}"

mkdir -p "$APP_DIR"

# AppleScript-källa.
#
# När man klickar på ikonen:
#   1. Startar Trygghetsnod-stacken (idempotent — gör inget om den redan kör)
#   2. Väntar upp till 90s på att portalen ska svara (täcker kall Colima-start)
#   3. Öppnar Safari på admin-sidan
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
START_SCRIPT="${ROOT_DIR}/scripts/start.sh"
TMP_SCPT="$(mktemp -t trygghetsnod-admin.XXXXXX).applescript"
cat > "$TMP_SCPT" <<APPLESCRIPT
on run
    set healthURL to "${HEALTH_URL}"
    set adminURL to "${ADMIN_URL}"
    set startScript to "${START_SCRIPT}"
    -- Starta stacken i bakgrunden (no-op om redan uppe)
    try
        do shell script "zsh -lc " & quoted form of (quoted form of startScript) & " > /tmp/trygghetsnod-startup.log 2>&1 &"
    end try
    -- Vänta upp till 90s på portalen (Colima kallstart tar ~12-15s)
    repeat 90 times
        try
            do shell script "curl -fsS " & quoted form of healthURL & " >/dev/null 2>&1"
            exit repeat
        on error
            delay 1
        end try
    end repeat
    tell application "Safari"
        activate
        try
            make new document with properties {URL:adminURL}
        on error
            set URL of current tab of front window to adminURL
        end try
    end tell
end run
APPLESCRIPT

rm -rf "$APP_PATH"
osacompile -o "$APP_PATH" "$TMP_SCPT"
rm -f "$TMP_SCPT"
echo "→ Skapade ${APP_PATH}"

# Rensa eventuell tidigare Login Item-entry — vi använder click-to-start istället
osascript <<EOF
tell application "System Events"
    try
        delete (every login item whose name is "${APP_NAME}")
    end try
end tell
EOF

echo
echo "Klart. Användarflöde:"
echo "  1. Klicka på '${APP_NAME}' i Dock"
echo "  2. Stacken startas (1–15 sek beroende på om Colima redan kör)"
echo "  3. Safari öppnas på ${ADMIN_URL}"
echo
echo "Lägg till i Dock: dra ${APP_PATH} till Dock-en."
echo "Bonus — Safari Web App-läge utan browser-chrome:"
echo "  Öppna admin i Safari → File → Add to Dock → bekräfta → done."
