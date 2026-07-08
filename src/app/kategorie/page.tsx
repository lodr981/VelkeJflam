import Link from "next/link";
import { categoryReport, type CatAgg } from "@/lib/faultCategory";
import { squarify } from "@/lib/treemap";

export const dynamic = "force-dynamic";

const H = 62.5; // výška treemapu v % (16:10)
const hrs = (m: number) => Math.round(m / 60);
const pct = (x: number) => Math.round(x * 100);

export default async function KategoriePage({
  searchParams,
}: {
  searchParams: { cat?: string };
}) {
  const r = await categoryReport();
  if (r.totalCount === 0) {
    return (
      <div className="space-y-4">
        <Back />
        <p className="text-sm text-slate-500">Zatím nejsou žádné poruchy k zařazení.</p>
      </div>
    );
  }

  const selected = r.cats.find((c) => c.key === searchParams.cat) ?? null;
  const rects = squarify(r.cats.map((c) => c.downtime), 100, H);

  return (
    <div className="space-y-6">
      <Back />

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Kategorie závad</h1>
        <p className="mt-1 text-sm text-slate-500">
          {r.totalCount.toLocaleString("cs-CZ")} poruch · {hrs(r.totalDowntime).toLocaleString("cs-CZ")} h
          prostoje · {r.cats.length} kategorií. Plocha dlaždice = prostoj.
        </p>
      </div>

      {/* TREEMAP */}
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-slate-900 shadow-lg"
        style={{ aspectRatio: `100 / ${H}` }}
      >
        {r.cats.map((c, i) => {
          const t = rects[i];
          const big = t.w > 15 && t.h > 12;
          const mid = t.w > 9 && t.h > 8;
          const active = selected?.key === c.key;
          return (
            <Link
              key={c.key}
              href={active ? "/kategorie" : `/kategorie?cat=${c.key}`}
              className="group absolute flex flex-col justify-between overflow-hidden p-2 transition"
              style={{
                left: `${t.x}%`,
                top: `${(t.y / H) * 100}%`,
                width: `${t.w}%`,
                height: `${(t.h / H) * 100}%`,
                backgroundColor: c.color,
                outline: active ? "3px solid white" : "1px solid rgba(15,23,42,.35)",
                outlineOffset: active ? "-3px" : "-1px",
                opacity: selected && !active ? 0.45 : 1,
              }}
            >
              <div className="flex items-start justify-between text-white">
                <span className="text-lg leading-none drop-shadow-sm sm:text-2xl">{c.icon}</span>
                {big && (
                  <span className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {pct(c.share)} %
                  </span>
                )}
              </div>
              {(big || mid) && (
                <div className="text-white drop-shadow-sm">
                  {big && (
                    <div className="text-[11px] font-semibold leading-tight sm:text-sm">
                      {c.label}
                    </div>
                  )}
                  <div className="text-sm font-extrabold sm:text-lg">{hrs(c.downtime)} h</div>
                  {big && <div className="text-[10px] opacity-80">{c.count}× poruch</div>}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {selected ? (
        <Detail cat={selected} monthsAxis={r.monthsAxis} />
      ) : (
        <>
          <p className="text-center text-xs text-slate-400">
            👆 Klikni na dlaždici pro detail kategorie
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {r.cats.map((c) => (
              <CatCard key={c.key} cat={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Back() {
  return (
    <div className="flex items-center justify-between">
      <Link href="/" className="text-sm text-brand hover:underline">
        ← Domů
      </Link>
      <Link href="/analyza" className="text-sm text-slate-400 hover:text-brand">
        📉 Analýza poruch
      </Link>
    </div>
  );
}

function CatCard({ cat }: { cat: CatAgg }) {
  return (
    <Link
      href={`/kategorie?cat=${cat.key}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
      style={{ borderLeft: `5px solid ${cat.color}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{cat.icon}</span>
          <span className="font-semibold">{cat.label}</span>
        </div>
        <span className="text-sm font-bold" style={{ color: cat.color }}>
          {hrs(cat.downtime)} h
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <Spark values={cat.monthly} color={cat.color} />
        <div className="shrink-0 text-right text-xs text-slate-500">
          {cat.count}× · {pct(cat.share)} %
        </div>
      </div>
      <div className="mt-2 truncate text-xs text-slate-400">
        Nejvíc: {cat.machines[0]?.name ?? "—"}
      </div>
    </Link>
  );
}

function Detail({ cat, monthsAxis }: { cat: CatAgg; monthsAxis: string[] }) {
  const trend = trendLabel(cat.monthly);
  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-5 text-white shadow"
        style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{cat.icon}</span>
          <div>
            <div className="text-lg font-extrabold">{cat.label}</div>
            <div className="text-sm opacity-90">
              {cat.count}× poruch · {hrs(cat.downtime)} h prostoje · {pct(cat.share)} % z celku
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Spark values={cat.monthly} color="#ffffff" tall />
          <div className="mt-1 flex justify-between text-[10px] opacity-80">
            <span>{monthsAxis[0]}</span>
            <span>{trend}</span>
            <span>{monthsAxis[monthsAxis.length - 1]}</span>
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Nejpostiženější stroje</h2>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {cat.machines.map((m) => (
            <div key={m.name} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="truncate">{m.name}</span>
              <span className="ml-2 shrink-0 text-slate-500">
                {hrs(m.downtime)} h · {m.count}×
              </span>
            </div>
          ))}
        </div>
      </section>

      <Link
        href="/kategorie"
        className="inline-block rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-brand"
      >
        ← Všechny kategorie
      </Link>
    </div>
  );
}

/** Malý sloupcový sparkline (inline SVG, bez knihoven). */
function Spark({ values, color, tall }: { values: number[]; color: string; tall?: boolean }) {
  const w = 100;
  const h = tall ? 28 : 18;
  const max = Math.max(1, ...values);
  const n = values.length;
  const bw = n > 0 ? w / n : w;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" preserveAspectRatio="none">
      {values.map((v, i) => {
        const bh = (v / max) * h;
        return (
          <rect
            key={i}
            x={i * bw + 0.5}
            y={h - bh}
            width={Math.max(0.5, bw - 1)}
            height={bh}
            rx={0.6}
            fill={color}
            opacity={tall ? 0.9 : 0.75}
          />
        );
      })}
    </svg>
  );
}

/** Trend z první vs. druhé poloviny období. */
function trendLabel(values: number[]): string {
  if (values.length < 4) return "";
  const mid = Math.floor(values.length / 2);
  const a = values.slice(0, mid).reduce((s, x) => s + x, 0) / mid;
  const b = values.slice(mid).reduce((s, x) => s + x, 0) / (values.length - mid);
  if (a === 0) return "";
  const d = Math.round(((b - a) / a) * 100);
  if (d > 15) return `▲ roste (${d} %)`;
  if (d < -15) return `▼ klesá (${d} %)`;
  return "▬ stabilní";
}
