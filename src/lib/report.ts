import { prisma } from "./prisma";

export type ReportData = {
  days: number;
  from: Date;
  to: Date;
  total: number;
  downtimeMin: number;
  byMachine: { name: string; count: number; downtime: number }[];
  byCause: { cause: string; count: number; downtime: number }[];
  byLine: { line: string; count: number; downtime: number }[];
  entries: {
    occurredAt: Date;
    machine: string;
    problem: string;
    solution: string | null;
    downtimeMinutes: number | null;
    repairer: string | null;
  }[];
};

function topSorted(
  map: Map<string, { count: number; downtime: number }>,
  by: "downtime" | "count",
  limit: number
) {
  return [...map.entries()]
    .sort((a, b) => b[1][by] - a[1][by])
    .slice(0, limit)
    .map(([k, v]) => ({ ...v, key: k }));
}

/** Souhrn poruch za posledních `days` dní (kotveno k nejnovějšímu záznamu). */
export async function lastDaysReport(days = 5): Promise<ReportData> {
  const latest = await prisma.logEntry.findFirst({
    where: { machine: { retired: false } },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });
  const to = latest?.occurredAt ?? new Date();
  const from = new Date(to.getTime() - days * 24 * 3600 * 1000);

  const rows = await prisma.logEntry.findMany({
    where: { machine: { retired: false }, occurredAt: { gte: from, lte: to } },
    include: { machine: { select: { name: true, line: true } } },
    orderBy: { occurredAt: "desc" },
  });

  const perMachine = new Map<string, { count: number; downtime: number }>();
  const perCause = new Map<string, { count: number; downtime: number }>();
  const perLine = new Map<string, { count: number; downtime: number }>();
  let downtimeMin = 0;

  for (const e of rows) {
    const dt = e.downtimeMinutes ?? 0;
    downtimeMin += dt;

    const mk = e.machine.name;
    const m = perMachine.get(mk) ?? { count: 0, downtime: 0 };
    m.count++;
    m.downtime += dt;
    perMachine.set(mk, m);

    const lk = e.machine.line?.trim() || "Bez linky";
    const l = perLine.get(lk) ?? { count: 0, downtime: 0 };
    l.count++;
    l.downtime += dt;
    perLine.set(lk, l);

    const cm = e.problem.match(/·\s*příčina:\s*(.+)$/i);
    if (cm) {
      const c = cm[1].trim().toLowerCase();
      const cc = perCause.get(c) ?? { count: 0, downtime: 0 };
      cc.count++;
      cc.downtime += dt;
      perCause.set(c, cc);
    }
  }

  return {
    days,
    from,
    to,
    total: rows.length,
    downtimeMin,
    byMachine: topSorted(perMachine, "downtime", 8).map((x) => ({
      name: x.key,
      count: x.count,
      downtime: x.downtime,
    })),
    byCause: topSorted(perCause, "count", 8).map((x) => ({
      cause: x.key,
      count: x.count,
      downtime: x.downtime,
    })),
    byLine: topSorted(perLine, "downtime", 10).map((x) => ({
      line: x.key,
      count: x.count,
      downtime: x.downtime,
    })),
    entries: rows.slice(0, 50).map((e) => ({
      occurredAt: e.occurredAt,
      machine: e.machine.name,
      problem: e.problem,
      solution: e.solution,
      downtimeMinutes: e.downtimeMinutes,
      repairer: e.repairer,
    })),
  };
}

/** Kompaktní textový kontext reportu pro AI. */
export function reportToContext(r: ReportData): string {
  const d = (x: Date) => x.toLocaleDateString("cs-CZ");
  const lines = [
    `Období: ${d(r.from)} – ${d(r.to)} (${r.days} dní)`,
    `Poruch: ${r.total} · prostoj: ${r.downtimeMin} min (${Math.round(r.downtimeMin / 60)} h)`,
    "",
    "=== PODLE LINEK ===",
    ...r.byLine.map(
      (l) => `${l.line}: ${l.count} poruch, ${Math.round(l.downtime / 60)} h prostoj`
    ),
    "",
    "=== NEJHORŠÍ STROJE (prostoj) ===",
    ...r.byMachine.map(
      (m) => `${m.name}: ${Math.round(m.downtime / 60)} h (${m.count} poruch)`
    ),
    "",
    "=== NEJČASTĚJŠÍ PŘÍČINY ===",
    ...(r.byCause.length
      ? r.byCause.map((c) => `${c.cause}: ${c.count}×`)
      : ["(příčiny nejsou v datech)"]),
    "",
    "=== ZÁZNAMY (výběr) ===",
    ...r.entries
      .slice(0, 40)
      .map(
        (e) =>
          `${d(e.occurredAt)} | ${e.machine} | ${e.problem}${
            e.solution ? ` → ${e.solution}` : ""
          }${e.downtimeMinutes != null ? ` (${e.downtimeMinutes} min)` : ""}`
      ),
  ];
  return lines.join("\n");
}
