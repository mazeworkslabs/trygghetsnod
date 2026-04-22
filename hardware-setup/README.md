# Hardware setup — Trygghetsnod

Konfigurationsdokumentation för att sätta upp en Trygghetsnod-enhet (Mac mini) från fabriksinställningar till driftklart läge.

## Filer

- **`macos-checklist.md`** — Steg-för-steg-checklista för macOS-installation och hårdning. Följs i ordning vid varje ny enhet.
- **`stack-install.md`** — *(kommer senare)* Installation av Docker, portalen, Kiwix, kartor och AI-stacken.
- **`offline-verification.md`** — *(kommer senare)* Testprotokoll för att verifiera att enheten fungerar utan internet.

## Bas-referens

[ERNW Hardening Guide for macOS 26 Tahoe](https://github.com/ernw/hardening/blob/master/operating_system/osx/26/Hardening_Guide-macOS_26_Tahoe_1.0.md) (publicerad februari 2026).

Vår checklista bygger på ERNW men avviker på några punkter eftersom Trygghetsnod är en air-gap-enhet, inte en typisk arbetsstation.

## Avvikelser från ERNW-defaults

| Område | ERNW säger | Trygghetsnod gör | Skäl |
|---|---|---|---|
| Automatiska OS-uppdateringar | MANDATORY på | **AV** | Uppdatering sker vid kvartalsservice, inte i bakgrunden. Förutsägbarhet > färskhet. |
| Säkerhetsförbättringar i bakgrunden | MANDATORY på | **AV** | Konsistens med "inga automatiska uppdateringar". |
| NTP mot `time.euro.apple.com` | MANDATORY | Vid build phase OK; vid drift offline ingen NTP | Enheten är offline. Tid sätts vid kvartalsservice. |
| iCloud-tjänster | MANDATORY hanteras | **HELT AV** | Inga externa identitetsberoenden. |
| Apple ID på enheten | (förutsätts) | Inget Apple ID kopplat | Enheten är inte personlig. |
| Touch ID | OPTIONAL | N/A | Mac mini har inte Touch ID. |
| Time Machine | MANDATORY | **EJ för POC**; för produkt: lokal krypterad disk | Backup-strategi övervägs separat per kommun. |

## Standardrutin

1. Unbox och första macOS-uppstart enligt `macos-checklist.md` Del 1.
2. Lås ner systeminställningar enligt `macos-checklist.md` Del 2.
3. Verifiera hårdning via terminalkommandon i `macos-checklist.md` Del 3.
4. Installera mjukvarustacken enligt `stack-install.md`.
5. Verifiera offline-drift enligt `offline-verification.md`.
6. Logga setup i serviceloggboken som följer enheten.
