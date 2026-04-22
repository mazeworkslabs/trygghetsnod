# Stack-installation — Trygghetsnod på Mac mini

Följer efter `macos-checklist.md` Del 1–3. Bygger upp drift­miljön, klonar repot, drar in storage från USB, startar stacken och verifierar att portalen svarar.

Räkna med 1 timme inklusive nedladdningar.

Stacken består av:

- **Kiwix-server** (Docker, port 8090) — serverar ZIM-bibliotek
- **Postgres** (Docker, port 5433) — lagrar forum (grupper, meddelanden). Port 5433 på host för att undvika konflikt med lokala Postgres-installationer.
- **Portal** (Node, port 8400) — Express + EJS, levererar medborgarsidan, admin-SPA:n, artiklar, kartor och forum.
- **Admin** (statiska filer) — React/Vite-app som bundlas in i portalen vid build

---

## Del 1 — Verktyg

```bash
xcode-select --install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install git node
brew install --cask orbstack
```

Starta OrbStack från Applications. Den ersätter Docker Desktop — lättare och snabbare på Apple Silicon.

Verifiera:

```bash
git --version       # ≥ 2.40
node --version      # ≥ 20
docker --version    # via OrbStack
```

---

## Del 2 — Klona repot

```bash
mkdir -p ~/Code
cd ~/Code
git clone git@github.com:mazeworkslabs/trygghetsnod.git
cd trygghetsnod
```

---

## Del 3 — Storage från USB

`storage/` ligger inte i git (~8 GB ZIM + PMTiles). Distribueras separat på krypterad USB med signerat innehåll.

```bash
ls /Volumes/                      # hitta stickans namn
rsync -avh --progress /Volumes/<USB-NAMN>/storage/ ~/Code/trygghetsnod/storage/

ls ~/Code/trygghetsnod/storage/zim/
ls ~/Code/trygghetsnod/storage/maps/pmtiles/
```

Förväntat innehåll i `storage/zim/`:

- `arvika_kommun_<datum>.zim` — kommunens hemsida (eller motsvarande för andra kommuner)
- `krisinformation_sv_<datum>.zim` — Krisinformation.se på svenska
- `wikipedia_sv_top_mini_<datum>.zim` — utdrag av svenska Wikipedia

---

## Del 4 — Bygg och starta

```bash
cd ~/Code/trygghetsnod

# Installera deps
( cd trygghetsnod-portal && npm install )
( cd trygghetsnod-admin  && npm install && npm run build )

# Starta hela stacken (Kiwix-container + native portal)
scripts/start.sh
```

`start.sh` kör `docker compose up -d` för Kiwix och startar portalen som bakgrundsprocess. Logg och PID hamnar i `storage/logs/`.

Status:

```bash
scripts/status.sh
```

Stoppa:

```bash
scripts/stop.sh
```

Tail på loggarna i realtid:

```bash
scripts/logs.sh
```

---

## Del 5 — Auto-start vid inloggning

```bash
scripts/install-launchagent.sh
```

Installerar `~/Library/LaunchAgents/se.mazeworks.trygghetsnod.plist`. Stacken startar nu automatiskt när Mac-mini:n loggar in efter omstart.

Avinstallera:

```bash
launchctl unload ~/Library/LaunchAgents/se.mazeworks.trygghetsnod.plist
rm ~/Library/LaunchAgents/se.mazeworks.trygghetsnod.plist
```

---

## Del 6 — Verifiera grundfunktioner

På enheten själv (`http://localhost:8400`):

- `/` — startsida med aktuell lägesuppdatering och kort till sök/kartor/innehåll
- `/sok?q=el+kris` — sökresultat från Kiwix
- `/innehall/krisinformation_sv_<datum>/www.krisinformation.se/` — Krisinformation-spegel med Trygghetsnod-banner
- `/kartor` — karta med trygghetspunkter och samhällsresurser
- `/print` — A4-utskrift av aktuell lägesuppdatering
- `/qr.png` — QR-kod till wifi:t
- `/admin` — administrationsgränssnitt (Översikt, Lägesuppdatering, Kartmarkörer, Innehåll, Loggbok)

Från en annan enhet på samma nät:

- `http://<mac-mini-ip>:8400` — portalen syns
- `http://<mac-mini-ip>:8400/admin` — ska ge **403 Forbidden**
  (medvetet — admin är bara åtkomligt från `localhost`)

---

## Konfiguration per kommun

Allt kommun-specifikt ligger under `kommuner/<kommun>/`:

- `config.json` — kommunens namn, plats, wifi-SSID, kart-center
- `poi.geojson` — kartmarkörer (redigeras via admin)
- `update.json` — aktuell lägesuppdatering (skrivs av platsansvarig via admin)
- `loggbok.jsonl` — service- och händelselogg (genereras automatiskt)

Byt kommun genom att sätta `KOMMUN`-miljövariabeln innan portalen startar:

```bash
KOMMUN=karlstad scripts/start.sh
```

LaunchAgent-plisten i `scripts/se.mazeworks.trygghetsnod.plist` har `KOMMUN`-värdet hårdkodat — uppdatera där om kommun ska ändras permanent på enheten.

---

## Klart

När alla verifieringar går grönt är stacken installerad. Nästa steg: `offline-verification.md`.
