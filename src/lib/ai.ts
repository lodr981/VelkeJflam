import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, AI_MODEL } from "./anthropic";
import { FILES_BETA } from "./files";
import type { FieldMap } from "./importParse";
import type { Machine, LogEntry } from "@prisma/client";

// Model pro dotazy na schémata/výkresy – Opus 4.8 kvůli high-res vision.
const SCHEMA_MODEL = process.env.ANTHROPIC_SCHEMA_MODEL ?? "claude-opus-4-8";

type MachineForAI = Machine & { entries: LogEntry[] };

function czDate(d: Date): string {
  return new Date(d).toLocaleDateString("cs-CZ");
}

/** Sestaví kontext o stroji pro AI ze životopisu (historie poruch + manuál). */
export function buildMachineContext(machine: MachineForAI): string {
  const head = [
    `Stroj: ${machine.name}`,
    machine.type ? `Typ: ${machine.type}` : null,
    machine.manufacturer ? `Výrobce: ${machine.manufacturer}` : null,
    machine.year ? `Rok: ${machine.year}` : null,
    machine.location ? `Umístění: ${machine.location}` : null,
    machine.notes ? `Poznámky: ${machine.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const history =
    machine.entries.length === 0
      ? "Zatím žádné zapsané poruchy."
      : machine.entries
          .map((e, i) => {
            const parts = [
              `#${i + 1} (${czDate(e.occurredAt)})`,
              `  Problém: ${e.problem}`,
              e.solution ? `  Řešení: ${e.solution}` : "  Řešení: (nezapsáno)",
              e.partsCost != null ? `  Náklady na díly: ${e.partsCost} Kč` : null,
              e.downtimeMinutes != null
                ? `  Prostoj: ${e.downtimeMinutes} min`
                : null,
              e.technician ? `  Technik: ${e.technician}` : null,
            ].filter(Boolean);
            return parts.join("\n");
          })
          .join("\n\n");

  const manual = machine.manualText
    ? `\n\n=== VÝŇATEK Z MANUÁLU / DOKUMENTACE ===\n${machine.manualText.slice(0, 12000)}`
    : "";

  return `=== PROFIL STROJE ===\n${head}\n\n=== ŽIVOTOPIS / HISTORIE PORUCH (od nejnovější) ===\n${history}${manual}`;
}

const SYSTEM_PROMPT = `Jsi zkušený AI údržbář. Pomáháš technikovi přímo u stroje.

Pravidla:
- Odpovídej česky, stručně a prakticky, jako kolega technik.
- Vždy vycházej PŘEDEVŠÍM z historie poruch a manuálu konkrétního stroje, které dostaneš v kontextu.
- Hledej vzory: opakující se závady, intervaly, co už dříve fungovalo.
- Když navrhuješ řešení, dej konkrétní kroky (postup), ne obecné fráze.
- Pokud něco z historie nevíš, řekni to a navrhni, co změřit/zkontrolovat.
- U bezpečnostně rizikových úkonů (elektro, tlak, zdvih) připomeň zásady bezpečnosti.
- Když dává smysl, upozorni na to, "co technika nejspíš čeká" (prediktivní tip podle historie).`;

export type AttachedDoc = {
  fileId: string;
  filename: string;
  kind: string;
  isImage: boolean;
};

const SCHEMA_KEYWORDS =
  /(sch[ée]ma|sch[ée]mat|hydraul|elektro|v[ýy]kres|ventil|rel[ée]|zapojen|svork|st[ýy]kac|jisti|p[ií]stnic|rozvad|zna[čc]k)/i;

/** Vybere model: dotaz na výkres/schéma → Opus 4.8 (high-res vision), jinak výchozí. */
export function pickModel(question: string, docs: AttachedDoc[]): string {
  const hasSchema = docs.some(
    (d) => d.isImage || d.kind === "hydraulika" || d.kind === "elektro"
  );
  if (SCHEMA_KEYWORDS.test(question) || hasSchema) return SCHEMA_MODEL;
  return AI_MODEL;
}

/** Připraví obrázky/PDF jako bloky pro zprávu (PDF s citacemi, obrázky jako vision). */
function docBlocks(docs: AttachedDoc[]): unknown[] {
  return docs.map((d) =>
    d.isImage
      ? { type: "image", source: { type: "file", file_id: d.fileId } }
      : {
          type: "document",
          source: { type: "file", file_id: d.fileId },
          title: d.filename,
          citations: { enabled: true },
        }
  );
}

/** Z odpovědi vytáhne text a doplní odkaz na strany manuálu (citace). */
function extractAnswer(content: readonly unknown[]): string {
  const parts: string[] = [];
  const pages = new Set<string>();
  for (const block of content) {
    const b = block as { type?: string; text?: string; citations?: unknown[] };
    if (b.type === "text" && b.text) {
      parts.push(b.text);
      for (const c of b.citations ?? []) {
        const cit = c as {
          type?: string;
          start_page_number?: number;
          end_page_number?: number;
        };
        if (cit.type === "page_location" && cit.start_page_number != null) {
          const a = cit.start_page_number;
          const z = cit.end_page_number;
          pages.add(z && z !== a ? `${a}–${z}` : String(a));
        }
      }
    }
  }
  let answer = parts.join("\n").trim();
  if (pages.size) answer += `\n\n📄 Zdroj v manuálu: str. ${[...pages].join(", ")}`;
  return answer;
}

/** Zavolá Claude a vrátí textovou odpověď AI údržbáře (s manuály a schématy). */
export async function askMachineAssistant(
  machine: MachineForAI,
  history: { role: "user" | "assistant"; content: string }[],
  question: string,
  docs: AttachedDoc[] = []
): Promise<string> {
  const context = buildMachineContext(machine);
  const intro = `Kontext o stroji:\n\n${context}\n\n---\n`;
  const first = history.length === 0;

  // První zpráva nese dokumentaci (manuály/schémata) + textový kontext.
  const firstContent: unknown[] = [
    ...docBlocks(docs),
    {
      type: "text",
      text: first
        ? `${intro}\nDotaz technika: ${question}`
        : `${intro}\n(Navazuje konverzace níže.)`,
    },
  ];

  const messages: unknown[] = [{ role: "user", content: firstContent }];
  if (!first) {
    messages.push({
      role: "assistant",
      content: "Rozumím, mám parametry, historii i dokumentaci stroje. Ptej se.",
    });
    for (const m of history) messages.push({ role: m.role, content: m.content });
    messages.push({ role: "user", content: question });
  }

  const model = pickModel(question, docs);

  // S dokumenty jdeme přes Files API (beta), bez dokumentů normálním endpointem
  // (prázdná hlavička anthropic-beta jinak vrací 400).
  if (docs.length) {
    const res = await anthropic.beta.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
      betas: [FILES_BETA],
    });
    return extractAnswer(res.content);
  }

  const res = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
  });
  return extractAnswer(res.content);
}

// ===== Dotaz napříč více stroji (flotila / stejný typ) =====

export type FleetMachine = {
  name: string;
  entries: {
    occurredAt: Date;
    problem: string;
    solution: string | null;
    downtimeMinutes: number | null;
  }[];
};

const FLEET_SYSTEM_PROMPT = `Jsi zkušený AI údržbář. Dostaneš historii poruch více strojů STEJNÉHO typu / rodiny najednou.

Pravidla:
- Odpovídej česky, stručně a prakticky, jako kolega technik.
- Hledej hlavně VZORY napříč stroji: opakující se a společné závady, časté příčiny, intervaly.
- Porovnej stroje mezi sebou (který zlobí nejvíc, čím se liší).
- Z historie odhadni, co tyhle stroje nejčastěji potřebují a co technika nejspíš čeká.
- Když navrhuješ řešení, vycházej z toho, co u těchto strojů dříve zabralo. U konkrétních kroků buď konkrétní.`;

/** Sloučí historii více strojů do jednoho kontextu pro AI. */
export function buildFleetContext(machines: FleetMachine[]): string {
  return machines
    .map((m) => {
      const lines =
        m.entries
          .map(
            (e) =>
              `  ${czDate(e.occurredAt)} | ${e.problem}` +
              (e.solution ? ` → ${e.solution}` : "") +
              (e.downtimeMinutes != null ? ` (${e.downtimeMinutes} min)` : "")
          )
          .join("\n") || "  (bez záznamů)";
      return `=== STROJ: ${m.name} (${m.entries.length} záznamů) ===\n${lines}`;
    })
    .join("\n\n");
}

/** Zavolá Claude nad historií více strojů stejného typu. */
export async function askFleet(
  machines: FleetMachine[],
  filter: string,
  history: { role: "user" | "assistant"; content: string }[],
  question: string
): Promise<string> {
  const context = buildFleetContext(machines);
  const intro = `Skupina strojů podle filtru „${filter}" — ${machines.length} strojů.\n\n${context}\n\n---\n`;
  const first = history.length === 0;

  const messages: { role: "user" | "assistant"; content: string }[] = [];
  if (first) {
    messages.push({ role: "user", content: `${intro}\nDotaz technika: ${question}` });
  } else {
    messages.push({ role: "user", content: `${intro}\n(Navazuje konverzace níže.)` });
    messages.push({
      role: "assistant",
      content: "Rozumím, mám historii všech těchto strojů. Ptej se.",
    });
    for (const m of history) messages.push(m);
    messages.push({ role: "user", content: question });
  }

  const res = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1500,
    system: FLEET_SYSTEM_PROMPT,
    messages,
  });
  return extractAnswer(res.content);
}

/** Necht AI přiřadí sloupce z importovaného souboru k polím záznamu poruchy. */
export async function aiColumnMap(
  headers: string[],
  sampleRows: Record<string, unknown>[]
): Promise<FieldMap | null> {
  const res = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 400,
    system:
      "Mapuješ sloupce tabulky s historií poruch strojů na pevná pole. Vrať POUZE JSON.",
    messages: [
      {
        role: "user",
        content: `Sloupce: ${JSON.stringify(headers)}
Ukázka řádků: ${JSON.stringify(sampleRows.slice(0, 3))}

Přiřaď NÁZEV sloupce (přesně jak je v "Sloupce") ke každému poli, nebo null když chybí.
Vrať JSON:
{"machine": "<sloupec s názvem stroje nebo null>", "occurredAt": "<sloupec se začátkem/datem poruchy nebo null>", "endDate": "<sloupec s koncem poruchy nebo null>", "problem": "<sloupec s popisem závady>", "solution": "<sloupec s řešením/opravou/údržbou nebo null>", "downtimeMinutes": "<sloupec s prostojem v minutách nebo null>", "technician": "<sloupec s technikem/zadavatelem nebo null>", "cause": "<sloupec s příčinou nebo null>"}`,
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const pick = (k: string) => {
      const v = parsed[k];
      return typeof v === "string" && headers.includes(v) ? v : null;
    };
    return {
      machine: pick("machine"),
      occurredAt: pick("occurredAt"),
      endDate: pick("endDate"),
      problem: pick("problem"),
      solution: pick("solution"),
      downtimeMinutes: pick("downtimeMinutes"),
      technician: pick("technician"),
      cause: pick("cause"),
    };
  } catch {
    return null;
  }
}

/** Přeloží chybu z Anthropic API na srozumitelný důvod pro uživatele. */
export function aiErrorMessage(err: unknown): string {
  const e = err as {
    status?: number;
    message?: string;
    error?: { error?: { message?: string } };
  };
  const status = e?.status;
  const detail = (e?.error?.error?.message || e?.message || "").slice(0, 300);
  const raw = detail.toLowerCase();

  if (raw.includes("credit") || raw.includes("billing"))
    return "Na účtu Anthropic není kredit. Dobij ho na console.anthropic.com → Billing.";
  if (status === 401)
    return "Neplatný API klíč. Zkontroluj ANTHROPIC_API_KEY v Railway (celý sk-ant-…, bez mezer).";
  if (status === 403)
    return "API klíč nemá oprávnění (403). Zkontroluj klíč i účet.";
  if (status === 429)
    return "Překročen limit požadavků na AI. Zkus to za chvíli.";
  if (status === 404)
    return `AI model nenalezen (404)${detail ? ": " + detail : ""}. Zkontroluj ANTHROPIC_MODEL.`;
  if (status === 400)
    return `Neplatný požadavek na AI (400)${detail ? ": " + detail : ""}.`;
  if (status && status >= 500)
    return "AI služba je dočasně přetížená. Zkus to za chvíli.";
  if (!status)
    return "Nelze se připojit k AI (síť). Zkontroluj, že na Railway NENÍ omylem nastavená ANTHROPIC_BASE_URL.";
  return `AI je momentálně nedostupná${detail ? ": " + detail : ""}.`;
}

/** Z volného (např. hlasem nadiktovaného) textu udělá strukturovaný záznam poruchy.
 *  Když AI selže (chybí klíč, kredit, výpadek), vrátí text jako problém – nikdy
 *  nezahodí to, co technik napsal. */
export async function structureLogEntry(rawText: string): Promise<{
  problem: string;
  solution: string | null;
  partsCost: number | null;
  downtimeMinutes: number | null;
}> {
  const fallback = {
    problem: rawText,
    solution: null,
    partsCost: null,
    downtimeMinutes: null,
  };

  try {
    const res = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      system:
        "Z volného popisu zásahu údržbáře vytvoř strukturovaný záznam. Vrať POUZE JSON bez dalšího textu.",
      messages: [
        {
          role: "user",
          content: `Popis zásahu: "${rawText}"

Vrať JSON ve tvaru:
{"problem": "...", "solution": "..." nebo null, "partsCost": číslo v Kč nebo null, "downtimeMinutes": číslo minut nebo null}`,
        },
      ],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;

    const parsed = JSON.parse(match[0]);
    return {
      problem: typeof parsed.problem === "string" ? parsed.problem : rawText,
      solution: typeof parsed.solution === "string" ? parsed.solution : null,
      partsCost: Number.isFinite(parsed.partsCost) ? parsed.partsCost : null,
      downtimeMinutes: Number.isFinite(parsed.downtimeMinutes)
        ? parsed.downtimeMinutes
        : null,
    };
  } catch (err) {
    console.error("AI strukturování selhalo, ukládám surový text:", err);
    return fallback;
  }
}
