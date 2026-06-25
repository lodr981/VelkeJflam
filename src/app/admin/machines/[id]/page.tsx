import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { baseUrl } from "@/lib/baseUrl";
import Documents from "@/app/machines/[id]/Documents";
import ImportEntries from "@/app/machines/[id]/ImportEntries";
import PrintButton from "./PrintButton";
import MachineSettings from "./MachineSettings";

export const dynamic = "force-dynamic";

export default async function AdminMachinePage({
  params,
}: {
  params: { id: string };
}) {
  const machine = await prisma.machine.findUnique({
    where: { id: params.id },
    include: { documents: { orderBy: { createdAt: "desc" } } },
  });
  if (!machine) notFound();

  const url = `${baseUrl()}/machines/${machine.id}`;
  const qr = await QRCode.toDataURL(url, { width: 320, margin: 2 });

  return (
    <div className="space-y-6">
      <Link href="/admin/machines" className="text-sm text-brand hover:underline">
        ← Správa strojů
      </Link>
      <div>
        <h1 className="text-xl font-bold">{machine.name}</h1>
        <Link href={`/machines/${machine.id}`} className="text-sm text-brand hover:underline">
          Otevřít provozní stránku →
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Nastavení stroje</h2>
        <MachineSettings
          machineId={machine.id}
          line={machine.line}
          retired={machine.retired}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Dokumentace</h2>
        <Documents
          machineId={machine.id}
          docs={machine.documents.map((d) => ({
            id: d.id,
            filename: d.filename,
            kind: d.kind,
            isImage: d.isImage,
            sizeBytes: d.sizeBytes,
            processed: !!d.digest,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Import poruch (jen tento stroj)</h2>
        <ImportEntries machineId={machine.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">QR kód na stroj</h2>
        <div className="qr-print rounded-xl border border-slate-200 bg-white p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR kód stroje" className="mx-auto h-56 w-56" />
          <div className="mt-2 font-semibold">{machine.name}</div>
          <div className="break-all text-xs text-slate-400">{url}</div>
        </div>
        <div className="no-print">
          <PrintButton />
          <p className="mt-2 text-xs text-slate-500">
            Vytiskni a nalep na stroj. Po naskenování se otevře jeho historie a AI údržbář.
          </p>
        </div>
      </section>
    </div>
  );
}
