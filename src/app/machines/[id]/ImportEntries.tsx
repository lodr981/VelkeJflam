"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportEntries({ machineId }: { machineId: string }) {
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
    const res = await fetch(`/api/machines/${machineId}/entries/import`, {
      method: "POST",
      body: fd,
    });
    setBusy(false);
    e.target.value = "";
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Import se nezdařil.");
      return;
    }
    setMsg(
      `Naimportováno ${data.imported} záznamů` +
        (data.skipped ? ` (${data.skipped} řádků přeskočeno).` : ".")
    );
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
      <p className="mb-2 text-sm text-slate-500">
        Máš historii poruch v Excelu nebo CSV? Nahraj ji — AI sama pozná sloupce
        (datum, problém, řešení, technik) a hromadně to naimportuje.
      </p>
      <label className="inline-block cursor-pointer rounded-lg border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-teal-50">
        {busy ? "Importuji…" : "📥 Importovat z Excelu / CSV"}
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
