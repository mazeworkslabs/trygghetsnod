# Releaser och uppdateringar

Trygghetsnod-enheter uppdateras manuellt på plats. Ingen fjärruppkoppling.
Varje uppdatering levereras som en självständig **release-bundle** (mapp eller USB-stick).

## Versionsnumrering

`v<år>-Q<kvartal>.<patch>` — t.ex. `v2026-Q2.0`, `v2026-Q2.1`.

- **Kvartalsbump** (`Q2.0` → `Q3.0`): nytt innehåll (ZIM, kartor) + ev. kod
- **Patch-bump** (`Q2.0` → `Q2.1`): bara kodfix, samma innehåll

Git-tag matchar versionen.

## Bundle-struktur

```
trygghetsnod-v2026-Q2.1/
├── RELEASE.json        # version, sha, checksummor
├── apply.sh            # installer (kopia av scripts/apply-update.sh)
├── code.tar.gz         # repo @ specifik commit, utan node_modules/storage
└── storage/
    ├── zim/            # ZIM-filer
    └── maps/           # PMTiles + basemaps
```

## Bygga en release

På utvecklingsmaskinen:

```bash
git tag v2026-Q2.1
scripts/build-release.sh v2026-Q2.1
# → releases/trygghetsnod-v2026-Q2.1/
```

Kopiera mappen (eller paketa till tarball) till USB-sticka.

## Applicera på enheten

På Mac mini, med USB inkopplad:

```bash
~/Code/trygghetsnod/scripts/apply-update.sh /Volumes/<USB>/trygghetsnod-v2026-Q2.1/
```

Skriptet:

1. Validerar checksummor
2. Backupar nuvarande version till `~/Trygghetsnod-backups/<timestamp>/`
3. Stoppar stacken
4. Byter ut kod (behåller `kommuner/`, `storage/postgres`, `storage/logs`)
5. Byter ut `storage/zim` och `storage/maps`
6. Bygger admin-appen
7. Startar stacken igen
8. Skriver `storage/applied.json` med ny version
9. Lägger till rad i `loggbok.jsonl`

## Vad bevaras vid uppdatering (runtime data)

- `kommuner/<kommun>/update.json` — aktuell lägesuppdatering
- `kommuner/<kommun>/loggbok.jsonl` — service- och händelselogg
- `kommuner/<kommun>/poi.geojson` — kartmarkörer (kommunens egen data)
- `kommuner/<kommun>/sources.json` — publicerade källor (admin-val)
- `kommuner/<kommun>/artiklar/` — artiklar skrivna av kommunen
- `storage/postgres/` — forum-databas
- `storage/logs/` — portal-loggar

## Rollback

```bash
~/Code/trygghetsnod/scripts/apply-update.sh ~/Trygghetsnod-backups/<timestamp>/
```

Backups (samma struktur som en bundle) ligger kvar i 30 dagar.

## Versionsvisning

Admin-appen visar nuvarande version under **Översikt → Om enheten**, eller via:

```bash
curl -s http://localhost:8400/api/admin/about | jq
```
