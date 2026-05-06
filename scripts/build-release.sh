#!/usr/bin/env bash
# Bygger en release-bundle för manuell installation på en Trygghetsnod-enhet.
#
# Användning:   scripts/build-release.sh <version> [--notes "kort beskrivning"]
# Exempel:      scripts/build-release.sh v2026-Q2.1 --notes "FRG-token QR-fix"
#
# Output:       releases/trygghetsnod-<version>/  (mapp redo att kopiera till USB)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $# -lt 1 ]]; then
  echo "Användning: $0 <version> [--notes \"...\"]" >&2
  echo "  version    t.ex. v2026-Q2.1" >&2
  exit 1
fi

VERSION="$1"; shift
NOTES=""
SKIP_STORAGE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --notes) NOTES="$2"; shift 2 ;;
    --skip-storage) SKIP_STORAGE=1; shift ;;
    *) echo "Okänt argument: $1" >&2; exit 1 ;;
  esac
done

if [[ ! "$VERSION" =~ ^v[0-9]{4}-Q[1-4]\.[0-9]+$ ]]; then
  echo "Versionen måste matcha v<år>-Q<kvartal>.<patch> (t.ex. v2026-Q2.1)" >&2
  exit 1
fi

# Försäkra rent working tree (annars är det oklart vad som bundlas)
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "VARNING: working tree har ocommittade ändringar." >&2
  echo "Bundlen baseras på senaste commit (HEAD), inte din arbetskopia." >&2
  echo "Tryck Enter för att fortsätta, Ctrl-C för att avbryta."
  read -r
fi

GIT_SHA="$(git rev-parse HEAD)"
GIT_TAG="$(git describe --tags --exact-match 2>/dev/null || echo "")"

if [[ -z "$GIT_TAG" ]]; then
  echo "Ingen git-tag på HEAD. Tagga först:  git tag $VERSION  &&  git push --tags" >&2
  echo "Tryck Enter för att bygga ändå (otaggad release), Ctrl-C för att avbryta."
  read -r
fi

if [[ -n "$GIT_TAG" && "$GIT_TAG" != "$VERSION" ]]; then
  echo "Versionen ($VERSION) matchar inte git-tag på HEAD ($GIT_TAG)." >&2
  exit 1
fi

BUNDLE_DIR="$ROOT/releases/trygghetsnod-$VERSION"
if [[ -e "$BUNDLE_DIR" ]]; then
  echo "$BUNDLE_DIR finns redan. Ta bort eller välj annat versionsnummer." >&2
  exit 1
fi

mkdir -p "$BUNDLE_DIR"
if [[ "$SKIP_STORAGE" -eq 0 ]]; then
  mkdir -p "$BUNDLE_DIR/storage/zim" "$BUNDLE_DIR/storage/maps"
fi

echo "→ Paketerar kod (git archive @ $GIT_SHA)…"
git archive --format=tar.gz --prefix= -o "$BUNDLE_DIR/code.tar.gz" HEAD

if [[ "$SKIP_STORAGE" -eq 1 ]]; then
  echo "→ --skip-storage: hoppar över storage/zim och storage/maps."
  echo "  Bundlen kommer bara byta ut kod när den appliceras."
else
  echo "→ Kopierar storage/zim/  ($(du -sh storage/zim 2>/dev/null | cut -f1))…"
  if [[ -d storage/zim ]]; then
    rsync -a --exclude='.DS_Store' storage/zim/ "$BUNDLE_DIR/storage/zim/"
  fi

  echo "→ Kopierar storage/maps/  ($(du -sh storage/maps 2>/dev/null | cut -f1))…"
  if [[ -d storage/maps ]]; then
    rsync -a --exclude='.DS_Store' storage/maps/ "$BUNDLE_DIR/storage/maps/"
  fi
fi

echo "→ Kopierar apply-skript…"
cp "$ROOT/scripts/apply-update.sh" "$BUNDLE_DIR/apply.sh"
chmod +x "$BUNDLE_DIR/apply.sh"

echo "→ Beräknar checksummor…"
sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

zim_json=""
if compgen -G "$BUNDLE_DIR/storage/zim/*.zim" >/dev/null; then
  for f in "$BUNDLE_DIR/storage/zim/"*.zim; do
    fn="$(basename "$f")"
    sum="$(sha256_of "$f")"
    zim_json+="{\"filename\":\"$fn\",\"sha256\":\"$sum\"},"
  done
fi
zim_json="[${zim_json%,}]"

pmt_json=""
if [[ -d "$BUNDLE_DIR/storage/maps/pmtiles" ]]; then
  while IFS= read -r f; do
    fn="$(basename "$f")"
    sum="$(sha256_of "$f")"
    pmt_json+="{\"filename\":\"$fn\",\"sha256\":\"$sum\"},"
  done < <(find "$BUNDLE_DIR/storage/maps/pmtiles" -maxdepth 1 -type f -name '*.pmtiles')
fi
pmt_json="[${pmt_json%,}]"

code_sum="$(sha256_of "$BUNDLE_DIR/code.tar.gz")"
RELEASED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat > "$BUNDLE_DIR/RELEASE.json" <<EOF
{
  "version": "$VERSION",
  "released_at": "$RELEASED_AT",
  "code": {
    "git_sha": "$GIT_SHA",
    "git_tag": "${GIT_TAG:-$VERSION}",
    "archive": "code.tar.gz",
    "sha256": "$code_sum"
  },
  "storage": {
    "zim": $zim_json,
    "pmtiles": $pmt_json
  },
  "notes": "$(printf '%s' "$NOTES" | sed 's/"/\\"/g')"
}
EOF

echo
echo "Klar. Bundle: $BUNDLE_DIR"
du -sh "$BUNDLE_DIR"
echo
echo "Nästa steg:"
echo "  rsync -avh --progress \"$BUNDLE_DIR\" /Volumes/<USB>/"
echo "Eller på enheten direkt:"
echo "  ./apply.sh"
