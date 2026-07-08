import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AutoAssignLines from "./AutoAssignLines";
import Dedup from "./Dedup";

export const dynamic = "force-dynamic";

async function counts() {
  try {
    const [machines, entries, docs] = await Promise.all([
      prisma.machine.count(),
      prisma.logEntry.count(),
      prisma.document.count(),
    ]);
    return { machines, entries, docs };
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const c = await counts();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">⚙️ Administrace</h1>
        <Link href="/" className="text-sm text-brand hover:underline">
          ← Provoz
        </Link>
      </div>

      {c && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Strojů" value={c.machines} />
          <Stat label="Poruch" value={c.entries} />
          <Stat label="Dokumentů" value={c.docs} />
        </div>
      )}

      <div className="space-y-3">
        <Card
          href="/admin/import"
          title="📊 Import reportů"
          desc="Nahraj Excel/CSV s poruchami za provoz. Přidají se jen nové (inkrementálně)."
        />
        <Card
          href="/admin/machines"
          title="🛠️ Správa strojů a dokumentace"
          desc="Nahrávání manuálů a schémat ke strojům, QR kódy na tisk."
        />
        <AutoAssignLines />
        <Dedup />
      </div>

      <p className="text-xs text-slate-400">
        Pozn.: admin zatím není chráněný heslem — můžeme přidat přihlášení.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-2xl font-bold text-brand">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Card({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand"
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{desc}</div>
    </Link>
  );
}
