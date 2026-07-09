import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { categorize } from "@/lib/faultCategory";
import EntryForm from "./EntryForm";
import Assistant from "./Assistant";
import Documents from "./Documents";

export const dynamic = "force-dynamic";

type Cat = { key: string; label: string; icon: string; color: string; count: number; downtime: number };

function machineCategories(
  entries: { problem: string; downtimeMinutes: number | null }[]
): { cats: Cat[]; total: number } {
  const map = new Map<string, Cat>();
  let total = 0;
  for (const e of entries) {
    const c = categorize(e.problem);
    const dt = e.downtimeMinutes ?? 0;
    total += dt;
    const cur =
      map.get(c.key) ?? { ...c, count: 0, downtime: 0 };
    cur.count++;
    cur.downtime += dt;
    map.set(c.key, cur);
  }
  const cats = [...map.values()].sort((a, b) => b.count - a.count);
  return { cats, total };
}

function czDateTime(d: Date): string {
  return new Date(d).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export default async function MachinePage({
  params,
}: {
  params: { id: string };
}) {
  const machine = await prisma.machine.findUnique({
    where: { id: params.id },
    include: {
      entries: { orderBy: { occurredAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!machine) notFound();

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-brand hover:underline">
        ← Moje stroje
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">{machine.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {[machine.manufacturer, machine.type, machine.year, machine.location]
            .filter(Boolean)
            .join(" · ") || "Bez bližšího popisu"}
        </p>
        <div className="mt-3 flex gap-4 text-sm text-slate-600">
          <span>📋 {machine.entries.length} záznamů</span>
        </div>
      </div>

      {machine.entries.length > 0 && <MachineCategories entries={machine.entries} />}

      <Assistant machineId={machine.id} machineName={machine.name} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Dokumentace (manuály a schémata)</h2>
        <Documents
          machineId={machine.id}
          readOnly
          docs={machine.documents.map((d) => ({
            id: d.id,
            filename: d.filename,
            kind: d.kind,
            isImage: d.isImage,
            sizeBytes: d.sizeBytes,
            processed: !!d.digest,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Zapsat poruchu / zásah</h2>
        <EntryForm machineId={machine.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Životopis stroje</h2>
        {machine.entries.length === 0 ? (
          <p className="text-sm text-slate-500">
            Zatím žádný záznam. Zapiš první poruchu výše.
          </p>
        ) : (
          <ol className="space-y-3">
            {machine.entries.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-1 text-xs text-slate-400">
                  {czDateTime(e.occurredAt)}
                  {e.repairer ? ` · 🔧 opravil: ${e.repairer}` : ""}
                  {e.reporter ? ` · nahlásil: ${e.reporter}` : ""}
                  {e.technician ? ` · ${e.technician}` : ""}
                </div>
                <div className="font-medium text-slate-900">⚠️ {e.problem}</div>
                {e.solution && (
                  <div className="mt-1 text-sm text-slate-700">✅ {e.solution}</div>
                )}
                {e.downtimeMinutes != null && (
                  <div className="mt-2 text-xs text-slate-500">
                    Prostoj: {e.downtimeMinutes} min
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function MachineCategories({
  entries,
}: {
  entries: { problem: string; downtimeMinutes: number | null }[];
}) {
  const { cats, total } = machineCategories(entries);
  const maxCount = Math.max(...cats.map((c) => c.count), 1);
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Rozpad poruch po kategoriích</h2>
      {/* skládaný proužek */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {cats.map((c) => (
          <div
            key={c.key}
            title={`${c.label}: ${c.count}×`}
            style={{ width: `${(c.count / entries.length) * 100}%`, backgroundColor: c.color }}
          />
        ))}
      </div>
      <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-3">
        {cats.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-center">{c.icon}</span>
            <span className="w-40 shrink-0 truncate">{c.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
              <div
                className="h-full rounded"
                style={{ width: `${(c.count / maxCount) * 100}%`, backgroundColor: c.color }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs text-slate-500">
              {c.count}×{c.downtime > 0 ? ` · ${Math.round(c.downtime / 60)} h` : ""}
            </span>
          </div>
        ))}
      </div>
      {total > 0 && (
        <p className="text-right text-[11px] text-slate-400">
          Celkem {Math.round(total / 60)} h prostoje na tomto stroji
        </p>
      )}
    </section>
  );
}
