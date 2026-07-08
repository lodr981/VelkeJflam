import Link from "next/link";
import { lastDaysReport } from "@/lib/report";
import AiSummary from "./AiSummary";

export const dynamic = "force-dynamic";

function cz(d: Date) {
  return d.toLocaleDateString("cs-CZ");
}
function h(min: number) {
  return `${Math.round(min / 60)} h`;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const days = Number(searchParams.days) > 0 ? Math.min(Number(searchParams.days), 60) : 5;
  const r = await lastDaysReport(days);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-brand hover:underline">
          ← Domů
        </Link>
        <div className="flex gap-1 text-xs">
          {[5, 7, 14, 30].map((d) => (
            <Link
              key={d}
              href={`/report?days=${d}`}
              className={`rounded px-2 py-1 ${
                d === days ? "bg-brand text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {d} dní
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold">Souhrn — posledních {days} dní</h1>
        <p className="text-sm text-slate-500">
          {cz(r.from)} – {cz(r.to)}
        </p>
      </div>

      {r.total === 0 ? (
        <p className="text-sm text-slate-500">V tomto období nejsou žádné poruchy.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-2xl font-bold text-brand">{r.total}</div>
              <div className="text-xs text-slate-500">poruch</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-2xl font-bold text-brand">{h(r.downtimeMin)}</div>
              <div className="text-xs text-slate-500">prostoj</div>
            </div>
          </div>

          <AiSummary days={days} />

          <Section title="Podle linek">
            {r.byLine.map((l) => (
              <Row key={l.line} left={l.line} right={`${h(l.downtime)} · ${l.count}×`} />
            ))}
          </Section>

          <Section title="Nejhorší stroje (prostoj)">
            {r.byMachine.map((m) => (
              <Row key={m.name} left={m.name} right={`${h(m.downtime)} · ${m.count}×`} />
            ))}
          </Section>

          {r.byCause.length > 0 && (
            <Section title="Nejčastější příčiny">
              {r.byCause.map((c) => (
                <Row key={c.cause} left={c.cause} right={`${c.count}×`} />
              ))}
            </Section>
          )}

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Poslední záznamy</h2>
            <ul className="space-y-2">
              {r.entries.slice(0, 30).map((e, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
                >
                  <div className="mb-0.5 text-xs text-slate-400">
                    {cz(e.occurredAt)} · {e.machine}
                    {e.repairer ? ` · 🔧 ${e.repairer}` : ""}
                    {e.downtimeMinutes != null ? ` · ${e.downtimeMinutes} min` : ""}
                  </div>
                  <div className="font-medium">⚠️ {e.problem}</div>
                  {e.solution && <div className="text-slate-700">✅ {e.solution}</div>}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {children}
      </div>
    </section>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm">
      <span className="truncate">{left}</span>
      <span className="ml-2 shrink-0 text-slate-500">{right}</span>
    </div>
  );
}
