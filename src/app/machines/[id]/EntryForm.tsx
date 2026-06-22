"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EntryForm({ machineId }: { machineId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"quick" | "detail">("quick");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");

  async function submit(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/machines/${machineId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Uložení se nepodařilo.");
      return false;
    }
    return true;
  }

  async function onQuick(e: React.FormEvent) {
    e.preventDefault();
    if (!rawText.trim()) return;
    const ok = await submit({ rawText });
    if (ok) {
      setRawText("");
      router.refresh();
    }
  }

  async function onDetail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const ok = await submit(Object.fromEntries(form.entries()));
    if (ok) {
      e.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex gap-2 text-sm">
        <button
          onClick={() => setMode("quick")}
          className={`rounded-full px-3 py-1 ${
            mode === "quick" ? "bg-brand text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          🎤 Rychlý zápis
        </button>
        <button
          onClick={() => setMode("detail")}
          className={`rounded-full px-3 py-1 ${
            mode === "detail" ? "bg-brand text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          ✏️ Podrobně
        </button>
      </div>

      {mode === "quick" ? (
        <form onSubmit={onQuick} className="space-y-2">
          <p className="text-sm text-slate-500">
            Napiš (nebo nadiktuj přes klávesnici mobilu) zásah vlastními slovy. AI z toho
            udělá strukturovaný záznam.
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={3}
            placeholder="Např. čerpadlo 3 teklo z ucpávky, vyměnil jsem těsnění za 400, stálo to hodinu prostoje"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving || !rawText.trim()}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {saving ? "Zpracovávám…" : "Uložit (AI strukturuje)"}
          </button>
        </form>
      ) : (
        <form onSubmit={onDetail} className="space-y-2">
          <textarea
            name="problem"
            rows={2}
            required
            placeholder="Problém / závada *"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
          <textarea
            name="solution"
            rows={2}
            placeholder="Řešení / co jsem udělal"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              name="partsCost"
              type="number"
              placeholder="Díly (Kč)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
            />
            <input
              name="downtimeMinutes"
              type="number"
              placeholder="Prostoj (min)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
            />
          </div>
          <input
            name="technician"
            placeholder="Technik (volitelné)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {saving ? "Ukládám…" : "Uložit záznam"}
          </button>
        </form>
      )}
    </div>
  );
}
