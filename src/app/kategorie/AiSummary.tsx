"use client";

import { useState } from "react";

export default function AiSummary({ line }: { line?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/kategorie/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line: line ?? null }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setText(data.answer);
    else setError(data.error ?? "Nepodařilo se.");
  }

  return (
    <div className="rounded-xl border border-brand/30 bg-teal-50 p-4">
      {!text && (
        <button
          onClick={run}
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Analyzuji…" : "🤖 AI rozbor kategorií"}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {text && <div className="whitespace-pre-wrap text-sm text-slate-800">{text}</div>}
    </div>
  );
}
