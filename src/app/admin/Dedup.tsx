"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Dedup() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (!confirm("Odstranit duplicitní poruchy? Ponechá se vždy jedna z každé skupiny."))
      return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/dedup", { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !data) {
      setMsg("Nepodařilo se.");
      return;
    }
    setMsg(
      `Odstraněno ${data.removed} duplicit. Zůstalo ${data.after} poruch (bylo ${data.before}).`
    );
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
      <p className="mb-2 text-sm text-slate-500">
        Odstraní duplicitní poruchy (stejný stroj, čas, problém i řešení) — ponechá vždy
        jednu. Použij, pokud se nějakým importem zdvojily.
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? "Odstraňuji…" : "🧹 Odstranit duplicitní poruchy"}
      </button>
      {msg && <p className="mt-2 text-sm text-green-700">✅ {msg}</p>}
    </div>
  );
}
