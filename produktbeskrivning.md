# Trygghetsnod – produktbeskrivning

*Beskriver vad produkten innehåller. Inte pitch, inte positionering, inte sälj. Underhålls i `krisnod/produktbeskrivning.md`.*

## Hårdvara

Två modeller, samma periferi och samma ingående delar förutom själva servern:

### Gemensam periferi (båda modeller)

- **Portabel USB-C-skärm** 15,6", 1080p IPS. Drivs via USB-C, ingen separat ström.
- **Tangentbord och mus** (trådade, USB).
- **Trådlös accesspunkt** med captive portal (Ubiquiti UniFi-klass), PoE-matad.
- **PoE-injektor** och Ethernet-kabel Cat6.
- **Färglaserskrivare** med duplex, USB + Ethernet + WiFi.
- **Tonerförråd** (extra CMYK-uppsättning, utöver medföljande).
- **Pappersförråd** (A4, 80 g).
- **UPS** 1 600 VA / 900 W, AVR, Schuko.
- **Grenuttag** med överspänningsskydd.
- **Kablage**: USB-C, USB-A till USB-B, strömkablar.

### A-01 Budget

- **Lokal server** av x86-klass (t.ex. Intel NUC eller liknande kompakt Linux-server): 16 GB RAM, 512 GB SSD.
- **Operativsystem:** Linux (Debian/Ubuntu-klass) eller macOS, beroende på tillgänglighet.
- **Innehåll:** krisportal, CMS, kartor, offline-bibliotek (ZIM), utskrift, LibreOffice, mallbibliotek.
- **Ingen AI.** Inga språkmodeller, ingen översättning eller transkribering.
- Tystare, billigare, lägre effektförbrukning.

### A-01 Standard

- **Lokal server** av Mac Studio-klass (eller MacBook Pro med M-serie): 128 GB unified memory, 1 TB SSD.
- **Operativsystem:** macOS.
- **Innehåll:** allt i Budget plus **AI-funktioner** för platsansvarig och krisledning (översättning, transkribering, semantisk sök, sammanfattning).
- Tillräcklig beräkningskraft för att köra större flerspråkiga LLM:er och Whisper-klassad transkribering med rimliga svarstider. Framtidssäker i takt med att modellerna växer.

## Mjukvara

**Operativsystem.** macOS (Standard) eller Linux (Budget), konfigurerat för lokal drift utan extern uppkoppling.

**Container-plattform.** Docker med lokal orkestrering via Project NOMAD.

**Komponenter som körs på enheten:**

- **Trygghetsnod-portal.** Webbapplikation för medborgare. Node.js + Express. Körs på enhetens IP och är den sida besökare möts av via captive portal.
- **CMS.** Intern webbapp där den platsansvariga skriver lägesuppdateringar (rubrik, läge, text, avsändare). Tre lägen: information, varning, nödläge.
- **Sökmotor.** Fulltextsök (Xapian/BM25) mot samtligt innehåll på enheten.
- **Kartmotor.** MapLibre GL med PMTiles-backend. Offline-rendering i webbläsaren.
- **Kiwix-server.** Server för ZIM-bibliotek.
- **AI-runtime** *(endast Standard)*. Ollama med lokala språkmodeller, Qdrant som vektordatabas. Endast tillgänglig för intern personal.
- **LibreOffice.** Ordbehandling och kalkyl, med lokalt mallbibliotek.
- **FlatNotes.** Lokalt anteckningsprogram för krisledning och platsansvariga.
- **Kolibri.** Plattform för utbildningsmaterial (videor, övningar, kurser).
- **CyberChef.** Verktyg för databearbetning, kodning och analys, för tekniker på plats.
- **Skrivarköer och drivrutiner** för medföljande skrivare.
- **Captive portal-konfiguration** på accesspunkten.

**Inga externa tjänster.** Inga molnbaserade komponenter. Ingen telemetri. Ingen fjärradministration.

## Innehåll

### Kommunspecifikt

- Kommunens krisledningsplan, kontaktlistor, öppettider för trygghetspunkter.
- Spegel av kommunens hemsida vid senaste service (ZIM).
- Kommunspecifika dokument: evakueringsvägar, krisstöd, sov- och matmöjligheter, interna rutiner.
- Kommunspecifika kartlager (se Kartor).

### Svenska myndighetskällor (offline-ZIM)

- **Krisinformation.se** i sin helhet.
- **1177 Vårdguiden.**
- **MSB:s hemberedskapsmaterial**, inklusive "Om krisen eller kriget kommer".
- **DinSäkerhet.se.**
- **Livsmedelsverkets råd vid kriser.**
- **Folkhälsomyndigheten** (smittskydd, vaccination).
- **SMHI** klimat- och vädermaterial (statiskt referensmaterial).
- **Trafikverket** – vägnätsinformation, färjelägen.
- **Länsstyrelse- och regionmaterial** där det är relevant.

### Uppslagsverk och allmänkunskap

- **Wikipedia på svenska** (fullständig dump).
- **Wikipedia på engelska** (urval).
- **Wikivoyage på svenska** – resemål, kartunderlag, lokala tips.
- **Wiktionary** – ordbok, flera språk.

### Medicin och sjukvård

- **WikiMed** – medicinsk uppslagsbok baserad på Wikipedia.
- **MedLine Plus** – patientinformation (engelska).
- **Hesperian "Where There Is No Doctor"** – klassiskt handbok för sjukvård utan läkare.
- **Hesperian "Where There Is No Dentist".**
- **Hesperian "A Book for Midwives"** – förlossning, graviditet.
- **Khan Academy Medicine** – utbildningsvideor och -artiklar inom anatomi, fysiologi, farmakologi.

### Reparation och praktisk kunskap

- **iFixit** – reparationsguider för hushållsprodukter, fordon, elektronik.
- **Appropedia** – lågteknologiska lösningar, off-grid-teknik.
- **WikiHow** – praktiska "hur gör man"-guider.

### Utbildning (Kolibri)

- **Khan Academy** – matematik, naturvetenskap, samhällskunskap, historia.
- **CK-12** – utbildningsmaterial för grundskola och gymnasium.
- **Ted-Ed** – korta utbildningsvideor.
- **Open Educational Resources** – fritt läromaterial.

### Kartor

Vektorkarta över hela Sverige (PMTiles, MapLibre-style, offline-rendering). Zoomar från hela landet till gatunivå.

Kommunspecifika kartlager, uppdaterade kvartalsvis:

- Trygghetspunkter.
- Skyddsrum.
- Vårdcentraler, akutmottagningar, sjukhus.
- Apotek.
- Drivmedel.
- Livsmedelsbutiker.
- Brandstationer.
- VMA-master.
- Evakueringsvägar.

### Ruttning

Offline-ruttning på OpenStreetMap-data för Sverige (OSRM- eller Valhalla-klass, klassisk grafalgoritm – inte beroende av AI eller molntjänster).

- **Point-to-point-rutter** (A → B) för medborgare och personal: "hitta närmaste trygghetspunkt från min position".
- **Fordon, cykel, gång** som separata profiler.
- **Turn-by-turn-instruktioner** med avstånd och tidsuppskattning.
- **Ruttoptimering** (TSP/VRP) för krisledning: bästa ordning att besöka flera punkter, exempelvis vid fordonsrundor för distribution eller inspektion.
- **Evakueringsrutt-beräkning** mellan stadsdelar och utvalda målpunkter.
- **Ingen realtidstrafik.** Offline-ruttning saknar levande trafikdata. Grund-rutterna förblir identiska med online-motsvarigheter så länge vägnätet inte ändras.

### Mallbibliotek (LibreOffice)

Färdiga mallar för kommunal kriskontext:

- Anslag A4 (lägesuppdatering).
- Incidentrapport.
- Kontaktlista.
- Evakueringsplan.
- Hemberedskapsblad.
- Checklista.
- Kommunbrevmall.

### AI-modeller *(endast A-01 Standard)*

Lokalt installerade modeller, körs utan nätverksåtkomst. Endast tillgängliga för intern personal:

- **Språkmodell** för översättning, sammanfattning och svar på frågor (Gemma-klass).
- **Transkriberingsmodell** för tal-till-text (Whisper-klass), flera språk.
- **Embedding-modell** för semantisk sökning i lokal kunskapsbas.

A-01 Budget har ingen AI-körning. Översättning/transkribering hanteras då manuellt eller genom att hänvisa till annan utrustning.

## Funktioner för medborgare

Nås via captive portal efter anslutning till lokalt wifi:

- **Krisportal-startsida** med aktuell lägesuppdatering och genvägar.
- **Fritextsök** i allt lokalt innehåll.
- **Kartvisning** med kommunspecifika lager.
- **Ruttning** till närmaste trygghetspunkt, apotek, vårdcentral eller annan punkt på kartan, med turn-by-turn och tidsuppskattning.
- **Läsning av offline-bibliotek** (Krisinformation.se, 1177, Wikipedia m.fl.) i portalens design.
- **Utskriftsvänliga versioner** av enskilda artiklar (begärs från platsansvarig vid skrivaren).

## Funktioner för platsansvarig

Gemensamt för båda modeller:

- **CMS för lägesuppdatering** – rubrik, text, läge, avsändare. Publicerar till wifi-portal och A4.
- **A4-utskrift** av aktuell lägesuppdatering med kommunnamn, datum, QR-kod till wifi och 112-påminnelse.
- **Mallar i LibreOffice** för dokument som behöver mer struktur än CMS.
- **FlatNotes** för interna anteckningar och händelseloggar.
- **Manuell utskrift** av valfri sida från innehållsbiblioteket.
- **Serviceloggbok** (fysisk bok som följer enheten).

Endast A-01 Standard:

- **AI-assisterad sökning** i kunskapsbasen – ställ frågor på naturligt språk, få svar med källhänvisning.
- **AI-översättning** av text till flera språk (engelska, arabiska, somaliska, persiska, tigrinja, m.fl.). Används för att snabbt göra anslag på andra språk eller förstå inkommande material.
- **AI-transkribering och -översättning av tal.** Besökare talar på annat språk än svenska → mikrofon → text på svenska i realtid. Och omvänt.
- **AI-sammanfattning** av längre dokument till korta A4-anslag.

## Funktioner för krisledning

- **Aktiveringsrutin** för enheten (start, inloggning, konfiguration av aktuell trygghetspunkt).
- **Innehållsöversikt** över vad som finns på enheten vid aktivering.
- **CMS-åtkomst** för att skriva och ändra lägesuppdateringar.
- **AI-verktyg** *(endast Standard)* – samma som för platsansvarig: frågor, översättning, transkribering, sammanfattning.
- **Mallar och utskriftsfunktioner** för beslut, anslag och kommunikationsmaterial.
- **FlatNotes** för krisledningens interna anteckningar.
- **CyberChef** för teknisk personal som behöver tolka data, koda/avkoda, analysera.
- **Ruttoptimering** för fordonsrundor och flera stopp (TSP/VRP) – t.ex. när distribution ska täcka fem trygghetspunkter eller fordonsrond ska inspektera flera skyddsrum.
- **Avstängningsrutin** för enheten efter avslutad aktivering.

## Drift- och serviceegenskaper

- **Strömförsörjning.** UPS 1 600 VA / 900 W för övergång till reservkraft.
- **Uppstart.** Enheten startar från avstängd till driftklart läge inom några minuter.
- **Uppdatering.** Fysiskt servicebesök kvartalsvis. Innehåll, kartor, hemsidesspegel och AI-modeller uppdateras via lokal lagringsenhet.
- **Loggbok.** Fysisk serviceloggbok följer enheten.
- **UPS-batteri.** Byts vart 3–5 år enligt serviceplan.

## Nätverksdesign

- **Internt LAN** mellan server och accesspunkt.
- **Lokalt wifi-nät** (SSID konfigurerat per kommun) för medborgare.
- **Captive portal** dirigerar till krisportalens startsida.
- **Ingen WAN-port kopplad.** Enheten är fysiskt isolerad från internet.
- **Ingen fjärråtkomst.** Inga öppna portar mot externa nätverk.
- **Ingen automatisk uppdatering.** All uppdatering sker fysiskt.

---

*Version 0.5 · 2026-04-17 · två modeller (Budget utan AI, Standard med AI), Pro borttagen*
