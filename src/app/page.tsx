import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getMachines() {
  try {
    return await prisma.machine.findMany({
      where: { retired: false }, // vyřazené se ignorují
      orderBy: [{ line: "asc" }, { name: "asc" }],
      include: { _count: { select: { entries: true } } },
    });
  } catch {
    return null; // DB ještě není připojená
  }
}

type MachineRow = NonNullable<Awaited<ReturnType<typeof getMachines>>>[number];

function groupByLine(machines: MachineRow[]): { line: string; items: MachineRow[] }[] {
  const map = new Map<string, MachineRow[]>();
  for (const m of machines) {
    const key = m.line?.trim() || "Bez linky";
    (map.get(key) ?? map.set(key, []).get(key)!).push(m);
  }
  const groups = [...map.entries()].map(([line, items]) => ({ line, items }));
  // "Bez linky" až nakonec, ostatní abecedně
  groups.sort((a, b) => {
    if (a.line === "Bez linky") return 1;
    if (b.line === "Bez linky") return -1;
    return a.line.localeCompare(b.line);
  });
  return groups;
}

export default async function HomePage() {
  const machines = await getMachines();
  const groups = machines ? groupByLine(machines) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Moje stroje</h1>
        <Link href="/admin" className="text-sm text-slate-400 hover:text-brand">
          ⚙️ Admin
        </Link>
      </div>

      <Link
        href="/scan"
        className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-4 text-lg font-semibold text-white shadow hover:bg-brand-dark"
      >
        📷 Načíst QR kód stroje
      </Link>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/search"
          className="rounded-lg border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-teal-50"
        >
          🔍 Hledat
        </Link>
        <Link
          href="/fleet"
          className="rounded-lg border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-teal-50"
        >
          🔎 Dotaz napříč stroji
        </Link>
        <Link
          href="/report"
          className="rounded-lg border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-teal-50"
        >
          📅 Souhrn dní
        </Link>
        <Link
          href="/machines/new"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-brand"
        >
          + Přidat stroj
        </Link>
      </div>

      {machines === null && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Databáze zatím není připojená. Nastav <code>DATABASE_URL</code> a spusť{" "}
          <code>npm run db:push</code>.
        </div>
      )}

      {machines && machines.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Zatím tu nemáš žádný stroj.
          <br />
          Přidej první a začni psát jeho životopis.
        </div>
      )}

      {groups.length > 0 && (
        <div className="space-y-2">
          {groups.map((g) => (
            <details
              key={g.line}
              open={groups.length <= 2}
              className="rounded-xl border border-slate-200 bg-white"
            >
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-semibold">
                <span>🏭 {g.line}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
                  {g.items.length} strojů
                </span>
              </summary>
              <ul className="space-y-2 px-3 pb-3">
                {g.items.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/machines/${m.id}`}
                      className="block rounded-lg border border-slate-200 px-3 py-2 transition hover:border-brand"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{m.name}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {m._count.entries}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
