import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, AI_MODEL } from "./anthropic";
import { FILES_BETA } from "./files";
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
function extractAnswer(content: Anthropic.Beta.BetaContentBlock[]): string {
  const parts: string[] = [];
  const pages = new Set<string>();
  for (const b of content) {
    if (b.type === "text") {
      parts.push(b.text);
      for (const c of (b as { citations?: unknown[] }).citations ?? []) {
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

  const res = await anthropic.beta.messages.create({
    model: pickModel(question, docs),
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
    betas: docs.length ? [FILES_BETA] : [],
  });

  return extractAnswer(res.content);
}

/** Z volného (např. hlasem nadiktovaného) textu udělá strukturovaný záznam poruchy. */
export async function structureLogEntry(rawText: string): Promise<{
  problem: string;
  solution: string | null;
  partsCost: number | null;
  downtimeMinutes: number | null;
}> {
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
  if (!match) {
    return { problem: rawText, solution: null, partsCost: null, downtimeMinutes: null };
  }
  try {
    const parsed = JSON.parse(match[0]);
    return {
      problem: typeof parsed.problem === "string" ? parsed.problem : rawText,
      solution: typeof parsed.solution === "string" ? parsed.solution : null,
      partsCost: Number.isFinite(parsed.partsCost) ? parsed.partsCost : null,
      downtimeMinutes: Number.isFinite(parsed.downtimeMinutes)
        ? parsed.downtimeMinutes
        : null,
    };
  } catch {
    return { problem: rawText, solution: null, partsCost: null, downtimeMinutes: null };
  }
}
