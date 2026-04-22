# Trygghetsnod

En lokal informationskälla som inte kan släckas eller förfalskas.

Trygghetsnod är en offline-första krisberedskapsenhet för svenska kommuner. Den står på en fysisk trygghetspunkt (typiskt brandstation eller kommunhus), aktiveras vid kris, och förmedlar kommunens information till medborgaren via ett lokalt wifi — utan internetuppkoppling.

Det här repot innehåller produktkoden. Mer om produkten i sig finns i [`produktbeskrivning.md`](./produktbeskrivning.md). Webbplatsen ligger på [trygghetsnod.se](https://trygghetsnod.se) och har ett eget repo.

## Status

POC-fas. Dialog med kommuner pågår. Ingen produktion ännu.

## Stack

- **`trygghetsnod-portal/`** — Node + Express + EJS. Medborgar­portalen, sök, kart-vy, content-proxy, admin-API.
- **`trygghetsnod-admin/`** — React + Vite + TypeScript. Lokal admin-app (servas från `/admin`).
- **`compose.yaml`** — minimal Docker-stack: bara Kiwix-server för ZIM-bibliotek.
- **`kommuner/`** — kommunspecifik konfiguration och data (en mapp per kommun). Se `kommuner/README.md`.
- **`hardware-setup/`** — checklistor för att sätta upp en ny enhet (macOS-hårdning, stack-install, offline-verifiering).
- **`scripts/`** — `start.sh`, `stop.sh`, `status.sh`, `logs.sh` plus macOS LaunchAgent.
- **`produktbeskrivning.md`** — fullständig produktspecifikation.

## Kör lokalt

Förutsättningar:
- macOS (Apple Silicon rekommenderas) eller Linux
- Node.js 20+
- Docker eller OrbStack
- ZIM-filer och PMTiles i `storage/` (distribueras separat — inte i git)

Snabbstart:

```bash
( cd trygghetsnod-portal && npm install )
( cd trygghetsnod-admin  && npm install && npm run build )
scripts/start.sh
```

Portalen: `http://localhost:8400`. Admin: `http://localhost:8400/admin` — **bara åtkomlig från enheten själv** (localhost), inte från medborgares telefoner på det lokala wifi:t. Säkerhet bygger på fysisk åtkomst till enheten + macOS-användarlösenord.

Status: `scripts/status.sh` · stoppa: `scripts/stop.sh` · loggar: `scripts/logs.sh`.

## Bidrag

Pull requests och issues är välkomna. Fokus just nu ligger på POC och första pilot — produktionsstabilisering, tester och CI kommer i nästa fas.

## Licens

[Apache License 2.0](./LICENSE) — fri att använda, modifiera och distribuera, även kommersiellt. Inkluderar patent grant. Copyright © 2026 Mazeworks AB. Se `NOTICE` för sammanställning av tredjepartskomponenter.
