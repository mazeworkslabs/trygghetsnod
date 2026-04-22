# Offline-verifiering

Testprotokoll som körs efter stacken är installerad och innan enheten levereras eller demoras.

Syftet är att bevisa att enheten fungerar **utan internet** — det är hela produktens kärnlöfte.

---

## Förberedelse

1. Stacken igång enligt `stack-install.md`.
2. Mac mini ansluten till **det lokala wifi:t** (egen router, inte hem-/kontorsnätet) via Ethernet eller wifi.
3. En andra testenhet (MacBook eller telefon) ansluten till samma wifi.
4. WAN-kabeln på den lokala routern är **inkopplad**.

---

## Test 1 — Baslinje med internet

På testenheten, anslut till lokala wifi:t och öppna webbläsaren:

- [ ] `http://<mac-mini-ip>:8400` laddar startsidan
- [ ] `/sok?q=stormsäker` returnerar träffar
- [ ] Klick på en träff → Krisinformation-artikel laddar med Trygghetsnod-banner överst
- [ ] `/kartor` ritar Sverige-karta + Arvika POI:er
- [ ] Klick på en POI öppnar popup med adress och kapacitet

Allt grönt → gå vidare. Något rött → felsök innan offline-test.

---

## Test 2 — Drama: dra ur WAN

Vid den lokala routern:

1. Identifiera **WAN-porten** (märkt WAN, eller port 0/1 beroende på router).
2. **Dra ur kabeln.**
3. Räkna till tio.

Routern fortsätter att leverera DHCP och wifi internt — bara internet-uppkopplingen är borta.

---

## Test 3 — Allt ska fortfarande fungera

På testenheten, ladda om alla sidor:

- [ ] `http://<mac-mini-ip>:8400` startsidan laddar fortfarande
- [ ] `/sok?q=stormsäker` returnerar samma träffar (Kiwix kör lokalt)
- [ ] Klick på träff → Krisinformation-artikel laddar fortfarande
- [ ] `/kartor` — Sverige-karta + POI ritas (PMTiles kör lokalt)
- [ ] CSS, bilder, JavaScript laddar utan extern fonts.googleapis eller liknande
- [ ] Inga `502`, inga `Failed to fetch`-fel i webbläsarkonsolen

På Mac mini lokalt:

- [ ] `http://localhost:8400/cms` öppnar och kan spara en uppdatering
- [ ] `http://localhost:8400/print` visar A4 med kommunens logga och lägesuppdatering

---

## Test 4 — Verifiera att inga utgående anrop görs

Öppna webbläsarkonsolens nätverksflik på testenheten medan du klickar runt i portalen.

- [ ] Inga anrop går till externa domäner (.com, .net, etc. som inte är `mac-mini-ip`)
- [ ] Inga 404 eller `connection refused` mot externa CDN:er

Vanliga fallgropar:
- Externa fonts (Google Fonts) — ska vara inbäddade lokalt
- Externa map tiles — ska vara via PMTiles, inte mapbox/openstreetmap.org
- Analytics-skript — ska inte finnas alls

Om något läcker — fixa det innan leverans.

---

## Test 5 — Återanslut och loggför

1. Sätt tillbaka WAN-kabeln.
2. Verifiera att internet fungerar igen på testenheten.
3. Logga i serviceloggboken:
   - Datum och tid
   - Vem som körde testet
   - Resultat per test (OK / fel)
   - Eventuella avvikelser

---

## Vid misslyckande

Om något test fallerar i offline-läget:

- **Sök ger inget?** Kiwix-servern (port 8090) körs i NOMAD. Kolla att containern lever: `docker compose ps`.
- **Karta blank?** PMTiles ligger i `storage/maps/pmtiles/`. Kontrollera att filen finns och är läsbar.
- **Krisinformation laddar inte?** ZIM ligger i `storage/zim/`. NOMAD måste ha en biblioteksregistrering — kolla NOMAD-admin på localhost:8080.
- **Externa anrop syns?** Sök i koden efter URL:er som inte börjar med `localhost` eller relativa paths.

---

## När enheten är levererad

Detta protokoll körs igen vid varje **kvartalsservice**. Föregående resultat jämförs med aktuellt — bevis på att enheten inte degraderats över tid.
