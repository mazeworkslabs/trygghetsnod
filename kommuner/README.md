# Kommuner

En mapp per kommun. Innehåller kommunspecifik konfiguration och data:

- `config.json` — kommunens namn, plats, wifi-SSID, ZIM-paths, kartcentrum.
- `poi.geojson` — POI-lager (trygghetspunkter, skyddsrum, vårdinrättningar etc.) som ritas på kartan.
- `update.json` — aktuell lägesuppdatering (skrivs av platsansvarig via CMS — **versionhanteras inte**, kommer från `update.example.json`).
- `update.example.json` — mallen som kopieras till `update.json` vid första uppstart.
- `krisledningsplan.md` *(valfritt)* — kommunens egen krisledningsplan, läses inte av portalen men följer enheten.

## Lägga till en ny kommun

1. Kopiera `arvika/` till `<ny-kommun>/`.
2. Uppdatera `config.json` (namn, plats, SSID, ZIM-path, kartcentrum).
3. Byt ut `poi.geojson` mot kommunens egna data.
4. Bygg en ny ZIM-spegel av kommunens hemsida med zimit (se `hardware-setup/`) och uppdatera `kommun_zim_path` i `config.json`.
5. Starta portalen med `KOMMUN=<ny-kommun> npm start`.

## Drift

`update.json` ändras hela tiden via CMS:et. **Den är inte i git.** Det är bevis på att portalen lever — den är inte en del av produktrepot.

Vid leverans till ny kommun: kopiera `update.example.json` → `update.json`. Sedan tar platsansvarig över redigeringen via /cms (lokalt på enheten).
