import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminMachinesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const machines = await prisma.machine.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
    take: 100,
    include: { _count: { select: { documents: true } } },
  });

  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm text-brand hover:underline">
        ← Administrace
      </Link>
      <h1 className="text-xl font-bold">Správa strojů</h1>

      <form className="flex gap-2" action="/admin/machines">
        <input
          name="q"
          defaultValue={q}
          placeholder="Hledat stroj…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
        />
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
          Hledat
        </button>
      </form>

      <ul className="space-y-2">
        {machines.map((m) => (
          <li key={m.id}>
            <Link
              href={`/admin/machines/${m.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-brand"
            >
              <span>{m.name}</span>
              <span className="text-xs text-slate-400">
                {m._count.documents} dok. · spravovat →
              </span>
            </Link>
          </li>
        ))}
        {machines.length === 0 && (
          <li className="text-sm text-slate-500">Žádný stroj.</li>
        )}
      </ul>
    </div>
  );
}
