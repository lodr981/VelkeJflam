import { prisma } from "./prisma";

/** Normalizace textu zavady pro shlukovani "stejna porucha". */
export function faultSignature(problem: string): string {
  return problem
    .replace(/·\s*příčina:.*$/i, "") // odrizni doplnenou pricinu
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diakritika pryc
    .replace(/[^a-z0-9\s]/g, " ") // interpunkce -> mezera
    .replace(/\b\d+\b/g, " ") // hola cisla pryc (mensi sum)
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 8) // podpis = prvnich par slov
    .join(" ");
}

const DAY = 24 * 3600 * 1000;

type Row = {
  occurredAt: Date;
  problem: string;
  solution: string | null;
  downtimeMinutes: number | null;
  repairer: string | null;
  machineId: string;
  machineName: string;
  line: string;
};

async function loadRows(): Promise<Row[]> {
  const rows = await prisma.logEntry.findMany({
    where: { machine: { retired: false } },
    include: { machine: { select: { name: true, line: true } } },
    orderBy: { occurredAt: "asc" },
  });
  return rows.map((e) => ({
    occurredAt: e.occurredAt,
    problem: e.problem,
    solution: e.solution,
    downtimeMinutes: e.downtimeMinutes,
    repairer: e.repairer,
    machineId: e.machineId,
    machineName: e.machine.name,
    line: e.machine.line?.trim() || "Bez linky",
  }));
}

function stripCause(problem: string): string {
  return problem.replace(/·\s*příčina:.*$/i, "").trim();
}

/* ============ 1) PARETO PROSTOJU ============ */

export type ParetoItem = {
  name: string;
  count: number;
  downtime: number; // minuty
  share: number; // podil na celkovem prostoji (0-1)
  cum: number; // kumulativni podil (0-1)
};
export type ParetoData = {
  totalDowntime: number;
  totalCount: number;
  byMachine: ParetoItem[];
  byLine: ParetoItem[];
  byFault: ParetoItem[];
  vital: number; // kolik stroju tvori 80 % prostoje
};

function paretoFrom(
  map: Map<string, { count: number; downtime: number }>,
  total: number
): ParetoItem[] {
  const items = [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.downtime - a.downtime);
  let acc = 0;
  return items.map((it) => {
    const share = total > 0 ? it.downtime / total : 0;
    acc += share;
    return { ...it, share, cum: acc };
  });
}

function bump(m: Map<string, { count: number; downtime: number }>, k: string, dt: number) {
  const v = m.get(k) ?? { count: 0, downtime: 0 };
  v.count++;
  v.downtime += dt;
  m.set(k, v);
}

export async function paretoReport(): Promise<ParetoData> {
  const rows = await loadRows();
  const perMachine = new Map<string, { count: number; downtime: number }>();
  const perLine = new Map<string, { count: number; downtime: number }>();
  const perFault = new Map<string, { count: number; downtime: number }>();
  let totalDowntime = 0;

  for (const r of rows) {
    const dt = r.downtimeMinutes ?? 0;
    totalDowntime += dt;
    bump(perMachine, r.machineName, dt);
    bump(perLine, r.line, dt);
    bump(perFault, faultSignature(r.problem) || "(neuvedeno)", dt);
  }

  const byMachine = paretoFrom(perMachine, totalDowntime);
  const vital = byMachine.findIndex((m) => m.cum >= 0.8) + 1;

  return {
    totalDowntime,
    totalCount: rows.length,
    byMachine: byMachine.slice(0, 20),
    byLine: paretoFrom(perLine, totalDowntime),
    byFault: paretoFrom(perFault, totalDowntime).slice(0, 20),
    vital: vital || byMachine.length,
  };
}

/* ============ 2) OPAKUJICI SE ZAVADY & MTBF ============ */

export type RecurringItem = {
  machine: string;
  line: string;
  fault: string;
  count: number;
  totalDowntime: number;
  firstAt: Date;
  lastAt: Date;
  mtbfDays: number | null; // prumerny interval mezi vyskyty
  nextEstimate: Date | null; // odhad dalsiho vyskytu
};

function groupByMachineFault(rows: Row[]): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const sig = faultSignature(r.problem);
    if (!sig) continue;
    const key = `${r.machineId} ${sig}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  return groups;
}

export async function recurringReport(minCount = 3): Promise<RecurringItem[]> {
  const rows = await loadRows();
  const groups = groupByMachineFault(rows);

  const out: RecurringItem[] = [];
  for (const list of groups.values()) {
    if (list.length < minCount) continue;
    list.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const first = list[0].occurredAt;
    const last = list[list.length - 1].occurredAt;
    const span = last.getTime() - first.getTime();
    const mtbfDays = list.length > 1 ? span / (list.length - 1) / DAY : null;
    out.push({
      machine: list[0].machineName,
      line: list[0].line,
      fault: stripCause(list[list.length - 1].problem),
      count: list.length,
      totalDowntime: list.reduce((s, r) => s + (r.downtimeMinutes ?? 0), 0),
      firstAt: first,
      lastAt: last,
      mtbfDays,
      nextEstimate: mtbfDays ? new Date(last.getTime() + mtbfDays * DAY) : null,
    });
  }
  return out.sort((a, b) => b.count - a.count || b.totalDowntime - a.totalDowntime);
}

/* ============ 3) NEUCINNE OPRAVY ============ */

export type IneffectiveItem = {
  machine: string;
  line: string;
  fault: string;
  firstAt: Date;
  repairedBy: string | null;
  solution: string | null;
  recurAt: Date;
  gapDays: number; // za kolik dni se vratila
};

/** Stejna zavada na stejnem stroji se vrati do `withinDays` po zasahu s resenim. */
export async function ineffectiveRepairs(withinDays = 7): Promise<IneffectiveItem[]> {
  const rows = await loadRows();
  const groups = groupByMachineFault(rows);

  const out: IneffectiveItem[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      const gap = (cur.occurredAt.getTime() - prev.occurredAt.getTime()) / DAY;
      const wasRepaired = !!prev.solution && prev.solution.trim().length > 2;
      if (wasRepaired && gap <= withinDays) {
        out.push({
          machine: prev.machineName,
          line: prev.line,
          fault: stripCause(prev.problem),
          firstAt: prev.occurredAt,
          repairedBy: prev.repairer,
          solution: prev.solution,
          recurAt: cur.occurredAt,
          gapDays: Math.round(gap * 10) / 10,
        });
      }
    }
  }
  return out.sort((a, b) => a.gapDays - b.gapDays);
}
