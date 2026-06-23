"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Msg = { role: "user" | "assistant"; content: string };

export default function FleetPage() {
  const [filter, setFilter] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || !filter.trim() || loading) return;

    const history = messages.slice(-8);
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/fleet/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filter: filter.trim(), question, history }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setInfo(`Zahrnuto ${data.machineCount} strojů podle „${filter.trim()}".`);
    }
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: res.ok ? data.answer : data.error ?? "Něco se pokazilo.",
      },
    ]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const examples = ["FOAMFLEX", "IR welding", "Mirror welding", "L663"];

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-brand hover:underline">
        ← Moje stroje
      </Link>
      <div>
        <h1 className="text-xl font-bold">Dotaz napříč stroji</h1>
        <p className="mt-1 text-sm text-slate-500">
          Zadej kus názvu (typ/rodina strojů). AI projde historii všech strojů, které
          filtru odpovídají, a hledá společné vzory.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Filtr názvu strojů
        </label>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Např. FOAMFLEX"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {examples.map((x) => (
            <button
              key={x}
              onClick={() => setFilter(x)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand"
            >
              {x}
            </button>
          ))}
        </div>
      </div>

      {info && <p className="text-xs text-slate-500">{info}</p>}

      {messages.length > 0 && (
        <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
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
              AI prochází historii strojů…
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Např. Jaká závada se na těchhle strojích opakuje nejvíc?"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || !filter.trim()}
          className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          Poslat
        </button>
      </form>
    </div>
  );
}
