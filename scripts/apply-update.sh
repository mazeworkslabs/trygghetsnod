#!/usr/bin/env bash
# Applicerar en release-bundle på den lokala Trygghetsnod-enheten.
#
# Användning:   apply.sh                          (om körd från bundle-roten)
#               apply.sh /sökväg/till/bundle      (annars)
#
# Säkerhet:     idempotent. Backupar nuvarande version till
#               ~/Trygghetsnod-backups/<timestamp>/ innan ändringar.
# Rollback:     apply.sh ~/Trygghetsnod-backups/<timestamp>/
set -euo pipefail

# ---- Resolv bundle och install-target ----

if [[ $# -ge 1 ]]; then
  BUNDLE="$(cd "$1" && pwd)"
else
  BUNDLE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [[ ! -f "$BUNDLE/RELEASE.json" || ! -f "$BUNDLE/code.tar.gz" ]]; then
  echo "Bundle saknar RELEASE.json eller code.tar.gz: $BUNDLE" >&2
  exit 1
fi

# Mac mini har repot under ~/Code/trygghetsnod (se hardware-setup/stack-install.md)
INSTALL_DIR="${TRYGGHETSNOD_HOME:-$HOME/Code/trygghetsnod}"
BACKUPS_DIR="$HOME/Trygghetsnod-backups"

if [[ ! -d "$INSTALL_DIR" ]]; then
  echo "Hittar inte $INSTALL_DIR" >&2
  echo "Sätt TRYGGHETSNOD_HOME om enheten har repot någon annanstans." >&2
  exit 1
fi

# ---- Verktyg ----

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

json_get() {
  # Mycket enkel JSON-läsare: json_get <fil> <nyckelväg>
  # Klarar enkla strängvärden — RELEASE.json har avsiktligt platt struktur.
  python3 -c "
import json, sys
d = json.load(open(sys.argv[1]))
for k in sys.argv[2].split('.'):
    d = d[k] if isinstance(d, dict) else d[int(k)]
print(d if d is not None else '')
" "$1" "$2" 2>/dev/null || echo ""
}

# ---- Validera bundle ----

VERSION="$(json_get "$BUNDLE/RELEASE.json" version)"
RELEASED_AT="$(json_get "$BUNDLE/RELEASE.json" released_at)"
NEW_GIT_SHA="$(json_get "$BUNDLE/RELEASE.json" code.git_sha)"
EXPECTED_CODE_SUM="$(json_get "$BUNDLE/RELEASE.json" code.sha256)"

if [[ -z "$VERSION" || -z "$NEW_GIT_SHA" ]]; then
  echo "RELEASE.json saknar version/git_sha." >&2
  exit 1
fi

echo "==============================================="
echo " Trygghetsnod — applicera $VERSION"
echo "==============================================="
echo "  Bundle:   $BUNDLE"
echo "  Bygd:     $RELEASED_AT"
echo "  SHA:      $NEW_GIT_SHA"
echo "  Install:  $INSTALL_DIR"
echo

if [[ -n "$EXPECTED_CODE_SUM" ]]; then
  echo "→ Verifierar checksumma för code.tar.gz…"
  ACTUAL_SUM="$(sha256_of "$BUNDLE/code.tar.gz")"
  if [[ "$ACTUAL_SUM" != "$EXPECTED_CODE_SUM" ]]; then
    echo "  Checksumma stämmer inte!" >&2
    echo "  Förväntat: $EXPECTED_CODE_SUM" >&2
    echo "  Faktiskt:  $ACTUAL_SUM" >&2
    exit 1
  fi
fi

CURRENT_VERSION="$(json_get "$INSTALL_DIR/storage/applied.json" version 2>/dev/null || echo "okänd")"
echo "  Nuvarande version på enheten: $CURRENT_VERSION"
echo

read -r -p "Fortsätta? [j/N] " ans
case "$ans" in
  j|J|y|Y) ;;
  *) echo "Avbruten." ; exit 0 ;;
esac

# ---- Backup ----

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUPS_DIR/${CURRENT_VERSION}-${TIMESTAMP}"
mkdir -p "$BACKUP_DIR/storage/zim" "$BACKUP_DIR/storage/maps"

echo "→ Backupar nuvarande version till $BACKUP_DIR"

# Tarball av nuvarande kod (samma form som en bundle, så backupen kan applicaras tillbaka)
( cd "$INSTALL_DIR" && tar --exclude='node_modules' \
                          --exclude='dist' \
                          --exclude='dist-ssr' \
                          --exclude='storage' \
                          --exclude='.git' \
                          --exclude='releases' \
                          -czf "$BACKUP_DIR/code.tar.gz" . )

# Kopiera nuvarande zim/maps
[[ -d "$INSTALL_DIR/storage/zim" ]]  && rsync -a --exclude='.DS_Store' "$INSTALL_DIR/storage/zim/"  "$BACKUP_DIR/storage/zim/"
[[ -d "$INSTALL_DIR/storage/maps" ]] && rsync -a --exclude='.DS_Store' "$INSTALL_DIR/storage/maps/" "$BACKUP_DIR/storage/maps/"

# Kopiera apply-skriptet och en RELEASE.json så backupen går att applicera tillbaka
cp "${BASH_SOURCE[0]}" "$BACKUP_DIR/apply.sh"
chmod +x "$BACKUP_DIR/apply.sh"

if [[ -f "$INSTALL_DIR/storage/applied.json" ]]; then
  cp "$INSTALL_DIR/storage/applied.json" "$BACKUP_DIR/RELEASE.json"
else
  cat > "$BACKUP_DIR/RELEASE.json" <<EOF
{
  "version": "backup-pre-$VERSION-$TIMESTAMP",
  "released_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "notes": "Automatisk backup taget innan applicering av $VERSION"
}
EOF
fi

# ---- Stoppa stacken ----

echo "→ Stoppar stacken…"
"$INSTALL_DIR/scripts/stop.sh" || true

# ---- Byt ut kod ----

echo "→ Byter ut kod (bevarar kommuner/, storage/, .git, node_modules, dist)…"

# Extrahera bundle-koden till temp-mapp
TMP_CODE="$(mktemp -d)"
trap 'rm -rf "$TMP_CODE"' EXIT
tar -xzf "$BUNDLE/code.tar.gz" -C "$TMP_CODE"

# Synca, men håll runtime-data orörd. --delete tar bort filer i target som
# inte finns i source — bra för att städa bort raderade källfiler — men vi
# excluderar runtime-mappar så de aldrig tas bort.
rsync -a --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='dist-ssr' \
  --exclude='storage' \
  --exclude='kommuner' \
  --exclude='releases' \
  "$TMP_CODE/" "$INSTALL_DIR/"

# ---- Byt ut innehållet (zim + maps) — behåll postgres + logs ----

if [[ -d "$BUNDLE/storage/zim" ]]; then
  echo "→ Byter ut storage/zim/…"
  mkdir -p "$INSTALL_DIR/storage/zim"
  rsync -a --delete --exclude='.DS_Store' "$BUNDLE/storage/zim/" "$INSTALL_DIR/storage/zim/"
fi

if [[ -d "$BUNDLE/storage/maps" ]]; then
  echo "→ Byter ut storage/maps/…"
  mkdir -p "$INSTALL_DIR/storage/maps"
  rsync -a --delete --exclude='.DS_Store' "$BUNDLE/storage/maps/" "$INSTALL_DIR/storage/maps/"
fi

# Säkerställ att kommun-mapp finns med default-data om den saknas (första install)
if [[ -d "$TMP_CODE/kommuner" ]]; then
  for kdir in "$TMP_CODE/kommuner/"*/; do
    [[ -d "$kdir" ]] || continue
    kn="$(basename "$kdir")"
    if [[ ! -d "$INSTALL_DIR/kommuner/$kn" ]]; then
      echo "→ Första install för kommun '$kn' — kopierar default-data."
      mkdir -p "$INSTALL_DIR/kommuner/$kn"
      rsync -a "$kdir" "$INSTALL_DIR/kommuner/$kn/"
    fi
  done
fi

# ---- Bygg appar ----

echo "→ Installerar deps i portal…"
( cd "$INSTALL_DIR/trygghetsnod-portal" && npm install --silent )

echo "→ Bygger admin-appen…"
( cd "$INSTALL_DIR/trygghetsnod-admin" && npm install --silent && npm run build )

# ---- Skriv applied.json ----

APPLIED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
mkdir -p "$INSTALL_DIR/storage"

# Slå ihop RELEASE.json med applied_at + backup_dir så vi kan rolla tillbaka
python3 <<EOF > "$INSTALL_DIR/storage/applied.json"
import json
d = json.load(open("$BUNDLE/RELEASE.json"))
d["applied_at"] = "$APPLIED_AT"
d["backup_dir"] = "$BACKUP_DIR"
print(json.dumps(d, indent=2, ensure_ascii=False))
EOF

# ---- Lägg till loggbok-rad ----

# Hitta aktiv kommun (LaunchAgent-plisten har KOMMUN; annars default 'arvika')
KOMMUN="${KOMMUN:-arvika}"
if [[ -f "$INSTALL_DIR/scripts/se.mazeworks.trygghetsnod.plist" ]]; then
  pk="$(grep -A1 '<key>KOMMUN</key>' "$INSTALL_DIR/scripts/se.mazeworks.trygghetsnod.plist" 2>/dev/null | tail -1 | sed 's/.*<string>\(.*\)<\/string>.*/\1/' || true)"
  [[ -n "$pk" ]] && KOMMUN="$pk"
fi

LOGGBOK="$INSTALL_DIR/kommuner/$KOMMUN/loggbok.jsonl"
if [[ -d "$(dirname "$LOGGBOK")" ]]; then
  echo "{\"type\":\"release\",\"title\":\"Uppdaterad till $VERSION\",\"author\":\"apply.sh\",\"backup_dir\":\"$BACKUP_DIR\",\"at\":\"$APPLIED_AT\"}" >> "$LOGGBOK"
fi

# ---- Starta stacken ----

echo "→ Startar stacken…"
"$INSTALL_DIR/scripts/start.sh"

# ---- Verifiera ----

echo "→ Väntar på att portalen ska svara…"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://localhost:8400/healthz >/dev/null 2>&1; then
    echo "  Portalen svarar."
    break
  fi
  sleep 1
done

# ---- Städa gamla backups (>30 dagar) ----

if [[ -d "$BACKUPS_DIR" ]]; then
  find "$BACKUPS_DIR" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \; 2>/dev/null || true
fi

echo
echo "==============================================="
echo " Klar — $VERSION applicerad."
echo "==============================================="
echo "  Backup:   $BACKUP_DIR"
echo "  Rollback: $BACKUP_DIR/apply.sh"
echo "  Status:   curl -s http://localhost:8400/api/admin/about | python3 -m json.tool"
