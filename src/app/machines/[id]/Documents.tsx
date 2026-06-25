"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type DocDTO = {
  id: string;
  filename: string;
  kind: string;
  isImage: boolean;
  sizeBytes: number | null;
  processed: boolean;
};

const KIND_LABEL: Record<string, string> = {
  manual: "📘 Manuál",
  hydraulika: "🛢️ Hydraulika",
  elektro: "⚡ Elektro",
  jine: "📎 Jiné",
};

export default function Documents({
  machineId,
  docs,
  readOnly = false,
}: {
  machineId: string;
  docs: DocDTO[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState("manual");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);

    const res = await fetch(`/api/machines/${machineId}/documents`, {
      method: "POST",
      body: fd,
    });
    setUploading(false);
    e.target.value = "";
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Nahrání se nezdařilo.");
      return;
    }
    router.refresh();
  }

  async function onDelete(docId: string) {
    await fetch(`/api/machines/${machineId}/documents?docId=${docId}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {!readOnly && (
        <>
          <p className="mb-2 text-sm text-slate-500">
            Nahraj manuál (PDF) nebo schéma (PDF/obrázek). AI je bude číst a radit podle
            nich — u manuálů odkáže i na stranu.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="manual">📘 Manuál</option>
              <option value="hydraulika">🛢️ Hydraulika</option>
              <option value="elektro">⚡ Elektro schéma</option>
              <option value="jine">📎 Jiné</option>
            </select>

            <label className="cursor-pointer rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              {uploading ? "Nahrávám…" : "+ Nahrát soubor"}
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                onChange={onUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <span className="text-xs text-slate-400">PDF / obrázek, max 32 MB</span>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </>
      )}

      {readOnly && docs.length === 0 && (
        <p className="text-sm text-slate-500">Zatím žádná dokumentace.</p>
      )}

      {docs.length > 0 && (
        <ul className="mt-3 space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="truncate">
                {KIND_LABEL[d.kind] ?? "📎"} {d.filename}
                {d.processed ? (
                  <span className="ml-1 text-xs text-green-600">✓ zpracováno</span>
                ) : (
                  <span className="ml-1 text-xs text-amber-600">(bez výtažku)</span>
                )}
              </span>
              {!readOnly && (
                <button
                  onClick={() => onDelete(d.id)}
                  className="ml-2 shrink-0 text-xs text-red-500 hover:underline"
                >
                  Smazat
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
