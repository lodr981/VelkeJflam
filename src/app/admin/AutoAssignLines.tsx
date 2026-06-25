"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AutoAssignLines() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/autoassign-lines", { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !data) {
      setMsg("Nepodařilo se.");
      return;
    }
    const parts = Object.entries(data.assigned as Record<string, number>)
      .map(([l, c]) => `${l}: ${c}`)
      .join(", ");
    setMsg(
      `Přiřazeno ${parts || "0"}. Bez linky zůstalo ${data.leftNull}.`
    );
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
      <p className="mb-2 text-sm text-slate-500">
        Přiřadí linku z názvu strojů (SEAU, L663, UKL, Vstřikovna UAP1). Nepřepisuje
        ručně nastavené.
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? "Přiřazuji…" : "🏭 Auto‑přiřadit linky z názvů"}
      </button>
      {msg && <p className="mt-2 text-sm text-green-700">✅ {msg}</p>}
    </div>
  );
}
