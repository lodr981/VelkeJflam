import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getMachines() {
  try {
    return await prisma.machine.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { entries: true } } },
    });
  } catch {
    return null; // DB ještě není připojená
  }
}

export default async function HomePage() {
  const machines = await getMachines();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Moje stroje</h1>
        <Link
          href="/machines/new"
          className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
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

      {machines && machines.length > 0 && (
        <ul className="space-y-3">
          {machines.map((m) => (
            <li key={m.id}>
              <Link
                href={`/machines/${m.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{m.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {m._count.entries} záznamů
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {[m.manufacturer, m.type, m.location].filter(Boolean).join(" · ") ||
                    "Bez bližšího popisu"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
