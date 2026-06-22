# 🔧 Životopis stroje — AI údržbář

Digitální životopis každého stroje + AI nápověda k údržbě. Zapíšeš poruchu a její
řešení, appka z toho staví historii stroje a **AI údržbář** radí podle této historie a
manuálu — včetně toho, „co tě nejspíš čeká“.

## Co umí (MVP)

- **Stroje** – profil (výrobce, typ, rok, umístění, výňatek z manuálu).
- **Životopis** – časová osa poruch a zásahů s náklady a prostoji.
- **Rychlý zápis** – napíšeš zásah vlastními slovy a **AI z toho udělá strukturovaný
  záznam** (ideální pro diktování přes klávesnici mobilu v dílně).
- **AI údržbář** – chat ke konkrétnímu stroji, který zná jeho historii i manuál.
- **Dokumentace** – nahraješ **manuál (PDF)** nebo **schéma (PDF/obrázek)**; AI je čte
  přímo (text i obrázky), u manuálů odkáže na stranu (citace) a u dotazů na
  hydraulická/elektro schémata automaticky přepne na model s high-res vision (Opus 4.8).

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind**
- **Prisma** + **PostgreSQL**
- **Claude API** (`@anthropic-ai/sdk`)

## Lokální spuštění

```bash
npm install
cp .env.example .env        # vyplň DATABASE_URL a ANTHROPIC_API_KEY
npm run db:push             # vytvoří tabulky
npm run dev
```

App běží na http://localhost:3000.

## Nasazení na Railway

1. Vytvoř projekt z tohoto repa.
2. Přidej plugin **PostgreSQL** (proměnná `DATABASE_URL` se nastaví sama).
3. Do proměnných přidej `ANTHROPIC_API_KEY` (a volitelně `ANTHROPIC_MODEL`).
4. Deploy. Start command (viz `railway.json`) provede `prisma db push` a spustí app.

## Dokumentace a AI (jak AI „čte" návody)

- Manuály/schémata se nahrávají do **Anthropic Files API** (uloží se jednou, dál se
  odkazují přes `file_id`).
- Při dotazu se k AI přiloží relevantní dokumenty + historie poruch; u PDF jsou
  zapnuté **citace** (odkaz na stranu).
- **Routing modelu:** textové dotazy jedou na `claude-sonnet-4-6`; dotazy na
  schémata/výkresy (nebo když je u stroje hydraulické/elektro schéma) na
  `claude-opus-4-8` kvůli high-res vision. Lze přepsat přes `ANTHROPIC_SCHEMA_MODEL`.
- Limity: PDF do **32 MB / 600 stran** na dotaz. Větší knihovny → časem RAG (pgvector).

## Roadmapa (další kroky)

- 🔍 Zoom/výřez velkých výkresů (A0/A1) pro přesnější čtení schémat
- 🧠 RAG nad textem manuálů (pgvector + embeddingy) pro velké knihovny
- 🔳 QR kód na stroj → sken otevře jeho životopis
- 🎙️ Skutečný hlasový vstup (přepis audia → záznam)
- 🔔 Prediktivní upozornění na opakující se závady
- 👥 Účty a týmy, sdílení mezi techniky
