# macOS-checklista — Trygghetsnod Mac mini

Följs i ordning vid varje ny enhet. Kryssa i serviceloggboken när varje del är klar.

---

## Del 1 — Första uppstart (setup-guiden)

| Steg | Val | Skäl |
|---|---|---|
| Land/språk | Sverige, Svenska | – |
| Tangentbord | Svenskt | – |
| Hjälpmedel | **Inte nu** | Aktiveras vid behov senare. |
| Wi-Fi/Ethernet | Anslut till build-nät | Build phase kräver internet. |
| Migrationsassistent | **Ställ in som ny** | Inte en personlig dator. |
| Apple-konto | **Ställ in senare** | Enheten ska inte hänga ihop med någons Apple ID. |
| Villkor | **Godkänn** | Kan inte hoppas över. |
| Skapa konto | Namn: `Trygghetsnod`, kort: `trygghetsnod`, lösen: minst 12 tecken med policy-uppfyllande komplexitet | Generiskt produktnamn, inte personnamn. |
| Lösenordsåterställning via Apple-konto | **Tillåt inte** | Externt återställningsberoende. |
| Profilbild | Monogram **T** | Produktkänsla, inte personlig. |
| Platstjänster | **Aktivera inte** | Skickar Wi-Fi-data till Apple. Enheten står på fast plats. |
| Tidszon | Stockholm | – |
| Macanalys | **Dela inte** | Telemetri. |
| Skärmtid | **Ställ in senare** | Irrelevant för serviceenhet. |
| Apple Intelligence | **Aktivera inte** | Skickar data till Apples Private Cloud Compute. Vi kör egen AI-stack. |
| FileVault | **Aktivera**. Generera lokal återställningsnyckel. **Skriv ner och spara på minst två ställen.** | Standard krypteringspraxis. |
| Automatiska uppdateringar | **Endast automatisk hämtning** (slås av helt i Del 2) | – |

---

## Del 2 — Lås ner systeminställningar

Öppna **Systeminställningar** och gå igenom följande:

### Allmänt → Programuppdatering → Automatiska uppdateringar (i)

Slå **AV alla fem reglagen**:
- Sök efter uppdateringar
- Hämta nya uppdateringar
- Installera macOS-uppdateringar
- Installera programuppdateringar
- Installera systemdatafiler och säkerhetsuppdateringar

> **Avvikelse från ERNW.** ERNW kräver alla på. För Trygghetsnod sker uppdatering vid kvartalsservice, manuellt och loggfört.

### Allmänt → Delning

Verifiera att **allt är av**:
- Skärmdelning, Fildelning, Mediedelning, Skrivardelning
- Fjärrinloggning, Fjärrhantering, Fjärr-Apple-event
- AirPlay-mottagare, Internetdelning, Bluetooth-delning
- Cachning av innehåll

### Allmänt → AirDrop & Handoff

- Handoff: **AV**
- AirPlay-mottagare: **AV**
- AirDrop: **Inte mottagning**
- Cursor-överlämning mellan Mac och iPad: **AV**

### Nätverk → Brandvägg

- **Aktivera**.
- **Alternativ**:
  - **"Blockera alla inkommande anslutningar": AV**.
    > **Viktigt:** Trygghetsnod *måste* acceptera inkommande på portalens port (8400) från medborgarnas telefoner på det lokala wifi:t. Att blockera allt skulle bryta produkten. Brandväggen tillåter i stället bara de specifika appar vi godkänt (Docker, portalen).
  - **"Tillåt inbyggd programvara att acceptera inkommande anslutningar": PÅ** (krävs för DHCP m.m.).
  - **"Tillåt nedladdad signerad programvara att acceptera inkommande anslutningar": PÅ** (Docker, Node är signerade).
  - **Smygläge ("Stealth mode"): PÅ** (svarar inte på pings och portskanningar, men de tillåtna apparna accepterar fortfarande inkommande).

**Skiktad säkerhet — så ska du tänka:**

1. **Nätverksperimetern = TP-Link-routern.** WAN-porten oansluten = ingen utsida finns. Den lokala wifi:n är det "privata huset".
2. **Mac mini:s brandvägg = innerdörrarna.** Tillåter bara specifika appar att lyssna. Allt annat blockeras.

Vid första start av Docker/portalen ber macOS om tillåtelse — godkänn där. Det skapar undantag för just de processerna.

### Bluetooth

- Para in mus och tangentbord vid behov.
- Stäng av Bluetooth efter parning om de bara används trådat under drift.

### Apple Intelligence & Siri

- Aktivera Apple Intelligence: **AV**
- Be om Siri: **AV**
- Lyssna efter "Hej Siri": **AV**
- Tillåt Siri när enheten är låst: **AV**

### Integritet & säkerhet

- **Platstjänster**: AV
- **Analys & förbättringar**: ALLT av (Mac-analys, app-utvecklare, iCloud-analys, Siri-förbättring, hjälpmedelsröster)
- **Apple-annonsering**: AV
- **Avancerat → Kräv administratörslösenord för systemövergripande inställningar**: PÅ
- **Lockdown Mode**: överväg PÅ för produktenheter (POC: AV)

### Skrivbord & Dock

- Föreslagna och senaste appar i Dock: AV

### Internetkonton

- Inga konton ska finnas tillagda. Ta bort om något lagts in av misstag.

### Tangentbord → Diktering

- Diktering: **AV** (skickar tal till Apple)

### Användare och grupper

- Gästanvändare: **AV** (om inte redan av)
- Tillåt gäster att ansluta till delade mappar: **AV**

---

## Del 3 — Verifieringskommandon (Terminal)

Öppna Terminal och kör. Alla ska returnera förväntat värde.

```bash
# System Integrity Protection ska vara på
csrutil status
# Förväntat: "System Integrity Protection status: enabled."

# Authenticated Root ska vara på
csrutil authenticated-root status
# Förväntat: "Authenticated Root status: enabled"

# Gatekeeper ska vara på
spctl --status
# Förväntat: "assessments enabled"

# FileVault ska vara på
fdesetup status
# Förväntat: "FileVault is On."

# Validera att återställningsnyckeln fungerar
sudo fdesetup validaterecovery

# Diagnostiska data ska vara av
defaults read /Library/Application\ Support/CrashReporter/DiagnosticMessagesHistory.plist AutoSubmit
# Förväntat: 0

# Gästkonto ska vara av
defaults read /Library/Preferences/com.apple.loginwindow GuestEnabled
# Förväntat: 0

# Sudo-tickets per terminal (Trygghetsnod-tillägg)
sudo cat /etc/sudoers | grep -e "tty_tickets" -e "timestamp_timeout=0"
# Lägg till om saknas:
#   sudo visudo
#   Defaults timestamp_timeout=0
#   Defaults tty_tickets

# Inga oväntade launch daemons (manuell granskning krävs)
launchctl list | grep -v "com.apple"
# Förväntat: bara processer du själv installerat (Docker, Ollama, Trygghetsnod-portal)
```

---

## Del 4 — Förberedelse för air-gap-läge

Inför första demo (eller före produktleverans):

1. **Avsluta build phase**:
   - Logga ut från eventuella konton i webbläsare.
   - Töm webbläsarens cache och historik.
   - Verifiera att inga delningstjänster råkat slås på under installationen.

2. **Bekräfta Trygghetsnod-stacken är komplett**:
   - Docker-containrar startar utan extern nätaktivitet.
   - Kiwix, kartor, portal, AI-modeller alla lokalt tillgängliga.
   - Inga `fetch()`-anrop mot externa URL:er i koden.

3. **Koppla från**:
   - Dra ur Ethernet, om i bruk.
   - Glöm Wi-Fi-nätverket: Systeminställningar → Wi-Fi → (i) bredvid SSID → Glöm.
   - Verifiera att portalen fortfarande svarar på `http://localhost:8400`.

4. **Logga i serviceloggboken**:
   - Datum, ansvarig, macOS-version, FileVault-nyckel-ID.
   - Avvikelser från checklistan.

---

## Del 5 — Återkommande granskning (kvartalsvis)

Vid varje servicebesök:

- Verifieringskommandona i Del 3 körs igen.
- Login Items (Systeminställningar → Allmänt → Login Items & Extensions) granskas.
- `launchctl list | grep -v "com.apple"` granskas.
- Eventuella OS-uppdateringar och säkerhetsuppdateringar appliceras manuellt.
- Sudo-tickets-konfigurationen verifieras (kan återställas vid OS-uppgradering).
- Logga utfört arbete och eventuella avvikelser i serviceloggboken.
