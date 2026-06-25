"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-teal-50"
    >
      🖨️ Vytisknout QR
    </button>
  );
}
