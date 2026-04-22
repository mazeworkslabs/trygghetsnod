# Stack-installation — Trygghetsnod på Mac mini

Följer efter `macos-checklist.md` Del 1–3. Bygger upp utvecklings- och driftmiljö, klonar repot, drar in storage, startar containrarna, verifierar att portalen svarar.

Räkna med 1–2 timmar inklusive nedladdningar.

---

## Del 1 — Verktyg

### Xcode Command Line Tools

I Terminal:

```bash
xcode-select --install
```

Klicka **Installera** i dialogen som dyker upp. Tar 5–15 minuter beroende på nät.

### Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Följ instruktionerna i slutet om att lägga till `brew` i `PATH`.

### Git, Node, OrbStack

```bash
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
git clone git@github.com:mazeworks/trygghetsnod.git
cd trygghetsnod
```

Om det är första gången du sätter upp git på enheten:

```bash
git config --global user.name "Trygghetsnod-installation"
git config --global user.email "noreply@trygghetsnod.se"
```

---

## Del 3 — Storage från USB

`storage/` ligger inte i git (8 GB binär data). Den distribueras separat på krypterad USB-stick med signerat innehåll.

```bash
# Anslut USB
ls /Volumes/   # hitta stickans namn

# Kopiera in
rsync -avh --progress /Volumes/<USB-NAMN>/storage/ ~/Code/trygghetsnod/storage/

# Verifiera kontentan
ls ~/Code/trygghetsnod/storage/zim/
ls ~/Code/trygghetsnod/storage/maps/pmtiles/
```

---

## Del 4 — Konfiguration

```bash
cp .env.example .env
```

Generera nya hemligheter:

```bash
# APP_KEY (32 tecken hex)
openssl rand -hex 16

# DB_PASSWORD och MYSQL_ROOT_PASSWORD (varsin)
openssl rand -hex 16
```

Klistra in i `.env`. Lagra också i lösenordshanteraren — kommer behövas vid service.

---

## Del 5 — Stacken upp

```bash
cd ~/Code/trygghetsnod
docker compose up -d
```

Vänta 1–2 minuter på att MySQL initierar. Kolla att alla containrar är `running`:

```bash
docker compose ps
```

Förväntat: `nomad_admin`, `nomad_mysql`, `nomad_redis`, `nomad_updater`, `nomad_dozzle`.

NOMAD-admin på `http://localhost:8080`. Loggar via Dozzle på `http://localhost:9999`.

I NOMAD-admin: lägg till ZIM-bibliotek, konfigurera Kiwix-server (port 8090), maps-server (8080/maps).

---

## Del 6 — Portalen

```bash
cd trygghetsnod-portal
npm install
KOMMUN=arvika npm start
```

Portalen på `http://localhost:8400`.

För att portalen ska starta automatiskt vid macOS-boot — sätt upp en LaunchAgent (kommer i en framtida revision av denna guide).

---

## Del 7 — Verifiera grundfunktioner

I webbläsaren på enheten:

- `http://localhost:8400` — startsida med lägesuppdatering och fem kort
- `http://localhost:8400/sok?q=el+kris` — sök ger träffar från Krisinformation.se m.fl.
- `http://localhost:8400/innehall/krisinformation_sv_2026-04/www.krisinformation.se/` — Krisinformation-spegel laddas med banner överst
- `http://localhost:8400/kartor` — Sverige-karta med Arvika POI:er
- `http://localhost:8400/cms` — CMS för platsansvarig (lokal åtkomst, fungerar)
- `http://localhost:8400/print` — A4-version av aktuell lägesuppdatering
- `http://localhost:8400/qr.png` — QR-kod till wifi:t

Från en annan enhet på samma nät (din MacBook eller en telefon):

- `http://<mac-mini-ip>:8400` — portalen syns
- `http://<mac-mini-ip>:8400/cms` — ska ge **403 Forbidden** (det är medvetet — CMS bara från enheten själv)

---

## Klart

När alla sju verifieringar går grönt är stacken installerad. Nästa steg: `offline-verification.md`.
