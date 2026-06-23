"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BreakdownImport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import/breakdowns", { method: "POST", body: fd });
    setBusy(false);
    e.target.value = "";
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Import se nezdařil.");
      return;
    }
    setMsg(
      `Hotovo: ${data.entries} poruch na ${data.machinesTotal} strojích ` +
        `(${data.machinesCreated} nově založeno, list „${data.sheet}").`
    );
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
      <p className="mb-2 text-sm font-medium text-slate-700">
        📊 Hromadný import poruch (více strojů)
      </p>
      <p className="mb-2 text-sm text-slate-500">
        Nahraj exportní Excel/CSV s poruchami za celý provoz. Appka sama vytvoří
        stroje a rozhází k nim historii poruch.
      </p>
      <label className="inline-block cursor-pointer rounded-lg border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-teal-50">
        {busy ? "Importuji… (chvíli to potrvá)" : "Vybrat soubor"}
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onFile}
          disabled={busy}
          className="hidden"
        />
      </label>
      {msg && <p className="mt-2 text-sm text-green-700">✅ {msg}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
