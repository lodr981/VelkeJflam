"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Assistant({
  machineId,
  machineName,
}: {
  machineId: string;
  machineName: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [deep, setDeep] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const history = messages.slice(-10);
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);

    const res = await fetch(`/api/machines/${machineId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history, deep }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: res.ok ? data.answer : data.error ?? "Něco se pokazilo.",
      },
    ]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const suggestions = [
    "Co tě na tomhle stroji nejspíš čeká?",
    "Opakuje se nějaká závada?",
    "Jak vyřešit poslední problém?",
  ];

  return (
    <div className="rounded-xl border border-brand/30 bg-teal-50 p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left font-semibold text-brand-dark"
      >
        🤖 Zeptej se AI údržbáře
        <span className="ml-auto text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-full border border-brand/40 bg-white px-3 py-1 text-xs text-brand-dark hover:bg-teal-100"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.length > 0 && (
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-white p-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "ml-6 bg-brand text-white"
                      : "mr-6 bg-slate-100 text-slate-800"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {loading && (
                <div className="mr-6 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500">
                  AI přemýšlí nad strojem „{machineName}“…
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}

          <form onSubmit={send} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Napiš dotaz ke stroji…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              Poslat
            </button>
          </form>

          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={deep}
              onChange={(e) => setDeep(e.target.checked)}
            />
            🔍 Mrkni přímo do schématu (přesnější trasování, o pár haléřů dražší)
          </label>
        </div>
      )}
    </div>
  );
}
