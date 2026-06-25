"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MachineSettings({
  machineId,
  line,
  retired,
}: {
  machineId: string;
  line: string | null;
  retired: boolean;
}) {
  const router = useRouter();
  const [lineVal, setLineVal] = useState(line ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function patch(data: object, okMsg: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/machines/${machineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (res.ok) {
      setMsg(okMsg);
      router.refresh();
    } else {
      setMsg("Uložení se nezdařilo.");
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Linka (pro seskupení)
        </label>
        <div className="flex gap-2">
          <input
            value={lineVal}
            onChange={(e) => setLineVal(e.target.value)}
            placeholder="Např. L663, UKL, SEAU…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            onClick={() => patch({ line: lineVal }, "Linka uložena.")}
            disabled={busy}
            className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Uložit
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="text-sm">
          Stav:{" "}
          {retired ? (
            <span className="font-medium text-red-600">vyřazený (ignoruje se)</span>
          ) : (
            <span className="font-medium text-green-600">aktivní</span>
          )}
        </div>
        <button
          onClick={() =>
            patch(
              { retired: !retired },
              retired ? "Stroj vrácen do provozu." : "Stroj vyřazen."
            )
          }
          disabled={busy}
          className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
            retired
              ? "bg-green-600 text-white hover:bg-green-700"
              : "border border-red-300 text-red-600 hover:bg-red-50"
          }`}
        >
          {retired ? "↩️ Vrátit do provozu" : "🚫 Vyřadit stroj"}
        </button>
      </div>

      {msg && <p className="text-sm text-slate-500">{msg}</p>}
    </div>
  );
}
