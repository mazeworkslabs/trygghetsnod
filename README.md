# Trygghetsnod

En lokal informationskälla som inte kan släckas eller förfalskas.

Trygghetsnod är en offline-första krisberedskapsenhet för svenska kommuner. Den står på en fysisk trygghetspunkt (typiskt brandstation eller kommunhus), aktiveras vid kris, och förmedlar kommunens information till medborgaren via ett lokalt wifi — utan internetuppkoppling.

Det här repot innehåller produktkoden. Mer om produkten i sig finns i [`produktbeskrivning.md`](./produktbeskrivning.md). Webbplatsen ligger på [trygghetsnod.se](https://trygghetsnod.se) och har ett eget repo.

## Status

POC-fas. Dialog med kommuner pågår. Ingen produktion ännu.

## Vad som finns

- **`trygghetsnod-portal/`** — webbportalen för medborgare och platsansvarig (Node.js + Express + EJS).
- **`compose.yaml`** — Docker-stacken (baserad på [Project NOMAD](https://github.com/crosstalk-solutions/project-nomad) med Trygghetsnod-tillägg).
- **`kommuner/`** — kommunspecifik konfiguration och data (en mapp per kommun). Se `kommuner/README.md`.
- **`hardware-setup/`** — checklistor för att sätta upp en ny enhet (macOS-hårdning, stack-installation, offline-verifiering).
- **`produktbeskrivning.md`** — fullständig produktspecifikation (hårdvara, mjukvara, innehåll, funktioner per användargrupp).

## Kör lokalt

Förutsättningar:
- macOS (Apple Silicon rekommenderas) eller Linux
- Node.js 20+
- Docker eller OrbStack
- ZIM-filer och PMTiles i `storage/` (distribueras separat — inte i git)

Snabbstart:

```bash
# 1. Stacken (Kiwix, kartor, NOMAD-admin)
cp .env.example .env  # justera värden
docker compose up -d

# 2. Portalen
cd trygghetsnod-portal
npm install
KOMMUN=arvika npm start
```

Portalen finns då på `http://localhost:8400`.

CMS för platsansvarig: `http://localhost:8400/cms` — **bara åtkomlig från enheten själv** (localhost), inte från medborgares telefoner på det lokala wifi:t. Säkerhet bygger på fysisk åtkomst till enheten + macOS-användarlösenord.

## Bidrag

Pull requests och issues är välkomna. Fokus just nu ligger på POC och första pilot — produktionsstabilisering, tester och CI kommer i nästa fas.

## Licens

[GNU AGPL v3.0](./LICENSE) — se `LICENSE`-filen. Tjänster som körs offentligt ovanpå Trygghetsnod-koden ska också vara öppen källkod. Civic infrastructure förblir civic.
