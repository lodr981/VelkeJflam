import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EntryForm from "./EntryForm";
import Assistant from "./Assistant";

export const dynamic = "force-dynamic";

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
    include: { entries: { orderBy: { occurredAt: "desc" } } },
  });

  if (!machine) notFound();

  const totalCost = machine.entries.reduce((s, e) => s + (e.partsCost ?? 0), 0);

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
          {totalCost > 0 && <span>💰 {totalCost} Kč za díly celkem</span>}
        </div>
      </div>

      <Assistant machineId={machine.id} machineName={machine.name} />

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
                  {e.technician ? ` · ${e.technician}` : ""}
                </div>
                <div className="font-medium text-slate-900">⚠️ {e.problem}</div>
                {e.solution && (
                  <div className="mt-1 text-sm text-slate-700">✅ {e.solution}</div>
                )}
                <div className="mt-2 flex gap-3 text-xs text-slate-500">
                  {e.partsCost != null && <span>Díly: {e.partsCost} Kč</span>}
                  {e.downtimeMinutes != null && <span>Prostoj: {e.downtimeMinutes} min</span>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
