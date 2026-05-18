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

# AppleScript-källa
TMP_SCPT="$(mktemp -t trygghetsnod-admin.XXXXXX).applescript"
cat > "$TMP_SCPT" <<APPLESCRIPT
on run
    set healthURL to "${HEALTH_URL}"
    set adminURL to "${ADMIN_URL}"
    repeat 60 times
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

# Registrera som Login Item (rensar tidigare entry först)
osascript <<EOF
tell application "System Events"
    try
        delete (every login item whose name is "${APP_NAME}")
    end try
    make login item at end with properties {path:"${APP_PATH}", hidden:false}
end tell
EOF
echo "→ Registrerade ${APP_NAME} som Login Item"

echo
echo "Klart. Vid nästa inloggning:"
echo "  1. LaunchAgent startar Trygghetsnod-stacken"
echo "  2. ${APP_NAME} öppnar Safari på ${ADMIN_URL}"
echo
echo "Lägg till i Dock genom att dra ${APP_PATH} till Dock-en."
echo "Manuell körning: open '${APP_PATH}'"
