import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, AI_MODEL } from "./anthropic";
import type { Machine, LogEntry } from "@prisma/client";

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

/** Sestaví zprávy pro Claude API – kontext stroje + historie konverzace. */
export function buildMessages(
  context: string,
  history: { role: "user" | "assistant"; content: string }[],
  question: string
): Anthropic.MessageParam[] {
  const first = history.length === 0;
  const messages: Anthropic.MessageParam[] = [];

  const intro = `Kontext o stroji:\n\n${context}\n\n---\n`;

  if (first) {
    messages.push({ role: "user", content: `${intro}\nDotaz technika: ${question}` });
  } else {
    messages.push({ role: "user", content: `${intro}\n(Navazuje konverzace níže.)` });
    messages.push({
      role: "assistant",
      content: "Rozumím, mám historii i parametry stroje. Ptej se.",
    });
    for (const m of history) messages.push({ role: m.role, content: m.content });
    messages.push({ role: "user", content: question });
  }

  return messages;
}

/** Zavolá Claude a vrátí textovou odpověď AI údržbáře. */
export async function askMachineAssistant(
  machine: MachineForAI,
  history: { role: "user" | "assistant"; content: string }[],
  question: string
): Promise<string> {
  const context = buildMachineContext(machine);
  const messages = buildMessages(context, history, question);

  const res = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
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
