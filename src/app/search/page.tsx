"use client";

import { useState } from "react";
import Link from "next/link";

type MachineHit = { id: string; name: string; _count: { entries: number } };
type EntryHit = {
  id: string;
  occurredAt: string;
  problem: string;
  solution: string | null;
  repairer: string | null;
  reporter: string | null;
  downtimeMinutes: number | null;
  machine: { id: string; name: string };
};

function czDate(s: string) {
  return new Date(s).toLocaleDateString("cs-CZ");
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [machine, setMachine] = useState("");
  const [machines, setMachines] = useState<MachineHit[]>([]);
  const [entries, setEntries] = useState<EntryHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim() && !machine.trim()) return;
    setLoading(true);
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, machine }),
    });
    const data = await res.json().catch(() => ({ machines: [], entries: [] }));
    setMachines(data.machines ?? []);
    setEntries(data.entries ?? []);
    setLoading(false);
    setSearched(true);
  }

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-brand hover:underline">
        ← Moje stroje
      </Link>
      <div>
        <h1 className="text-xl font-bold">Vyhledávání</h1>
        <p className="mt-1 text-sm text-slate-500">
          Najdi stroj, nebo prohledej poruchy (např. „enkoder") a uvidíš, kdy a kdo to
          řešil. Filtr stroje můžeš zúžit (např. „FoamFlex").
        </p>
      </div>

      <form onSubmit={run} className="space-y-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Co hledáš (porucha, díl, kód opraváře…) – např. enkoder"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
        />
        <div className="flex gap-2">
          <input
            value={machine}
            onChange={(e) => setMachine(e.target.value)}
            placeholder="Filtr stroje (volitelné) – např. FoamFlex"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={loading || (!q.trim() && !machine.trim())}
            className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Hledat
          </button>
        </div>
      </form>

      {loading && <p className="text-sm text-slate-500">Hledám…</p>}

      {searched && !loading && (
        <>
          {machines.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">
                Stroje ({machines.length})
              </h2>
              <ul className="space-y-1">
                {machines.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/machines/${m.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-brand"
                    >
                      <span>{m.name}</span>
                      <span className="text-xs text-slate-400">
                        {m._count.entries} záznamů
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              Poruchy ({entries.length}){entries.length === 60 ? "+" : ""} — od
              nejnovější
            </h2>
            {entries.length === 0 ? (
              <p className="text-sm text-slate-500">Nic nenalezeno.</p>
            ) : (
              <ul className="space-y-2">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                      <span>{czDate(e.occurredAt)}</span>
                      <Link
                        href={`/machines/${e.machine.id}`}
                        className="text-brand hover:underline"
                      >
                        {e.machine.name}
                      </Link>
                      {e.repairer && <span>· 🔧 opravil: {e.repairer}</span>}
                      {e.reporter && <span>· nahlásil: {e.reporter}</span>}
                      {e.downtimeMinutes != null && <span>· {e.downtimeMinutes} min</span>}
                    </div>
                    <div className="font-medium text-slate-900">⚠️ {e.problem}</div>
                    {e.solution && (
                      <div className="mt-0.5 text-slate-700">✅ {e.solution}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
