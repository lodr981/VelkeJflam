"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewMachinePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const res = await fetch("/api/machines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Uložení se nepodařilo.");
      setSaving(false);
      return;
    }
    const machine = await res.json();
    router.push(`/machines/${machine.id}`);
  }

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-brand hover:underline">
        ← Zpět
      </Link>
      <h1 className="text-xl font-bold">Nový stroj</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <Field name="name" label="Název stroje *" placeholder="Např. Lis CNC-2" required />
        <div className="grid grid-cols-2 gap-3">
          <Field name="manufacturer" label="Výrobce" placeholder="Trumpf" />
          <Field name="type" label="Typ / model" placeholder="TruBend 5130" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field name="year" label="Rok výroby" type="number" placeholder="2015" />
          <Field name="location" label="Umístění" placeholder="Hala B" />
        </div>
        <Area
          name="manualText"
          label="Výňatek z manuálu / poznámky k dokumentaci"
          placeholder="Vlož sem klíčové pasáže z manuálu — AI je bude znát."
        />
        <Area name="notes" label="Poznámky" placeholder="Cokoli důležitého o stroji." />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? "Ukládám…" : "Uložit stroj"}
        </button>
      </form>
    </div>
  );
}

function Field(props: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        placeholder={props.placeholder}
        required={props.required}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
      />
    </label>
  );
}

function Area(props: { name: string; label: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{props.label}</span>
      <textarea
        name={props.name}
        placeholder={props.placeholder}
        rows={3}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
      />
    </label>
  );
}
