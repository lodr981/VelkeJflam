import Link from "next/link";
import {
  paretoReport,
  recurringReport,
  ineffectiveRepairs,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "pareto", label: "📉 Pareto prostojů" },
  { key: "opakovani", label: "🔁 Opakující se závady" },
  { key: "neucinne", label: "❌ Neúčinné opravy" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function h(min: number) {
  return `${Math.round(min / 60)} h`;
}
function cz(d: Date) {
  return d.toLocaleDateString("cs-CZ");
}
function pct(x: number) {
  return `${Math.round(x * 100)} %`;
}

export default async function AnalyzaPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab: TabKey =
    (TABS.find((t) => t.key === searchParams.tab)?.key as TabKey) ?? "pareto";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-brand hover:underline">
          ← Domů
        </Link>
        <Link href="/report" className="text-sm text-slate-400 hover:text-brand">
          📅 Souhrn dní
        </Link>
      </div>

      <h1 className="text-xl font-bold">Analýza poruch</h1>

      <div className="flex flex-wrap gap-1 text-xs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/analyza?tab=${t.key}`}
            className={`rounded px-3 py-2 font-medium ${
              t.key === tab
                ? "bg-brand text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "pareto" && <Pareto />}
      {tab === "opakovani" && <Recurring />}
      {tab === "neucinne" && <Ineffective />}
    </div>
  );
}

/* ---------- 1) PARETO ---------- */

async function Pareto() {
  const r = await paretoReport();
  if (r.totalCount === 0)
    return <Empty text="Zatím nejsou žádné poruchy." />;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand/30 bg-teal-50 p-4 text-sm">
        <b>{r.vital}</b> strojů z {r.byMachine.length >= 20 ? "všech" : r.byMachine.length}{" "}
        způsobuje <b>80 %</b> veškerého prostoje ({h(r.totalDowntime)} celkem). Sem
        soustřeď pozornost a peníze.
      </div>

      <ParetoBlock title="Stroje" items={r.byMachine} total={r.totalDowntime} />
      <ParetoBlock title="Linky" items={r.byLine} total={r.totalDowntime} />
      <ParetoBlock title="Typy závad" items={r.byFault} total={r.totalDowntime} />
    </div>
  );
}

function ParetoBlock({
  title,
  items,
  total,
}: {
  title: string;
  items: { name: string; count: number; downtime: number; share: number; cum: number }[];
  total: number;
}) {
  const max = items[0]?.downtime || 1;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.name}
            className="rounded-lg border border-slate-200 bg-white p-2.5"
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">{it.name}</span>
              <span className="shrink-0 text-slate-500">
                {h(it.downtime)} · {it.count}×
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
              <div
                className="h-full rounded bg-brand"
                style={{ width: `${(it.downtime / max) * 100}%` }}
              />
            </div>
            <div className="mt-0.5 text-right text-[11px] text-slate-400">
              {pct(it.share)} · kumul. {pct(it.cum)}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">
        Celkem {h(total)} prostoje. Seřazeno od největšího viníka.
      </p>
    </section>
  );
}

/* ---------- 2) OPAKUJICI SE ZAVADY ---------- */

async function Recurring() {
  const items = await recurringReport(3);
  if (items.length === 0)
    return (
      <Empty text="Zatím žádná závada nemá 3+ opakování na stejném stroji. Přijde s víc daty." />
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Stejná závada na stejném stroji 3× a víc. <b>MTBF</b> = průměrný interval mezi
        výskyty → kandidáti na plánovanou výměnu, ne hašení.
      </p>
      {items.slice(0, 40).map((it, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{it.machine}</span>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {it.count}× · {h(it.totalDowntime)}
            </span>
          </div>
          <div className="mt-0.5 text-slate-700">⚠️ {it.fault}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span>🏭 {it.line}</span>
            {it.mtbfDays != null && (
              <span>
                MTBF ≈ <b>{Math.round(it.mtbfDays)} dní</b>
              </span>
            )}
            <span>
              {cz(it.firstAt)} → {cz(it.lastAt)}
            </span>
            {it.nextEstimate && (
              <span className="text-brand">
                odhad další: {cz(it.nextEstimate)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- 3) NEUCINNE OPRAVY ---------- */

async function Ineffective() {
  const items = await ineffectiveRepairs(7);
  if (items.length === 0)
    return (
      <Empty text="Nenašli jsme opravu, po které se stejná závada vrátila do 7 dní. To je dobře." />
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Stejná závada se vrátila <b>do 7 dní</b> po zásahu, který měl řešení — oprava
        nejspíš nezabrala nebo neřešila příčinu.
      </p>
      {items.slice(0, 40).map((it, i) => (
        <div
          key={i}
          className="rounded-xl border border-red-200 bg-red-50/50 p-3 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{it.machine}</span>
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              vrátila se za {it.gapDays} dní
            </span>
          </div>
          <div className="mt-0.5 text-slate-700">⚠️ {it.fault}</div>
          {it.solution && (
            <div className="mt-0.5 text-xs text-slate-500">
              ✅ tehdejší oprava: {it.solution}
            </div>
          )}
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
            <span>🏭 {it.line}</span>
            {it.repairedBy && <span>🔧 {it.repairedBy}</span>}
            <span>
              {cz(it.firstAt)} → znovu {cz(it.recurAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
