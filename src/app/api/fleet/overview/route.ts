import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { askPlant, aiErrorMessage } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function czMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Sestaví souhrnné statistiky celého provozu pro AI. */
async function buildPlantContext(): Promise<{ context: string; totals: Record<string, number> }> {
  const [machines, entries] = await Promise.all([
    prisma.machine.findMany({ select: { id: true, name: true } }),
    prisma.logEntry.findMany({
      select: { machineId: true, problem: true, downtimeMinutes: true, occurredAt: true },
    }),
  ]);

  const nameById = new Map(machines.map((m) => [m.id, m.name]));
  const perMachine = new Map<string, { count: number; downtime: number }>();
  const causes = new Map<string, { count: number; downtime: number }>();
  const months = new Map<string, number>();
  let totalDowntime = 0;

  for (const e of entries) {
    const dt = e.downtimeMinutes ?? 0;
    totalDowntime += dt;

    const pm = perMachine.get(e.machineId) ?? { count: 0, downtime: 0 };
    pm.count++;
    pm.downtime += dt;
    perMachine.set(e.machineId, pm);

    const m = e.problem.match(/·\s*příčina:\s*(.+)$/i);
    if (m) {
      const cause = m[1].trim().toLowerCase();
      const c = causes.get(cause) ?? { count: 0, downtime: 0 };
      c.count++;
      c.downtime += dt;
      causes.set(cause, c);
    }

    if (e.occurredAt) {
      const key = czMonth(new Date(e.occurredAt));
      months.set(key, (months.get(key) ?? 0) + 1);
    }
  }

  const byCount = [...perMachine.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(
      ([id, s], i) =>
        `${i + 1}. ${nameById.get(id) ?? id}: ${s.count} poruch, ${s.downtime} min prostoj`
    );

  const byDowntime = [...perMachine.entries()]
    .sort((a, b) => b[1].downtime - a[1].downtime)
    .slice(0, 15)
    .map(
      ([id, s], i) =>
        `${i + 1}. ${nameById.get(id) ?? id}: ${s.downtime} min prostoj (${s.count} poruch)`
    );

  const topCauses = [...causes.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(
      ([c, s], i) => `${i + 1}. ${c}: ${s.count}× (${s.downtime} min prostoj)`
    );

  const trend = [...months.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}: ${v}`);

  const context = [
    `Strojů celkem: ${machines.length}`,
    `Poruch celkem: ${entries.length}`,
    `Prostoj celkem: ${totalDowntime} min (${Math.round(totalDowntime / 60)} h)`,
    "",
    "=== NEJPORUCHOVĚJŠÍ STROJE (počet poruch) ===",
    ...byCount,
    "",
    "=== STROJE S NEJVĚTŠÍM PROSTOJEM ===",
    ...byDowntime,
    "",
    "=== NEJČASTĚJŠÍ PŘÍČINY ===",
    ...(topCauses.length ? topCauses : ["(příčiny nejsou v datech)"]),
    "",
    "=== POČET PORUCH PO MĚSÍCÍCH ===",
    ...trend,
  ].join("\n");

  return {
    context,
    totals: {
      machines: machines.length,
      entries: entries.length,
      downtimeMin: totalDowntime,
    },
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const question = body?.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Dotaz je prázdný." }, { status: 400 });
  }

  const { context, totals } = await buildPlantContext();
  if (totals.entries === 0) {
    return NextResponse.json(
      { error: "Zatím nejsou žádné poruchy. Nejdřív naimportuj data." },
      { status: 404 }
    );
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (m: unknown): m is { role: string; content: string } =>
            !!m &&
            typeof (m as { content?: unknown }).content === "string" &&
            ((m as { role?: unknown }).role === "user" ||
              (m as { role?: unknown }).role === "assistant")
        )
        .slice(-8)
    : [];

  try {
    const answer = await askPlant(context, history, question);
    return NextResponse.json({ answer, ...totals });
  } catch (err) {
    console.error("Plant AI chyba:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 502 });
  }
}
