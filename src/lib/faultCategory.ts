import { prisma } from "./prisma";

export type Category = { key: string; label: string; icon: string; color: string };

/** Pořadí = priorita (první shoda vyhrává). Ladit klidně podle reality provozu. */
const RULES: (Category & { rx: RegExp })[] = [
  {
    key: "topeni",
    label: "Topení / spirála",
    icon: "🔥",
    color: "#ef4444",
    rx: /spirál|spiral|topen|topí|topi|ohřev|ohrev|žhav|zhav|heater|patron|keramik|termočlán|termoclan/i,
  },
  {
    key: "olej",
    label: "Olej / hydraulika",
    icon: "🛢️",
    color: "#f59e0b",
    rx: /olej|oleje|hydraul|čerpadl|cerpadl|tlak oleje|únik oleje|unik oleje/i,
  },
  {
    key: "pohon",
    label: "Měnič / pohon / servo",
    icon: "⚡",
    color: "#8b5cf6",
    rx: /měnič|menic|frekvenč|frekvenc|servo|\bdrive\b|pohon|motor/i,
  },
  {
    key: "cidlo",
    label: "Čidlo / senzor / enkodér",
    icon: "📡",
    color: "#0ea5e9",
    rx: /čidl|cidl|senzor|sensor|snímač|snimac|enkodér|enkoder|encoder|koncový|koncov|koncák|koncak|indukč|indukc/i,
  },
  {
    key: "robot",
    label: "Robot / manipulace",
    icon: "🤖",
    color: "#14b8a6",
    rx: /robot|sepro|manipulát|manipulat|\bkuka\b|podavač|podavac|odběr|odber/i,
  },
  {
    key: "svarovani",
    label: "Svařování / spojování",
    icon: "🔩",
    color: "#f43f5e",
    rx: /svař|svar|weld|\bkln\b|branson|sponkov|nýt|\bnyt\b|lepen|nesvář|nesvar/i,
  },
  {
    key: "dopravnik",
    label: "Dopravník / doprava",
    icon: "📦",
    color: "#a16207",
    rx: /dopravník|dopravnik|conveyor|\bpás\b|\bpas\b|zásek doprav|zasek doprav/i,
  },
  {
    key: "vakuum",
    label: "Vakuum / podtlak",
    icon: "🌀",
    color: "#0891b2",
    rx: /vakuum|vakua|vacuum|podtlak|přísavk|prisavk|sání|sani\b/i,
  },
  {
    key: "pneu",
    label: "Ventil / pneumatika",
    icon: "💨",
    color: "#06b6d4",
    rx: /ventil|vzduch|pneumat|píst|stlačen|stlacen|tlak vzduchu|hadice/i,
  },
  {
    key: "elektro",
    label: "Elektro / zkrat / komunikace",
    icon: "🔌",
    color: "#eab308",
    rx: /zkrat|can\s?bus|profibus|profinet|ethernet|komunikac|jistič|jistic|stykač|stykac|relé|\brele\b|pojistk|kabel|napájen|napajen|elektroinst/i,
  },
  {
    key: "termo",
    label: "Temperace / teplota",
    icon: "🌡️",
    color: "#3b82f6",
    rx: /therm|temperac|temperov|chlazen|chladic|chladíc|tempering|okruh vody|nádrž vody|teplot/i,
  },
  {
    key: "laser",
    label: "Laser / optika",
    icon: "🔦",
    color: "#ec4899",
    rx: /laser|optik|čočka|cocka/i,
  },
  {
    key: "bezpecnost",
    label: "Bezpečnost / kryty / vrata",
    icon: "🚪",
    color: "#dc2626",
    rx: /vrat|dveř|dver|\bkryt|stop tlačít|stop tlacit|nouzov|e-?stop|závor|zavor|ochran|světelná|svetelna/i,
  },
  {
    key: "mechanika",
    label: "Mechanika / forma",
    icon: "⚙️",
    color: "#64748b",
    rx: /zásek|zasek|zaseknut|ložisk|lozisk|řemen|remen|převod|prevod|upnut|forma|nástroj|nastroj|prask|zlomen|uvoln|vůle|vule|zvedac|zvedá|zveda|vozík|vozik|variator|deska|závit|zavit|vrták|vrtak|réf|reference|home position|poloh|nájezd|najezd/i,
  },
  {
    key: "provoz",
    label: "Provoz / seřízení / materiál",
    icon: "🧰",
    color: "#78716c",
    rx: /výměna material|vymena material|materiál|serizen|seřízen|přestavb|prestavb|nastaven|čištění|cisteni|údržb|udrzb|kontrol/i,
  },
  {
    key: "software",
    label: "Řízení / PLC / SW",
    icon: "🖥️",
    color: "#6366f1",
    rx: /\bplc\b|software|program|\bhmi\b|panel|displej|obrazovk|restart|řídíc|ridic|chyba jednotk|hláška|hlaska|\balarm\b|ipros|frima|home/i,
  },
];

const OTHER: Category = { key: "jine", label: "Ostatní / nezařazeno", icon: "❓", color: "#94a3b8" };

export function categorize(problem: string): Category {
  for (const r of RULES) if (r.rx.test(problem)) return { key: r.key, label: r.label, icon: r.icon, color: r.color };
  return OTHER;
}

export const ALL_CATEGORIES: Category[] = [...RULES.map(({ rx, ...c }) => c), OTHER];

export type CatAgg = Category & {
  count: number;
  downtime: number; // minuty
  share: number; // podíl na celkovém prostoji
  machines: { name: string; count: number; downtime: number }[];
  monthly: number[]; // počty po měsících, chronologicky (dle monthsAxis)
};

export type CategoryReport = {
  totalCount: number;
  totalDowntime: number;
  monthsAxis: string[]; // YYYY-MM
  cats: CatAgg[];
};

/** Seznam linek, které mají alespoň jeden nevyřazený stroj (pro filtr). */
export async function distinctLines(): Promise<string[]> {
  const machines = await prisma.machine.findMany({
    where: { retired: false, line: { not: null } },
    select: { line: true },
    distinct: ["line"],
  });
  return machines
    .map((m) => m.line!.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "cs"));
}

export async function categoryReport(line?: string | null): Promise<CategoryReport> {
  const rows = await prisma.logEntry.findMany({
    where: {
      machine: {
        retired: false,
        ...(line ? { line: { equals: line, mode: "insensitive" } } : {}),
      },
    },
    select: {
      problem: true,
      downtimeMinutes: true,
      occurredAt: true,
      machine: { select: { name: true } },
    },
    orderBy: { occurredAt: "asc" },
  });

  const monthsSet = new Set<string>();
  for (const r of rows) monthsSet.add(r.occurredAt.toISOString().slice(0, 7));
  const monthsAxis = [...monthsSet].sort();
  const monthIndex = new Map(monthsAxis.map((m, i) => [m, i]));

  type Acc = {
    count: number;
    downtime: number;
    machines: Map<string, { count: number; downtime: number }>;
    monthly: number[];
  };
  const acc = new Map<string, Acc>();
  let totalDowntime = 0;

  for (const r of rows) {
    const cat = categorize(r.problem);
    const dt = r.downtimeMinutes ?? 0;
    totalDowntime += dt;
    let a = acc.get(cat.key);
    if (!a) {
      a = { count: 0, downtime: 0, machines: new Map(), monthly: new Array(monthsAxis.length).fill(0) };
      acc.set(cat.key, a);
    }
    a.count++;
    a.downtime += dt;
    const mk = r.machine.name;
    const mv = a.machines.get(mk) ?? { count: 0, downtime: 0 };
    mv.count++;
    mv.downtime += dt;
    a.machines.set(mk, mv);
    a.monthly[monthIndex.get(r.occurredAt.toISOString().slice(0, 7))!]++;
  }

  const cats: CatAgg[] = ALL_CATEGORIES.filter((c) => acc.has(c.key)).map((c) => {
    const a = acc.get(c.key)!;
    return {
      ...c,
      count: a.count,
      downtime: a.downtime,
      share: totalDowntime > 0 ? a.downtime / totalDowntime : 0,
      machines: [...a.machines.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((x, y) => y.downtime - x.downtime)
        .slice(0, 5),
      monthly: a.monthly,
    };
  });
  cats.sort((a, b) => b.downtime - a.downtime);

  return { totalCount: rows.length, totalDowntime, monthsAxis, cats };
}

/** Kompaktní textový kontext kategorií pro AI shrnutí. */
export function categoryToContext(r: CategoryReport, line?: string | null): string {
  const hrs = (m: number) => Math.round(m / 60);
  const trend = (monthly: number[]) => {
    if (monthly.length < 4) return "";
    const mid = Math.floor(monthly.length / 2);
    const a = monthly.slice(0, mid).reduce((s, x) => s + x, 0) / mid;
    const b = monthly.slice(mid).reduce((s, x) => s + x, 0) / (monthly.length - mid);
    if (a === 0) return " (nové)";
    const d = Math.round(((b - a) / a) * 100);
    if (d > 15) return ` (trend: roste ${d} %)`;
    if (d < -15) return ` (trend: klesá ${d} %)`;
    return " (trend: stabilní)";
  };
  const lines = [
    line ? `Filtr linky: ${line}` : "Celý závod (bez vyřazených strojů)",
    `Poruch: ${r.totalCount} · prostoj: ${hrs(r.totalDowntime)} h`,
    "",
    "=== KATEGORIE ZÁVAD (dle prostoje) ===",
    ...r.cats.map(
      (c) =>
        `${c.label}: ${hrs(c.downtime)} h, ${c.count}× (${Math.round(c.share * 100)} %)${trend(
          c.monthly
        )} — nejvíc: ${c.machines
          .slice(0, 3)
          .map((m) => `${m.name} (${hrs(m.downtime)} h)`)
          .join(", ")}`
    ),
  ];
  return lines.join("\n");
}
