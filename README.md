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

## Roadmapa (další kroky)

- 📷 Nahrávání fotek stroje a poruch
- 🔳 QR kód na stroj → sken otevře jeho životopis
- 🎙️ Skutečný hlasový vstup (přepis audia → záznam)
- 🔔 Prediktivní upozornění na opakující se závady
- 👥 Účty a týmy, sdílení mezi techniky
