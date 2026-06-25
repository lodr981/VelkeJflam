"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ScanPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [manual, setManual] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);

  function goTo(text: string) {
    const t = text.trim();
    const m = t.match(/machines\/([A-Za-z0-9_-]+)/);
    if (m) {
      router.push(`/machines/${m[1]}`);
      return;
    }
    try {
      const u = new URL(t);
      if (u.pathname.includes("/machines/")) {
        window.location.href = t;
        return;
      }
    } catch {
      /* není URL */
    }
    router.push(`/machines/${t}`);
  }

  async function stop() {
    try {
      await scannerRef.current?.stop();
      await scannerRef.current?.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
  }

  async function start() {
    setError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decoded: string) => {
          stop();
          goTo(decoded);
        },
        () => {
          /* průběžné chyby skenování ignorujeme */
        }
      );
      setStarted(true);
    } catch (e) {
      setError(
        "Nepodařilo se spustit kameru. Povol přístup ke kameře, nebo zadej kód ručně. (" +
          (e instanceof Error ? e.message : String(e)) +
          ")"
      );
    }
  }

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-brand hover:underline">
        ← Domů
      </Link>
      <h1 className="text-xl font-bold">Načíst QR kód stroje</h1>
      <p className="text-sm text-slate-500">
        Namiř kameru na QR kód u stroje. Otevře se jeho historie a AI údržbář.
      </p>

      <div
        id="qr-reader"
        className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-black"
      />

      {!started && (
        <button
          onClick={start}
          className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white hover:bg-brand-dark"
        >
          📷 Spustit kameru
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm text-slate-500">
          Nejde kamera? Zadej kód/ID stroje z QR ručně:
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) goTo(manual);
          }}
          className="flex gap-2"
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="ID stroje nebo odkaz z QR"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={!manual.trim()}
            className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Otevřít
          </button>
        </form>
      </div>
    </div>
  );
}
